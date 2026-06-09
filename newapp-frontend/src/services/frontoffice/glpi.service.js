// Services GLPI pour le Frontoffice (accès public)
// Ces fonctions sont utilisées par les vues frontoffice sans authentification requise

import axios from 'axios'
import { isMockActive, getMockData } from '../backoffice/glpi.mock'

const GLPI_URL  = import.meta.env.VITE_GLPI_URL
const APP_TOKEN = import.meta.env.VITE_GLPI_APP_TOKEN

export const glpiClient = axios.create({
  baseURL: GLPI_URL,
  headers: { 'Content-Type': 'application/json', 'App-Token': APP_TOKEN }
})

let sessionToken = null

// Restaure la session depuis localStorage si encore valide
const savedToken  = localStorage.getItem('glpi_session_token')
const savedExpiry = localStorage.getItem('glpi_session_expiry')
if (savedToken && savedExpiry && Date.now() < parseInt(savedExpiry)) {
  sessionToken = savedToken
}

// Ajoute le Session-Token à chaque requête
glpiClient.interceptors.request.use(config => {
  if (sessionToken) config.headers['Session-Token'] = sessionToken
  return config
})

// =============================================
// SESSION GLPI
// =============================================

let sessionInitPromise = null

export async function initSessionWithUserToken() {
  if (sessionInitPromise) return sessionInitPromise
  sessionInitPromise = _doInitSession()
  try {
    const result = await sessionInitPromise
    return result
  } finally {
    sessionInitPromise = null
  }
}

async function _doInitSession() {
  const USER_TOKEN = import.meta.env.VITE_GLPI_USER_TOKEN
  try {
    const response = await axios.get(`${GLPI_URL}/initSession`, {
      headers: {
        'Content-Type': 'application/json',
        'App-Token': APP_TOKEN,
        'Authorization': `user_token ${USER_TOKEN}`
      }
    })
    sessionToken = response.data.session_token
    localStorage.setItem('glpi_session_token', sessionToken)
    localStorage.setItem('glpi_session_expiry', (Date.now() + 3600000).toString())
    localStorage.removeItem('glpi_mock_mode')
    console.log('✅ Session GLPI initialisée')
    return sessionToken
  } catch (err) {
    console.error('❌ Erreur connexion GLPI:', err.message)
    throw err
  }
}

export async function ensureSession() {
  if (!sessionToken) await initSessionWithUserToken()
}

// =============================================
// PAGINATION
// =============================================
function normalizeGlpiResponse(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  const values = Object.values(data)
  return values.filter(v => v && typeof v === 'object' && 'id' in v)
}

export async function fetchPaginated(itemtype, extraParams = {}) {
  await ensureSession()
  let all = []
  let offset = 0
  const limit = 100

  while (true) {
    let res
    try {
      res = await glpiClient.get(`/${itemtype}`, {
        params: { range: `${offset}-${offset + limit - 1}`, ...extraParams }
      })
    } catch (err) {
      if (err.response?.status === 404) break
      throw err
    }

    const items = normalizeGlpiResponse(res.data)
    if (items.length === 0) break
    all = all.concat(items)
    if (items.length < limit) break
    offset += limit
  }

  return all
}

// =============================================
// ORDINATEURS
// =============================================

export async function getComputers() {
  if (isMockActive()) return getMockData('computers').filter(c => !c.is_deleted)
  await ensureSession()
  try {
    return await fetchPaginated('Computer', {
      is_deleted: '0',
      'forcedisplay[0]': 80,
    })
  }
  catch (err) { console.error('❌ getComputers:', err.message); throw err }
}

// =============================================
// MONITEURS
// =============================================

export async function getMonitors() {
  if (isMockActive()) return getMockData('monitors').filter(m => !m.is_deleted)
  await ensureSession()
  try {
    return await fetchPaginated('Monitor', {
      is_deleted: '0',
      'forcedisplay[0]': 80,
    })
  }
  catch (err) { console.error('❌ getMonitors:', err.message); throw err }
}

// =============================================
// TICKETS
// =============================================

export async function createTicket(data) {
  await ensureSession()
  try {
    console.log('📝 Création ticket GLPI:', data.name)
    return (await glpiClient.post('/Ticket', { input: data })).data
  } catch (err) { console.error('❌ createTicket:', err.response?.data || err.message); throw err }
}

// =============================================
// ÉLÉMENTS MIXTES
// =============================================

function extractCSVInfo(comment) {
  if (!comment) return { status: 'N/A', location: 'N/A', manufacturer: 'N/A', model: 'N/A' }
  const get = (regex) => (comment.match(regex)?.[1] || 'N/A').trim()
  return {
    status:       get(/Status:\s*([^.]*)/),
    location:     get(/Localisation:\s*([^.]*)/),
    manufacturer: get(/Fabricant:\s*([^.]*)/),
    model:        get(/Modèle:\s*([^.]*)/)
  }
}

async function fetchDocumentFilepath(itemtype, id) {
  try {
    const linksRes = await glpiClient.get(`/${itemtype}/${id}/Document_Item`)
    let links = linksRes.data
    if (!Array.isArray(links)) links = Object.values(links || {})
    const validLinks = links.filter(l => l && typeof l.id === 'number')
    if (validLinks.length === 0) return null

    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
    const base = import.meta.env.VITE_GLPI_URL?.replace('/apirest.php', '') || ''

    for (const link of validLinks) {
      const docId = link.documents_id || link.id
      try {
        const docRes = await glpiClient.get(`/Document/${docId}`)
        const doc    = docRes.data
        const fn     = (doc?.filename || '').toLowerCase()
        const isImage = imageExts.some(ext => fn.endsWith(ext)) ||
                        (doc?.mime || '').startsWith('image/')
        if (!isImage) continue

        const filepath = doc?.filepath || ''
        if (filepath) {
          const glpiBase = import.meta.env.VITE_GLPI_URL || ''
          const directUrl = `${glpiBase}/Document/${docId}?alt=media`
          console.log(`🖼️ Document trouvé pour ${itemtype} ${id}: docId=${docId} filename=${doc.filename} url=${directUrl}`)
          return directUrl
        }
      } catch { /* document inaccessible, on continue */ }
    }
    return null
  } catch (err) {
    const status = err.response?.status
    if (status === 404) return null
    console.warn(`⚠️ fetchDocumentFilepath ${itemtype}/${id}:`, err.message)
    return null
  }
}

export async function getAllItems() {
  const [computers, monitors] = await Promise.all([
    getComputers().catch(() => []),
    getMonitors().catch(() => [])
  ])

  const fmt = (items, type) => (Array.isArray(items) ? items : []).map(item => {
    const info = extractCSVInfo(item.comment)
    return {
      id: item.id,
      name: item.name || `${type} #${item.id}`,
      itemtype: type,
      status: info.status,
      location: info.location,
      manufacturer: info.manufacturer,
      model: info.model,
      inventory_number: item.otherserial || item.serial || 'N/A',
      picture_front: null
    }
  })

  const allItems = [...fmt(computers, 'Computer'), ...fmt(monitors, 'Monitor')]

  console.log(`🔍 Récupération des images pour ${allItems.length} item(s)...`)
  await Promise.all(
    allItems.map(async item => {
      item.picture_front = await fetchDocumentFilepath(item.itemtype, item.id)
    })
  )

  const withImg = allItems.filter(i => i.picture_front).length
  console.log(`🖼️ ${withImg}/${allItems.length} item(s) avec image`)

  return allItems
}

// =============================================
// LIENS
// =============================================

export async function linkItemToTicket(ticketId, itemtype, itemId) {
  await ensureSession()
  try {
    return (await glpiClient.post('/Item_Ticket', {
      input: { tickets_id: ticketId, itemtype, items_id: itemId }
    })).data
  } catch (err) { console.error('❌ linkItemToTicket:', err.message); throw err }
}

// =============================================
// COÛTS
// =============================================

export async function addTicketCost(ticketId, costData) {
  await ensureSession()
  try {
    return (await glpiClient.post('/TicketCost', {
      input: {
        tickets_id: ticketId,
        name: 'Coût Frontoffice',
        duration:   costData.duration   || 0,
        cost_time:  costData.cost_time  || 0,
        cost_fixed: costData.cost_fixed || 0
      }
    })).data
  } catch (err) { console.error('❌ addTicketCost:', err.message); throw err }
}
