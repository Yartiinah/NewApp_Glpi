// Services GLPI pour le Frontoffice (accès public)
import axios from 'axios'

const GLPI_URL  = import.meta.env.VITE_GLPI_URL
const APP_TOKEN = import.meta.env.VITE_GLPI_APP_TOKEN
const USER_TOKEN = import.meta.env.VITE_GLPI_USER_TOKEN

// Durée de session : 5 jours (en millisecondes)
const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000 // 432000000 ms

console.log('🔧 Configuration GLPI Frontoffice:')
console.log('  GLPI_URL:', GLPI_URL)

// Récupérer la session existante (celle du backoffice)
let sessionToken = localStorage.getItem('glpi_session_token')

// S'assurer que baseURL se termine sans slash pour que les chemins relatifs fonctionnent
const BASE_URL = GLPI_URL.endsWith('/') ? GLPI_URL.slice(0, -1) : GLPI_URL

export const glpiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json', 'App-Token': APP_TOKEN }
})

// Ajoute le Session-Token à chaque requête (depuis localStorage pour être synchro)
glpiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('glpi_session_token')
  if (token) {
    config.headers['Session-Token'] = token
  }
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
  const apiUrl = `${BASE_URL}/initSession`
  console.log('🔗 Appel API initSession (frontoffice):', apiUrl)
  
  try {
    // Utilise glpiClient (URL relative) pour passer par le proxy Vite
    const response = await glpiClient.get('initSession', {
      headers: {
        'App-Token': APP_TOKEN,
        'Authorization': `user_token ${USER_TOKEN}`
      }
    })
    sessionToken = response.data.session_token
    const expiryTime = Date.now() + SESSION_DURATION_MS
    localStorage.setItem('glpi_session_token', sessionToken)
    localStorage.setItem('glpi_session_expiry', expiryTime.toString())
    localStorage.removeItem('glpi_mock_mode')
    console.log('✅ Session GLPI initialisée (frontoffice), expire le', new Date(expiryTime).toLocaleString())
    return sessionToken
  } catch (err) {
    console.error('❌ Erreur connexion GLPI (frontoffice):', err.message)
    if (err.response?.status === 400) {
      console.error('⚠️ Vérifie que GLPI est accessible sur:', apiUrl)
    }
    throw err
  }
}

export async function ensureSession() {
  // Vérifier si la session existe et n'a pas expiré
  const expiry = localStorage.getItem('glpi_session_expiry')
  if (expiry && Date.now() > parseInt(expiry)) {
    console.log('🔄 Session expirée, renouvellement...')
    localStorage.removeItem('glpi_session_token')
    localStorage.removeItem('glpi_session_expiry')
    sessionToken = null
  }
  
  // Récupérer le token depuis localStorage (au cas où le backoffice l'aurait changé)
  const storedToken = localStorage.getItem('glpi_session_token')
  if (storedToken && storedToken !== sessionToken) {
    sessionToken = storedToken
    console.log('📦 Session synchronisée depuis le backoffice')
  }
  
  if (!sessionToken) {
    await initSessionWithUserToken()
  }
  return sessionToken
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
        params: extraParams,
        headers: {
          'Range': `${offset}-${offset + limit - 1}`
        }
      })
    } catch (err) {
      if (err.response?.status === 404) break
      console.error(`❌ fetchPaginated ${itemtype}:`, err.message)
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
  await ensureSession()
  try {
    return await fetchPaginated('Computer', { is_deleted: '0' })
  }
  catch (err) { 
    console.error('❌ getComputers:', err.message)
    return [] 
  }
}

// =============================================
// MONITEURS
// =============================================

export async function getMonitors() {
  await ensureSession()
  try {
    return await fetchPaginated('Monitor', { is_deleted: '0' })
  }
  catch (err) { 
    console.error('❌ getMonitors:', err.message)
    return [] 
  }
}

// =============================================
// TICKETS
// =============================================

export async function getAllTickets() {
  await ensureSession()
  try {
    return await fetchPaginated('Ticket', { is_deleted: '0' })
  }
  catch (err) { 
    console.error('❌ getAllTickets:', err.message)
    return [] 
  }
}

export async function createTicket(data) {
  await ensureSession()
  try {
    console.log('📝 Création ticket GLPI:', data.name)
    return (await glpiClient.post('/Ticket', { input: data })).data
  } catch (err) { 
    console.error('❌ createTicket:', err.response?.data || err.message)
    throw err 
  }
}

export async function updateTicketStatus(ticketId, newStatus, comment = '') {
  await ensureSession()
  try {
    const payload = {
      input: {
        id: ticketId,
        status: newStatus
      }
    }
    
    if (comment) {
      await glpiClient.post('/ITILFollowup', {
        input: {
          itemtype: 'Ticket',
          items_id: ticketId,
          content: comment
        }
      })
    }
    
    return (await glpiClient.put(`/Ticket/${ticketId}`, payload)).data
  } catch (err) { 
    console.error('❌ updateTicketStatus:', err.response?.data || err.message)
    throw err 
  }
}

export async function getTicketById(ticketId) {
  await ensureSession()
  try {
    const res = await glpiClient.get(`/Ticket/${ticketId}`)
    return res.data
  } catch (err) {
    console.error('❌ getTicketById:', err.message)
    throw err
  }
}

// =============================================
// ÉLÉMENTS MIXTES (avec images)
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

    for (const link of validLinks) {
      const docId = link.documents_id || link.id
      try {
        const docRes = await glpiClient.get(`/Document/${docId}`)
        const doc = docRes.data
        const fn = (doc?.filename || '').toLowerCase()
        const isImage = imageExts.some(ext => fn.endsWith(ext)) ||
                        (doc?.mime || '').startsWith('image/')
        if (!isImage) continue

        const filepath = doc?.filepath || ''
        if (filepath) {
          const glpiBase = import.meta.env.VITE_GLPI_URL || ''
          const directUrl = `${glpiBase}/Document/${docId}?alt=media`
          console.log(`🖼️ Document trouvé pour ${itemtype} ${id}: ${directUrl}`)
          return directUrl
        }
      } catch { /* document inaccessible */ }
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
// UTILISATEURS
// =============================================

export async function getUsers() {
  await ensureSession()
  try {
    return await fetchPaginated('User', { is_deleted: '0' })
  } catch (err) {
    console.error('❌ getUsers (frontoffice):', err.message)
    return []
  }
}

// =============================================
// LIENS ET COÛTS
// =============================================

export async function linkItemToTicket(ticketId, itemtype, itemId) {
  await ensureSession()
  try {
    return (await glpiClient.post('/Item_Ticket', {
      input: { tickets_id: ticketId, itemtype, items_id: itemId }
    })).data
  } catch (err) { 
    console.error('❌ linkItemToTicket:', err.message)
    throw err 
  }
}

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
  } catch (err) { 
    console.error('❌ addTicketCost:', err.message)
    throw err 
  }
}

export async function getTicketCosts(ticketId) {
  await ensureSession()
  try {
    const res = await glpiClient.get(`/TicketCost`, {
      params: { 'tickets_id': ticketId, is_deleted: '0' }
    })
    let costs = res.data
    if (!Array.isArray(costs)) costs = Object.values(costs || {})
    return costs.filter(c => c && typeof c.id === 'number')
  } catch (err) {
    console.error('❌ getTicketCosts:', err.message)
    return []
  }
}

export async function getTicketLinkedItems(ticketId) {
  await ensureSession()
  try {
    const res = await glpiClient.get(`/Item_Ticket`, {
      params: { tickets_id: ticketId, is_deleted: '0' }
    })
    let items = res.data
    if (!Array.isArray(items)) items = Object.values(items || {})
    return items.filter(i => i && typeof i.id === 'number')
  } catch (err) {
    console.error('❌ getTicketLinkedItems:', err.message)
    return []
  }
}