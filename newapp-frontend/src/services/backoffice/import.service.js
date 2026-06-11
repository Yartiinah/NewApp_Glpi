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
  ensureSession,
  getComputers,
  getMonitors,
  getTicketCosts
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

// =============================================
// GESTION DES DOUBLONS ET FICHIERS VIDES
// =============================================

// Vérifie si un équipement existe déjà (par nom ou numéro d'inventaire)
async function checkExistingItem(itemtype, name, serial) {
  const existingItems = itemtype === 'monitor' 
    ? await getMonitors().catch(() => [])
    : await getComputers().catch(() => [])
  
  return existingItems.find(item => 
    item.name?.toLowerCase() === name?.toLowerCase() ||
    item.serial?.toLowerCase() === serial?.toLowerCase() ||
    item.otherserial?.toLowerCase() === serial?.toLowerCase()
  )
}

// Vérifie si un ticket existe déjà (par référence ou titre)
// Remplacer la fonction checkExistingTicket par celle-ci
async function checkExistingTicket(ticketData) {
  const tickets = await getTickets().catch(() => [])
  
  // Vérification par référence (priorité 1)
  if (ticketData.refTicket) {
    const existingByRef = tickets.find(t => extractTicketRef(t.content) === ticketData.refTicket)
    if (existingByRef) return existingByRef
  }
  
  // Vérification par tous les champs (priorité 2)
  const existingByAllFields = tickets.find(existing => {
    const sameName = existing.name?.toLowerCase() === ticketData.name?.toLowerCase()
    const sameContent = existing.content?.toLowerCase() === ticketData.content?.toLowerCase()
    const sameType = existing.type === ticketData.type
    const samePriority = existing.priority === ticketData.priority
    const sameUser = existing._users_id_requester === ticketData.userId
    
    const existingDate = existing.date_creation?.split(' ')[0]
    const sameDate = existingDate === ticketData.date
    
    return sameName && sameContent && sameType && samePriority && sameUser && sameDate
  })
  
  if (existingByAllFields) return existingByAllFields
  
  return null
}

// Vérifie si un coût existe déjà pour un ticket
async function checkExistingCost(ticketId, actiontime, costTime, costFixed) {
  const costs = await getTicketCosts(ticketId).catch(() => [])
  return costs.find(cost => 
    Math.abs((cost.actiontime || 0) - actiontime) < 5 &&
    Math.abs((cost.cost_time || 0) - costTime) < 0.01 &&
    Math.abs((cost.cost_fixed || 0) - costFixed) < 0.01
  )
}

// =============================================
// 1. Import CSV Éléments
// =============================================

export async function importElementsCSV(file, onProgress) {
  // Gestion fichier vide
  if (!file || file.size === 0) {
    return { 
      success: true, 
      importedCount: 0, 
      errorCount: 0, 
      duplicateCount: 0,
      message: '✅ Aucune donnée à importer (fichier vide).' 
    }
  }

  const text = await file.text()
  if (!text.trim()) {
    return { 
      success: true, 
      importedCount: 0, 
      errorCount: 0, 
      duplicateCount: 0,
      message: '✅ Aucune donnée à importer (fichier vide).' 
    }
  }

  const rows = parseCSV(text)
  if (rows.length === 0) {
    return { 
      success: true, 
      importedCount: 0, 
      errorCount: 0, 
      duplicateCount: 0,
      message: '✅ Aucune donnée à importer (fichier vide).' 
    }
  }

  const tracker = createRollbackTracker()
  const userCache = await buildUserCache()
  let importedCount = 0
  let duplicateCount = 0
  let skippedCount = 0

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const name = row.Name || row.name
      if (!name?.trim()) {
        skippedCount++
        continue
      }

      const itemtype = (row.Item_Type || row.item_type || 'Computer').toLowerCase()
      const serial = row.Inventory_Number || row.inventory_number || ''
      const location = row.Location || row.location || ''
      const model = row.Model || row.model || ''
      const maker = row.Manufacturer || row.manufacturer || ''
      const status = row.Status || row.status || ''
      const userName = row.User || row.user || ''

      // VÉRIFICATION DOUBLON
      const existing = await checkExistingItem(itemtype, name, serial)
      if (existing) {
        console.log(`⚠️ Doublon ignoré: ${name} (existe déjà avec ID ${existing.id})`)
        duplicateCount++
        continue
      }

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

      if (itemtype === 'monitor') {
        const created = await createMonitor(payload)
        if (created?.id) tracker.monitors.push(created.id)
      } else {
        const created = await createComputer(payload)
        if (created?.id) tracker.computers.push(created.id)
      }
      importedCount++

      if (onProgress) onProgress(Math.round(((i + 1) / rows.length) * 100))
    }

    tracker.computers = []
    tracker.monitors = []
    tracker.users = []
    tracker.lookups = []

    return {
      success: true,
      importedCount,
      duplicateCount,
      skippedCount,
      errorCount: 0,
      message: `✅ ${importedCount} élément(s) importé(s). ${duplicateCount} doublon(s) ignoré(s). ${skippedCount} ligne(s) ignorée(s).`
    }
  } catch (err) {
    await rollbackImport(err.tracker || tracker)
    return {
      success: false,
      importedCount: 0,
      duplicateCount,
      skippedCount,
      errorCount: rows.length,
      message: `❌ Import annulé : ${err.message}`
    }
  }
}

// =============================================
// 2. Import CSV Tickets
// =============================================

export async function importTicketsCSV(file, onProgress) {
  // Gestion fichier vide
  if (!file || file.size === 0) {
    return { 
      success: true, 
      importedCount: 0, 
      errorCount: 0, 
      duplicateCount: 0,
      message: '✅ Aucune donnée à importer (fichier vide).' 
    }
  }

  const text = await file.text()
  if (!text.trim()) {
    return { 
      success: true, 
      importedCount: 0, 
      errorCount: 0, 
      duplicateCount: 0,
      message: '✅ Aucune donnée à importer (fichier vide).' 
    }
  }

  const rows = parseCSV(text)
  if (rows.length === 0) {
    return { 
      success: true, 
      importedCount: 0, 
      errorCount: 0, 
      duplicateCount: 0,
      message: '✅ Aucune donnée à importer (fichier vide).' 
    }
  }

  const tracker = createRollbackTracker()
  const itemsList = await getAllItems()
  const itemsMap = {}
  itemsList.forEach(item => {
    if (item.name) itemsMap[item.name.toLowerCase().trim()] = item
  })

  let importedCount = 0
  let duplicateCount = 0
  let skippedCount = 0

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const refTicket = String(row.Ref_Ticket || row.ref_ticket || '').trim()
      const title = row.Titre || row.titre || row.Title || row.title
      if (!title?.trim()) {
        skippedCount++
        continue
      }

      // VÉRIFICATION DOUBLON
      const existingTicket = await checkExistingTicket(refTicket, title.trim())
      if (existingTicket) {
        console.log(`⚠️ Ticket doublon ignoré: ${title} (existe déjà avec ID ${existingTicket.id})`)
        duplicateCount++
        continue
      }

      const desc = row.Description || row.description || 'Importé via CSV.'
      const type = mapTicketType(row.Type || row.type)
      const status = mapTicketStatus(row.Status || row.status)
      const priority = mapTicketPriority(row.Priority || row.priority)

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

      if (dateStr) {
        try {
          let normalized = dateStr.trim()
          const frMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
          if (frMatch) {
            normalized = `${frMatch[3]}-${frMatch[2].padStart(2, '0')}-${frMatch[1].padStart(2, '0')}`
          }
          let dateTimeStr = normalized
          if (heureStr && !normalized.includes(' ') && !normalized.includes('T')) {
            dateTimeStr = `${normalized} ${heureStr.trim()}`
          }
          const parsedDate = new Date(dateTimeStr)
          if (!isNaN(parsedDate.getTime())) {
            const pad = n => String(n).padStart(2, '0')
            const formatted = `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth()+1)}-${pad(parsedDate.getDate())} ${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}:${pad(parsedDate.getSeconds())}`
            ticketPayload.date = formatted
            ticketPayload.date_creation = formatted
            ticketPayload.date_mod = formatted
          }
        } catch (e) {
          console.warn('⚠️ Erreur parsing date:', dateStr, e.message)
        }
      }

      const res = await createTicket(ticketPayload)
      if (!res?.id) {
        skippedCount++
        continue
      }

      const ticketId = res.id
      tracker.tickets.push(ticketId)

      if (refTicket) ticketRefToGlpiIdMap[refTicket] = ticketId
      ticketRefToGlpiIdMap[title.trim()] = ticketId

      const itemNames = parseItemsField(row.Items || row.items || '')
      for (const itemName of itemNames) {
        const matchedItem = itemsMap[itemName.toLowerCase().trim()]
        if (matchedItem) {
          const linkRes = await linkItemToTicket(ticketId, matchedItem.itemtype, matchedItem.id)
          if (linkRes?.id) tracker.itemLinks.push(linkRes.id)
        }
      }

      importedCount++

      if (onProgress) onProgress(Math.round(((i + 1) / rows.length) * 100))
    }

    tracker.tickets = []
    tracker.itemLinks = []

    return {
      success: true,
      importedCount,
      duplicateCount,
      skippedCount,
      errorCount: 0,
      message: `✅ ${importedCount} ticket(s) importé(s). ${duplicateCount} doublon(s) ignoré(s). ${skippedCount} ligne(s) ignorée(s).`
    }
  } catch (err) {
    await rollbackImport(err.tracker || tracker)
    ticketRefToGlpiIdMap = {}
    return {
      success: false,
      importedCount: 0,
      duplicateCount,
      skippedCount,
      errorCount: rows.length,
      message: `❌ Import annulé : ${err.message}`
    }
  }
}

// =============================================
// 3. Import CSV Coûts
// =============================================

export async function importCostsCSV(file, onProgress) {
  // Gestion fichier vide
  if (!file || file.size === 0) {
    return { 
      success: true, 
      importedCount: 0, 
      errorCount: 0, 
      duplicateCount: 0,
      message: '✅ Aucune donnée à importer (fichier vide).' 
    }
  }

  const text = await file.text()
  if (!text.trim()) {
    return { 
      success: true, 
      importedCount: 0, 
      errorCount: 0, 
      duplicateCount: 0,
      message: '✅ Aucune donnée à importer (fichier vide).' 
    }
  }

  const rows = parseCSV(text)
  if (rows.length === 0) {
    return { 
      success: true, 
      importedCount: 0, 
      errorCount: 0, 
      duplicateCount: 0,
      message: '✅ Aucune donnée à importer (fichier vide).' 
    }
  }

  const tracker = createRollbackTracker()
  const ticketsList = await getTickets()
  let importedCount = 0
  let duplicateCount = 0
  let skippedCount = 0

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const numTicket = row.Num_Ticket || row.num_ticket
      if (!numTicket && numTicket !== 0) {
        skippedCount++
        continue
      }

      const ticketId = await resolveTicketId(numTicket, ticketsList)
      if (!ticketId) {
        skippedCount++
        continue
      }

      const actiontime = parseInt(row.Duration_second || row.duration_second || 0, 10) || 0
      const costTime = parseFrenchNumber(row.Time_Cost || row.time_cost)
      const costFixed = parseFrenchNumber(row.Fixed_Cost || row.fixed_cost)

      // VÉRIFICATION DOUBLON
      const existingCost = await checkExistingCost(ticketId, actiontime, costTime, costFixed)
      if (existingCost) {
        duplicateCount++
        continue
      }

      const costRes = await addTicketCost(ticketId, {
        actiontime,
        cost_time: costTime,
        cost_fixed: costFixed,
        name: 'Coût_CSV'
      })
      if (costRes?.id) {
        tracker.costs.push(costRes.id)
        importedCount++
      } else {
        skippedCount++
      }

      if (onProgress) onProgress(Math.round(((i + 1) / rows.length) * 100))
    }

    tracker.costs = []

    return {
      success: true,
      importedCount,
      duplicateCount,
      skippedCount,
      errorCount: 0,
      message: `✅ ${importedCount} coût(s) importé(s). ${duplicateCount} doublon(s) ignoré(s). ${skippedCount} ligne(s) ignorée(s).`
    }
  } catch (err) {
    await rollbackImport(err.tracker || tracker)
    return {
      success: false,
      importedCount: 0,
      duplicateCount,
      skippedCount,
      errorCount: rows.length,
      message: `❌ Import annulé : ${err.message}`
    }
  }
}

// 4. Import ZIP Images
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
        const arrayBuffer = await zipEntry.async('arraybuffer')

        const bytes = new Uint8Array(arrayBuffer.slice(0, 12))
        const realMime = detectRealMimeType(bytes) || mimeType
        const realExt  = mimeToExt(realMime)
        const fullFileName = baseName + realExt

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
          }
        })

        const docId = uploadRes.data?.id
        if (!docId) {
          throw new Error(`GLPI n'a pas retourné d'ID pour ${fullFileName}`)
        }

        createdDocIds.push(docId)

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
          } catch (getErr) {
            console.warn('⚠️ Impossible de récupérer filepath via GET:', getErr.message)
          }
        }

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

        if (filepath) {
          const endpoint = matchedItem.type === 'Monitor'
            ? `${GLPI_URL}/Monitor/${matchedItem.id}`
            : `${GLPI_URL}/Computer/${matchedItem.id}`

          try {
            await axios.put(endpoint, {
              input: { picture_front: filepath }
            }, {
              headers: {
                'Content-Type': 'application/json',
                'App-Token':     APP_TOKEN,
                'Session-Token': sessionToken
              }
            })
          } catch (updateErr) {
            console.error('❌ Erreur mise à jour picture_front:', updateErr.response?.data || updateErr.message)
          }
        }

        importedCount++
        console.log('✅ Image', filename, 'associée à', matchedItem.type, matchedItem.id)

      } catch (uploadErr) {
        console.error('❌ Erreur upload', filename, ':', uploadErr.response?.data || uploadErr.message)

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

function detectRealMimeType(bytes) {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg'
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 &&
      bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png'
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 &&
      bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif'
  }
  if (bytes[0] === 0x52 && bytes[1] === 0x49 &&
      bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 &&
      bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp'
  }
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
    return 'image/bmp'
  }
  return null
}

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