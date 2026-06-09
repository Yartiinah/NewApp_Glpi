import JSZip from 'jszip'
import axios from 'axios'
import {
  createComputer,
  createMonitor,
  addTicketCost,
  getTickets,
  createUser,
  getUsers,
  deleteComputer,
  deleteMonitor,
  deleteTicket,
  deleteTicketCost,
  deleteItemTicket,
  deleteUser,
  forceDeleteItem,
  extractTicketRef,
  resolveStateId,
  resolveLocationId,
  resolveManufacturerId,
  resolveComputerModelId,
  resolveMonitorModelId,
  clearLookupCaches,
  ensureSession
} from './glpi.service'
import { createTicket, linkItemToTicket, getAllItems } from '../frontoffice/glpi.service'

let ticketRefToGlpiIdMap = {}

export async function clearImportCache() {
  ticketRefToGlpiIdMap = {}
  clearLookupCaches()
}

// --- CSV parsing ---

export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  if (lines.length === 0) return []

  const firstLine = lines[0]
  const separator = firstLine.includes(';') ? ';' : ','
  const headers = splitCSVLine(firstLine, separator).map(h => h.trim())

  const data = []
  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i], separator)
    const row = {}
    headers.forEach((header, index) => {
      row[header] = (values[index] !== undefined ? values[index].trim() : '')
    })
    data.push(row)
  }
  return data
}

function splitCSVLine(line, separator) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === separator && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result.map(v => v.replace(/^"|"$/g, ''))
}

function parseFrenchNumber(value) {
  if (value === undefined || value === null || value === '') return 0
  const str = String(value).trim().replace(/\s/g, '').replace(',', '.')
  return parseFloat(str) || 0
}

function parseItemsField(itemsField) {
  if (!itemsField || !itemsField.trim()) return []
  const trimmed = itemsField.trim()

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map(n => String(n).trim()).filter(Boolean)
      }
    } catch {
      // fallback to delimiter split
    }
  }

  return trimmed
    .split(/[;,]/)
    .map(n => n.replace(/^["'\[]|["'\]]$/g, '').trim())
    .filter(Boolean)
}

// --- Rollback tracker ---

function createRollbackTracker() {
  return {
    computers: [],
    monitors: [],
    users: [],
    tickets: [],
    itemLinks: [],
    costs: [],
    lookups: []
  }
}

async function rollbackImport(tracker) {
  console.warn('⏪ Rollback de l\'import en cours...')

  for (const costId of [...tracker.costs].reverse()) {
    try { await deleteTicketCost(costId) } catch (e) { console.warn('Rollback cost:', e.message) }
  }
  for (const linkId of [...tracker.itemLinks].reverse()) {
    try { await deleteItemTicket(linkId) } catch (e) { console.warn('Rollback link:', e.message) }
  }
  for (const ticketId of [...tracker.tickets].reverse()) {
    try { await deleteTicket(ticketId, true) } catch (e) { console.warn('Rollback ticket:', e.message) }
  }
  for (const monitorId of [...tracker.monitors].reverse()) {
    try { await deleteMonitor(monitorId, true) } catch (e) { console.warn('Rollback monitor:', e.message) }
  }
  for (const computerId of [...tracker.computers].reverse()) {
    try { await deleteComputer(computerId, true) } catch (e) { console.warn('Rollback computer:', e.message) }
  }
  for (const userId of [...tracker.users].reverse()) {
    try { await deleteUser(userId) } catch (e) { console.warn('Rollback user:', e.message) }
  }
  for (const lookup of [...tracker.lookups].reverse()) {
    try { await forceDeleteItem(lookup.type, lookup.id) } catch (e) { console.warn('Rollback lookup:', e.message) }
  }
}

function trackLookup(tracker, type, result) {
  if (result?.created && result?.id) {
    tracker.lookups.push({ type, id: result.id })
  }
}

// --- User resolution with cache ---

async function buildUserCache() {
  const users = await getUsers()
  const cache = new Map()
  for (const user of Array.isArray(users) ? users : []) {
    if (user.name) cache.set(user.name.toLowerCase(), user)
    if (user.realname) cache.set(user.realname.toLowerCase(), user)
  }
  return cache
}

async function resolveOrCreateUser(userName, userCache, tracker) {
  if (!userName || !userName.trim()) return null

  const trimmed = userName.trim()
  const login = trimmed.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')

  const cached = userCache.get(trimmed.toLowerCase()) || userCache.get(login)
  if (cached) return cached.id

  try {
    const res = await createUser({ name: login, realname: trimmed })
    if (res?.id) {
      tracker.users.push(res.id)
      userCache.set(trimmed.toLowerCase(), { id: res.id, name: login, realname: trimmed })
      userCache.set(login, { id: res.id, name: login, realname: trimmed })
      return res.id
    }
    throw new Error(`Impossible de créer l'utilisateur "${trimmed}"`)
  } catch (createErr) {
    const errorMessage = createErr.response?.data?.[1] || createErr.message || ''
    if (errorMessage.includes('existe déjà') || errorMessage.includes('already exists')) {
      const retryUsers = await getUsers()
      const retryExisting = (Array.isArray(retryUsers) ? retryUsers : []).find(u =>
        u.name?.toLowerCase() === login ||
        u.realname?.toLowerCase() === trimmed.toLowerCase()
      )
      if (retryExisting) return retryExisting.id
    }
    throw new Error(`Utilisateur "${trimmed}" : ${errorMessage}`)
  }
}

// --- Ticket helpers ---

function mapTicketStatus(statusStr) {
  const s = (statusStr || '').toLowerCase().trim()
  if (s.includes('cours') || s.includes('processing') || s.includes('assign')) return 2
  if (s.includes('attente') || s.includes('pending')) return 4
  if (s.includes('résolu') || s.includes('solve')) return 5
  if (s.includes('clos') || s.includes('close')) return 6
  return 1
}

function mapTicketPriority(prioStr) {
  const p = (prioStr || '').toLowerCase().trim()
  if (p.includes('bas') || p.includes('low')) return 2
  if (p.includes('haut') || p.includes('high')) return 4
  if (p.includes('très') || p.includes('urgent') || p.includes('very')) return 5
  return 3
}

function mapTicketType(typeStr) {
  const t = (typeStr || '').toLowerCase()
  return t.includes('demande') || t.includes('request') || t === '2' ? 2 : 1
}

async function resolveTicketId(numTicket, ticketsList) {
  if (!numTicket && numTicket !== 0) return null
  const ref = String(numTicket).trim()

  if (ticketRefToGlpiIdMap[ref]) return ticketRefToGlpiIdMap[ref]

  for (const ticket of ticketsList) {
    const ticketRef = extractTicketRef(ticket.content)
    if (ticketRef === ref) return ticket.id
  }

  const numeric = parseInt(ref, 10)
  if (!Number.isNaN(numeric)) {
    const byId = ticketsList.find(t => t.id === numeric)
    if (byId) return byId.id
    if (ticketRefToGlpiIdMap[String(numeric)]) return ticketRefToGlpiIdMap[String(numeric)]
  }

  const byName = ticketsList.find(t => t.name === ref)
  return byName?.id || null
}

function failImport(message, tracker) {
  const error = new Error(message)
  error.tracker = tracker
  throw error
}

// 1. Import CSV Éléments (tout ou rien)
export async function importElementsCSV(file, onProgress) {
  const text = await file.text()
  const rows = parseCSV(text)
  if (rows.length === 0) {
    return { success: false, importedCount: 0, errorCount: 1, message: 'Le fichier CSV est vide.' }
  }

  const tracker = createRollbackTracker()
  const userCache = await buildUserCache()

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const name = row.Name || row.name
      if (!name?.trim()) {
        failImport(`Ligne ${i + 2} : le champ Name est obligatoire.`, tracker)
      }

      const itemtype = (row.Item_Type || row.item_type || 'Computer').toLowerCase()
      const serial = row.Inventory_Number || row.inventory_number || ''
      const location = row.Location || row.location || ''
      const model = row.Model || row.model || ''
      const maker = row.Manufacturer || row.manufacturer || ''
      const status = row.Status || row.status || ''
      const userName = row.User || row.user || ''

      const userId = await resolveOrCreateUser(userName, userCache, tracker)

      const payload = {
        name: name.trim(),
        serial,
        otherserial: serial
      }

      if (userId) payload.users_id = userId

      if (status) {
        const stateResult = await resolveStateId(status)
        trackLookup(tracker, 'State', stateResult)
        if (stateResult?.id) payload.states_id = stateResult.id
      }

      if (location) {
        const locResult = await resolveLocationId(location)
        trackLookup(tracker, 'Location', locResult)
        if (locResult?.id) payload.locations_id = locResult.id
      }

      if (maker) {
        const mfrResult = await resolveManufacturerId(maker)
        trackLookup(tracker, 'Manufacturer', mfrResult)
        if (mfrResult?.id) payload.manufacturers_id = mfrResult.id
      }

      if (model) {
        if (itemtype === 'monitor') {
          const modelResult = await resolveMonitorModelId(model)
          trackLookup(tracker, 'MonitorModel', modelResult)
          if (modelResult?.id) payload.monitormodels_id = modelResult.id
        } else {
          const modelResult = await resolveComputerModelId(model)
          trackLookup(tracker, 'ComputerModel', modelResult)
          if (modelResult?.id) payload.computermodels_id = modelResult.id
        }
      }

      payload.comment = `Importé via CSV. Status: ${status}. Localisation: ${location}. Fabricant: ${maker}. Modèle: ${model}`

      let created
      if (itemtype === 'monitor') {
        created = await createMonitor(payload)
        if (!created?.id) failImport(`Ligne ${i + 2} : échec création moniteur "${name}".`, tracker)
        tracker.monitors.push(created.id)
      } else {
        created = await createComputer(payload)
        if (!created?.id) failImport(`Ligne ${i + 2} : échec création ordinateur "${name}".`, tracker)
        tracker.computers.push(created.id)
      }

      if (onProgress) onProgress(Math.round(((i + 1) / rows.length) * 100))
    }

    return {
      success: true,
      importedCount: rows.length,
      errorCount: 0,
      message: `${rows.length} élément(s) importé(s) avec succès (relations GLPI incluses).`
    }
  } catch (err) {
    await rollbackImport(err.tracker || tracker)
    return {
      success: false,
      importedCount: 0,
      errorCount: rows.length,
      message: `Import annulé (tout ou rien) : ${err.message}`
    }
  }
}

// 2. Import CSV Tickets (tout ou rien)
export async function importTicketsCSV(file, onProgress) {
  const text = await file.text()
  const rows = parseCSV(text)
  if (rows.length === 0) {
    return { success: false, importedCount: 0, errorCount: 1, message: 'Le fichier CSV est vide.' }
  }

  const tracker = createRollbackTracker()
  const itemsList = await getAllItems()
  const itemsMap = {}
  itemsList.forEach(item => {
    if (item.name) itemsMap[item.name.toLowerCase().trim()] = item
  })

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const refTicket = String(row.Ref_Ticket || row.ref_ticket || '').trim()
      const title = row.Titre || row.titre || row.Title || row.title
      if (!title?.trim()) {
        failImport(`Ligne ${i + 2} : le champ Titre est obligatoire.`, tracker)
      }

      const desc = row.Description || row.description || 'Importé via CSV.'
      const type = mapTicketType(row.Type || row.type)
      const status = mapTicketStatus(row.Status || row.status)
      const priority = mapTicketPriority(row.Priority || row.priority)

      // Récupère date + heure (colonnes séparées ou combinées)
      const dateStr = row.Date || row.date || row.Date_creation || row.date_creation || ''
      const heureStr = row.Heure || row.heure || row.Time || row.time || ''

      const refMarker = refTicket ? `\n<!-- REF_TICKET:${refTicket} -->` : ''
      const ticketPayload = {
        name: title.trim(),
        content: desc + refMarker,
        type,
        status,
        priority
      }

      // Construit la date au format GLPI : YYYY-MM-DD HH:MM:SS
      if (dateStr) {
        try {
          let normalized = dateStr.trim()
          // Accepte DD/MM/YYYY → YYYY-MM-DD
          const frMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
          if (frMatch) {
            normalized = `${frMatch[3]}-${frMatch[2].padStart(2, '0')}-${frMatch[1].padStart(2, '0')}`
          }
          // Combine avec l'heure si colonne séparée
          let dateTimeStr = normalized
          if (heureStr && !normalized.includes(' ') && !normalized.includes('T')) {
            dateTimeStr = `${normalized} ${heureStr.trim()}`
          }
          const parsedDate = new Date(dateTimeStr)
          if (!isNaN(parsedDate.getTime())) {
            const pad = n => String(n).padStart(2, '0')
            const formatted = `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth()+1)}-${pad(parsedDate.getDate())} ${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}:${pad(parsedDate.getSeconds())}`
            // GLPI : date = date ouverture, date_creation = date création
            ticketPayload.date = formatted
            ticketPayload.date_creation = formatted
            ticketPayload.date_mod = formatted
            console.log(`📅 Ticket "${title.trim()}" → date GLPI : ${formatted}`)
          } else {
            console.warn('⚠️ Date invalide dans le CSV:', dateStr, heureStr)
          }
        } catch (e) {
          console.warn('⚠️ Erreur parsing date:', dateStr, e.message)
        }
      }

      const res = await createTicket(ticketPayload)
      if (!res?.id) failImport(`Ligne ${i + 2} : échec création ticket "${title}".`, tracker)

      const ticketId = res.id
      tracker.tickets.push(ticketId)

      if (refTicket) ticketRefToGlpiIdMap[refTicket] = ticketId
      ticketRefToGlpiIdMap[title.trim()] = ticketId

      const itemNames = parseItemsField(row.Items || row.items || '')
      for (const itemName of itemNames) {
        const matchedItem = itemsMap[itemName.toLowerCase().trim()]
        if (!matchedItem) {
          failImport(`Ligne ${i + 2} : équipement "${itemName}" introuvable dans GLPI. Importez d'abord les éléments.`, tracker)
        }
        const linkRes = await linkItemToTicket(ticketId, matchedItem.itemtype, matchedItem.id)
        if (linkRes?.id) tracker.itemLinks.push(linkRes.id)
      }

      if (onProgress) onProgress(Math.round(((i + 1) / rows.length) * 100))
    }

    return {
      success: true,
      importedCount: rows.length,
      errorCount: 0,
      message: `${rows.length} ticket(s) importé(s) avec succès (liens équipements inclus).`
    }
  } catch (err) {
    await rollbackImport(err.tracker || tracker)
    ticketRefToGlpiIdMap = {}
    return {
      success: false,
      importedCount: 0,
      errorCount: rows.length,
      message: `Import annulé (tout ou rien) : ${err.message}`
    }
  }
}

// 3. Import CSV Coûts (tout ou rien)
export async function importCostsCSV(file, onProgress) {
  const text = await file.text()
  const rows = parseCSV(text)
  if (rows.length === 0) {
    return { success: false, importedCount: 0, errorCount: 1, message: 'Le fichier CSV est vide.' }
  }

  const tracker = createRollbackTracker()
  const ticketsList = await getTickets()

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const numTicket = row.Num_Ticket || row.num_ticket
      if (!numTicket && numTicket !== 0) {
        failImport(`Ligne ${i + 2} : le champ Num_Ticket est obligatoire.`, tracker)
      }

      const ticketId = await resolveTicketId(numTicket, ticketsList)
      if (!ticketId) {
        failImport(`Ligne ${i + 2} : ticket "${numTicket}" introuvable. Importez d'abord les tickets.`, tracker)
      }

      const actiontime = parseInt(row.Duration_second || row.duration_second || 0, 10) || 0
      const costTime = parseFrenchNumber(row.Time_Cost || row.time_cost)
      const costFixed = parseFrenchNumber(row.Fixed_Cost || row.fixed_cost)

      const costRes = await addTicketCost(ticketId, {
        actiontime,
        cost_time: costTime,
        cost_fixed: costFixed
      })
      if (costRes?.id) tracker.costs.push(costRes.id)

      if (onProgress) onProgress(Math.round(((i + 1) / rows.length) * 100))
    }

    return {
      success: true,
      importedCount: rows.length,
      errorCount: 0,
      message: `${rows.length} coût(s) importé(s) avec succès.`
    }
  } catch (err) {
    await rollbackImport(err.tracker || tracker)
    return {
      success: false,
      importedCount: 0,
      errorCount: rows.length,
      message: `Import annulé (tout ou rien) : ${err.message}`
    }
  }
}

// 4. Import ZIP Images (simulé)
export async function importImagesZIP(file, onProgress) {
  if (!file) {
    return { success: false, message: 'Aucun fichier ZIP sélectionné.' }
  }
  if (!file.name.toLowerCase().endsWith('.zip')) {
    return { success: false, message: 'Le fichier doit être au format ZIP.' }
  }

  await ensureSession()

  const GLPI_URL   = import.meta.env.VITE_GLPI_URL
  const APP_TOKEN  = import.meta.env.VITE_GLPI_APP_TOKEN
  const sessionToken = localStorage.getItem('glpi_session_token')
  const baseUrl    = GLPI_URL?.replace('/apirest.php', '') || ''

  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']

  try {
    const zip = await JSZip.loadAsync(file)
    const allFiles = Object.keys(zip.files)

    const imageFiles = allFiles.filter(filename => {
      if (filename.includes('__MACOSX') || filename.startsWith('._')) return false
      if (zip.files[filename].dir) return false
      const ext = '.' + filename.split('.').pop().toLowerCase()
      return imageExtensions.includes(ext)
    })

    if (imageFiles.length === 0) {
      return {
        success: false,
        message: 'Aucune image trouvée dans le ZIP. Formats acceptés : ' + imageExtensions.join(', ')
      }
    }

    // Récupère la liste des équipements pour faire le matching nom ↔ équipement
    const itemsList = await getAllItems()
    const itemsMap = {}
    itemsList.forEach(item => {
      itemsMap[item.name.toLowerCase()] = { id: item.id, type: item.itemtype }
      if (item.inventory_number && item.inventory_number !== 'N/A') {
        itemsMap[item.inventory_number.toLowerCase()] = { id: item.id, type: item.itemtype }
      }
    })

    let importedCount = 0
    let skippedCount  = 0
    const createdDocIds = []

    for (let i = 0; i < imageFiles.length; i++) {
      const filename   = imageFiles[i]
      const zipEntry   = zip.files[filename]
      const baseName   = filename.split('/').pop().replace(/\.[^/.]+$/, '')
      const ext        = '.' + filename.split('.').pop().toLowerCase()
      const mimeType   = getMimeType(ext)

      // Matching équipement : nom exact, puis numéro d'inventaire, puis suffixe numérique
      let matchedItem = itemsMap[baseName.toLowerCase()]
      if (!matchedItem) {
        const numMatch = baseName.match(/(\d+)$/)
        if (numMatch) matchedItem = itemsMap[numMatch[1].toLowerCase()]
      }

      if (!matchedItem) {
        console.warn('⚠️ Équipement introuvable pour :', filename)
        skippedCount++
        if (onProgress) onProgress(Math.round(((i + 1) / imageFiles.length) * 100))
        continue
      }

      try {
        // 1) Lit le fichier en ArrayBuffer depuis le ZIP
        const arrayBuffer = await zipEntry.async('arraybuffer')

        // 2) Détecte le vrai format par magic bytes (ignore l'extension du fichier)
        //    Un fichier peut être renommé .png mais être physiquement un JPEG, etc.
        const bytes = new Uint8Array(arrayBuffer.slice(0, 12))
        const realMime = detectRealMimeType(bytes) || mimeType
        const realExt  = mimeToExt(realMime)
        const fullFileName = baseName + realExt

        console.log(`🔍 ${baseName}${ext} → vrai format détecté : ${realMime} (${realExt})`)

        // 3) Crée un Blob binaire avec le vrai type MIME détecté
        const fileBlob = new Blob([arrayBuffer], { type: realMime })

        const uploadManifest = JSON.stringify({
          input: {
            name: baseName,
            _filename: [fullFileName]
          }
        })

        const formData = new FormData()
        formData.append('uploadManifest', uploadManifest)
        formData.append('filename[0]', fileBlob, fullFileName)

        const uploadRes = await axios.post(`${GLPI_URL}/Document`, formData, {
          headers: {
            'App-Token':     APP_TOKEN,
            'Session-Token': sessionToken
            // Pas de Content-Type manuel — axios génère le boundary automatiquement
          }
        })

        console.log('📨 Réponse GLPI upload pour', fullFileName, ':', JSON.stringify(uploadRes.data))
        const docId = uploadRes.data?.id
        if (!docId) {
          console.error('❌ Pas d\'ID dans la réponse GLPI pour', fullFileName, uploadRes.data)
          throw new Error(`GLPI n'a pas retourné d'ID pour ${fullFileName}`)
        }

        createdDocIds.push(docId)

        // 3) GET sur le document pour récupérer le filepath réel
        //    GLPI ne retourne pas toujours filepath dans la réponse POST
        let filepath = uploadRes.data?.filepath || ''
        if (!filepath) {
          try {
            const docDetail = await axios.get(`${GLPI_URL}/Document/${docId}`, {
              headers: {
                'App-Token':     APP_TOKEN,
                'Session-Token': sessionToken
              }
            })
            filepath = docDetail.data?.filepath || ''
            console.log('📄 Document GET ID:', docId, 'filepath:', filepath, 'pour', filename)
          } catch (getErr) {
            console.warn('⚠️ Impossible de récupérer filepath via GET:', getErr.message)
          }
        } else {
          console.log('📄 Document POST ID:', docId, 'filepath:', filepath, 'pour', filename)
        }

        // 4) Associe le document à l'équipement (Document_Item)
        await axios.post(`${GLPI_URL}/Document_Item`, {
          input: {
            documents_id: docId,
            itemtype:     matchedItem.type,
            items_id:     matchedItem.id
          }
        }, {
          headers: {
            'Content-Type': 'application/json',
            'App-Token':     APP_TOKEN,
            'Session-Token': sessionToken
          }
        })

        // 5) Met à jour picture_front sur l'équipement avec le filepath récupéré
        if (filepath) {
          const endpoint = matchedItem.type === 'Monitor'
            ? `${GLPI_URL}/Monitor/${matchedItem.id}`
            : `${GLPI_URL}/Computer/${matchedItem.id}`

          try {
            const updateRes = await axios.put(endpoint, {
              input: { picture_front: filepath }
            }, {
              headers: {
                'Content-Type': 'application/json',
                'App-Token':     APP_TOKEN,
                'Session-Token': sessionToken
              }
            })
            console.log('🖼️ picture_front mis à jour :', filepath, '→', matchedItem.type, matchedItem.id, 'réponse:', updateRes.data)
          } catch (updateErr) {
            console.error('❌ Erreur mise à jour picture_front:', updateErr.response?.data || updateErr.message)
          }
        } else {
          console.warn('⚠️ filepath vide pour', fullFileName, '— picture_front non mis à jour')
        }

        importedCount++
        console.log('✅ Image', filename, 'associée à', matchedItem.type, matchedItem.id)

      } catch (uploadErr) {
        console.error('❌ Erreur upload', filename, ':', uploadErr.response?.data || uploadErr.message)

        // Rollback : supprime les documents déjà créés
        for (const dId of createdDocIds) {
          try {
            await axios.delete(`${GLPI_URL}/Document/${dId}`, {
              headers: { 'App-Token': APP_TOKEN, 'Session-Token': sessionToken },
              params:  { force_purge: 1 }
            })
          } catch (e) {
            console.warn('⚠️ Rollback doc', dId, ':', e.message)
          }
        }

        return {
          success: false,
          message: `Erreur upload "${filename}" : ${uploadErr.response?.data?.[1] || uploadErr.message}. Rollback effectué.`
        }
      }

      if (onProgress) onProgress(Math.round(((i + 1) / imageFiles.length) * 100))
    }

    // Émettre un événement global pour notifier que les données ont changé
    window.dispatchEvent(new CustomEvent('glpi-data-changed', { detail: { type: 'images-imported' } }))

    return {
      success: true,
      importedCount,
      skippedCount,
      message: `${importedCount} image(s) importée(s) avec succès.${skippedCount > 0 ? ' ' + skippedCount + ' ignorée(s) (équipement non trouvé).' : ''}`
    }

  } catch (err) {
    console.error('❌ Erreur extraction ZIP:', err.message)
    return { success: false, message: `Erreur ZIP : ${err.message}` }
  }
}

function getMimeType(extension) {
  const mimeTypes = {
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.gif':  'image/gif',
    '.webp': 'image/webp',
    '.bmp':  'image/bmp',
    '.svg':  'image/svg+xml'
  }
  return mimeTypes[extension.toLowerCase()] || 'image/jpeg'
}

/**
 * Détecte le vrai type MIME d'un fichier image par ses magic bytes.
 * Ignore complètement l'extension du fichier.
 * @param {Uint8Array} bytes  Les 12 premiers octets du fichier
 * @returns {string|null}     Le type MIME réel, ou null si non reconnu
 */
function detectRealMimeType(bytes) {
  // JPEG : FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg'
  }
  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 &&
      bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png'
  }
  // GIF : 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 &&
      bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif'
  }
  // WebP : 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
  if (bytes[0] === 0x52 && bytes[1] === 0x49 &&
      bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 &&
      bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp'
  }
  // BMP : 42 4D
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
    return 'image/bmp'
  }
  return null
}

/**
 * Retourne l'extension correcte pour un type MIME image.
 * @param {string} mime
 * @returns {string}
 */
function mimeToExt(mime) {
  const map = {
    'image/jpeg': '.jpg',
    'image/png':  '.png',
    'image/gif':  '.gif',
    'image/webp': '.webp',
    'image/bmp':  '.bmp',
    'image/svg+xml': '.svg'
  }
  return map[mime] || '.jpg'
}