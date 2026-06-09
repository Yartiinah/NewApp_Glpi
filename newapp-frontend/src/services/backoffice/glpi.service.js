import axios from 'axios'
import { isMockActive, getMockData, setMockData } from './glpi.mock'

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

// Renouvelle la session automatiquement si erreur 401
glpiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        await initSessionWithUserToken()
        originalRequest.headers['Session-Token'] = sessionToken
        return glpiClient(originalRequest)
      } catch (initErr) {
        return Promise.reject(initErr)
      }
    }
    return Promise.reject(error)
  }
)

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
// PAGINATION — CORRECTION PRINCIPALE
// GLPI peut renvoyer un tableau OU un objet numéroté {0:{...}, 1:{...}}
// On normalise toujours en tableau avant de traiter.
// =============================================
function normalizeGlpiResponse(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  // GLPI retourne parfois un objet avec des clés numériques
  const values = Object.values(data)
  // Filtre les entrées de metadata GLPI (ex: {count: 5} sans "id")
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
      // 404 = table vide ou inexistante → retourne tableau vide
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

export async function forceDeleteItem(itemtype, id) {
  await ensureSession()
  return glpiClient.delete(`/${itemtype}/${id}`, { params: { force_purge: '1' } })
}

// =============================================
// TICKETS
// =============================================

export async function getTickets() {
  if (isMockActive()) return getMockData('tickets').filter(t => !t.is_deleted)
  await ensureSession()
  try {
    return await fetchPaginated('Ticket', { sort: 'id', order: 'DESC', is_deleted: '0' })
  } catch (err) { console.error('❌ getTickets:', err.message); throw err }
}

export async function getTicket(id) {
  await ensureSession()
  try { return (await glpiClient.get(`/Ticket/${id}`)).data }
  catch (err) { console.error('❌ getTicket:', err.message); throw err }
}


export async function deleteTicket(id, forcePurge = false) {
  await ensureSession()
  try {
    return (await glpiClient.delete(`/Ticket/${id}`, { params: forcePurge ? { force_purge: 1 } : {} })).data
  } catch (err) { console.error('❌ deleteTicket:', err.message); throw err }
}

export async function updateTicket(id, data) {
  await ensureSession()
  try {
    console.log('📝 Mise à jour ticket GLPI:', id, data)
    return (await glpiClient.put(`/Ticket/${id}`, { input: data })).data
  } catch (err) { console.error('❌ updateTicket:', err.response?.data || err.message); throw err }
}

export function extractTicketRef(content) {
  if (!content) return null
  const match = content.match(/<!--\s*REF_TICKET:([^>]+)\s*-->/)
  return match ? match[1].trim() : null
}

// =============================================
// ORDINATEURS
// =============================================

export async function getComputers() {
  if (isMockActive()) return getMockData('computers').filter(c => !c.is_deleted)
  await ensureSession()
  try {
    // forcedisplay force GLPI à retourner le champ picture_front dans la liste
    return await fetchPaginated('Computer', {
      is_deleted: '0',
      'forcedisplay[0]': 80,   // id du champ picture_front dans GLPI
    })
  }
  catch (err) { console.error('❌ getComputers:', err.message); throw err }
}

export async function getComputer(id) {
  await ensureSession()
  try { return (await glpiClient.get(`/Computer/${id}`)).data }
  catch (err) { console.error('❌ getComputer:', err.message); throw err }
}

export async function createComputer(data) {
  if (isMockActive()) {
    const list = getMockData('computers')
    const id = list.length ? Math.max(...list.map(c => c.id)) + 1 : 101
    const item = { id, ...data, is_deleted: 0 }
    list.push(item); setMockData('computers', list)
    return item
  }
  await ensureSession()
  try {
    console.log('📝 Création ordinateur GLPI:', data.name)
    const payload = { name: data.name }
    if (data.serial) payload.serial = data.serial
    if (data.otherserial) payload.otherserial = data.otherserial
    if (data.comment) payload.comment = data.comment
    if (data.states_id) payload.states_id = data.states_id
    if (data.locations_id) payload.locations_id = data.locations_id
    if (data.manufacturers_id) payload.manufacturers_id = data.manufacturers_id
    if (data.computermodels_id) payload.computermodels_id = data.computermodels_id
    if (data.users_id) payload.users_id = data.users_id
    return (await glpiClient.post('/Computer', { input: payload })).data
  } catch (err) { console.error('❌ createComputer:', err.response?.data || err.message); throw err }
}

export async function deleteComputer(id, forcePurge = false) {
  await ensureSession()
  try {
    return (await glpiClient.delete(`/Computer/${id}`, { params: forcePurge ? { force_purge: 1 } : {} })).data
  } catch (err) { console.error('❌ deleteComputer:', err.message); throw err }
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
// TÉLÉPHONES
// =============================================

export async function getPhones() {
  if (isMockActive()) return getMockData('phones')?.filter(p => !p.is_deleted) || []
  await ensureSession()
  try {
    return await fetchPaginated('Phone', {
      is_deleted: '0',
      'forcedisplay[0]': 80,
    })
  }
  catch (err) { console.error('❌ getPhones:', err.message); throw err }
}

export async function createMonitor(data) {
  if (isMockActive()) {
    const list = getMockData('monitors')
    const id = list.length ? Math.max(...list.map(m => m.id)) + 1 : 201
    const item = { id, ...data, is_deleted: 0 }
    list.push(item); setMockData('monitors', list)
    return item
  }
  await ensureSession()
  try {
    console.log('📝 Création moniteur GLPI:', data.name)
    const payload = { name: data.name }
    if (data.serial) payload.serial = data.serial
    if (data.otherserial) payload.otherserial = data.otherserial
    if (data.comment) payload.comment = data.comment
    if (data.states_id) payload.states_id = data.states_id
    if (data.locations_id) payload.locations_id = data.locations_id
    if (data.manufacturers_id) payload.manufacturers_id = data.manufacturers_id
    if (data.monitormodels_id) payload.monitormodels_id = data.monitormodels_id
    if (data.users_id) payload.users_id = data.users_id
    return (await glpiClient.post('/Monitor', { input: payload })).data
  } catch (err) { console.error('❌ createMonitor:', err.response?.data || err.message); throw err }
}

export async function deleteMonitor(id, forcePurge = false) {
  await ensureSession()
  try {
    return (await glpiClient.delete(`/Monitor/${id}`, { params: forcePurge ? { force_purge: 1 } : {} })).data
  } catch (err) { console.error('❌ deleteMonitor:', err.message); throw err }
}

// =============================================
// UTILISATEURS
// =============================================

export async function getUsers() {
  if (isMockActive()) return getMockData('users').filter(u => !u.is_deleted)
  await ensureSession()
  try {
    return await fetchPaginated('User', { is_deleted: '0' })
  } catch (err) { console.error('❌ getUsers:', err.message); throw err }
}

export async function createUser(data) {
  if (isMockActive()) {
    const list = getMockData('users')
    const existing = list.find(u =>
      u.name?.toLowerCase() === data.name?.toLowerCase() ||
      u.realname?.toLowerCase() === data.realname?.toLowerCase()
    )
    if (existing) return { id: existing.id }
    const id = list.length ? Math.max(...list.map(u => u.id)) + 1 : 2
    const user = { id, name: data.name, realname: data.realname || data.name, is_deleted: 0 }
    list.push(user); setMockData('users', list)
    return user
  }
  await ensureSession()
  try {
    console.log('📝 Création user GLPI:', data.name)
    const payload = { name: data.name }
    if (data.realname) payload.realname = data.realname
    return (await glpiClient.post('/User', { input: payload })).data
  } catch (err) { console.error('❌ createUser:', err.response?.data || err.message); throw err }
}

export async function deleteUser(id) {
  await ensureSession()
  try {
    return (await glpiClient.delete(`/User/${id}`)).data
  } catch (err) {
    console.warn(`⚠️ deleteUser ${id}:`, err.message)
    return { success: false, skipped: true }
  }
}

// =============================================
// LOOKUP TABLES (State, Location, Manufacturer, Model)
// =============================================

const lookupCaches = { State: {}, Location: {}, Manufacturer: {}, ComputerModel: {}, MonitorModel: {} }
const lookupListCaches = {}

export function clearLookupCaches() {
  Object.keys(lookupCaches).forEach(k => { lookupCaches[k] = {} })
  Object.keys(lookupListCaches).forEach(k => { delete lookupListCaches[k] })
}

async function getLookupList(itemtype) {
  if (!lookupListCaches[itemtype]) {
    lookupListCaches[itemtype] = await fetchPaginated(itemtype, { is_deleted: '0' })
  }
  return lookupListCaches[itemtype]
}

const norm = v => (v || '').trim().toLowerCase()

async function findOrCreateLookup(itemtype, name) {
  const n = norm(name)
  if (!n) return { id: null, created: false }
  if (lookupCaches[itemtype][n]) return { id: lookupCaches[itemtype][n], created: false }
  const list = await getLookupList(itemtype)
  const existing = list.find(i => norm(i.name) === n)
  if (existing) { lookupCaches[itemtype][n] = existing.id; return { id: existing.id, created: false } }
  await ensureSession()
  const res = await glpiClient.post(`/${itemtype}`, { input: { name: name.trim() } })
  const id = res.data?.id
  if (id) { lookupCaches[itemtype][n] = id; if (lookupListCaches[itemtype]) lookupListCaches[itemtype].push({ id, name: name.trim() }) }
  return { id: id || null, created: true }
}

const STATE_ALIASES = {
  'en production': ['en production', 'en service', 'actif', 'production'],
  'maintenance':   ['maintenance', 'en maintenance'],
  'en stock':      ['en stock', 'stock'],
  'en panne':      ['en panne', 'panne', 'hors service']
}

export async function resolveStateId(statusName) {
  if (!statusName?.trim()) return null
  const n = norm(statusName)
  const states = await getLookupList('State')
  let matched = states.find(s => norm(s.name) === n)
  if (!matched) {
    for (const [canonical, aliases] of Object.entries(STATE_ALIASES)) {
      if (aliases.some(a => n.includes(a) || a.includes(n))) {
        matched = states.find(s => norm(s.name).includes(canonical) || canonical.includes(norm(s.name)))
        if (matched) break
      }
    }
  }
  if (matched) return { id: matched.id, created: false }
  return findOrCreateLookup('State', statusName.trim())
}

export async function resolveLocationId(name)      { return findOrCreateLookup('Location', name) }
export async function resolveManufacturerId(name)  { return findOrCreateLookup('Manufacturer', name) }
export async function resolveComputerModelId(name) { return findOrCreateLookup('ComputerModel', name) }
export async function resolveMonitorModelId(name)  { return findOrCreateLookup('MonitorModel', name) }

export async function countItems(itemtype, extraParams = {}) {
  const items = await fetchPaginated(itemtype, extraParams)
  return items.length
}

// =============================================
// ÉLÉMENTS MIXTES
// =============================================


// =============================================
// LIENS ET COÛTS
// =============================================


export async function addTicketCost(ticketId, costData) {
  await ensureSession()
  try {
    return (await glpiClient.post('/TicketCost', {
      input: {
        tickets_id: ticketId,
        name: 'Coût CSV',
        duration:   costData.duration   || 0,
        cost_time:  costData.cost_time  || 0,
        cost_fixed: costData.cost_fixed || 0
      }
    })).data
  } catch (err) { console.error('❌ addTicketCost:', err.message); throw err }
}

export async function getTicketCosts(ticketId) {
  await ensureSession()
  try { return (await glpiClient.get(`/Ticket/${ticketId}/TicketCost`)).data }
  catch { return [] }
}

export async function deleteTicketCost(id) {
  await ensureSession()
  try { return (await glpiClient.delete(`/TicketCost/${id}`, { params: { force_purge: '1' } })).data }
  catch (err) { console.error('❌ deleteTicketCost:', err.message); throw err }
}

export async function getTicketItems(ticketId) {
  await ensureSession()
  try { return (await glpiClient.get(`/Ticket/${ticketId}/Item_Ticket`)).data }
  catch { return [] }
}

export async function deleteItemTicket(id) {
  await ensureSession()
  try { return (await glpiClient.delete(`/Item_Ticket/${id}`, { params: { force_purge: '1' } })).data }
  catch (err) { console.error('❌ deleteItemTicket:', err.message); throw err }
}

export function disableMockMode() {
  localStorage.removeItem('glpi_mock_mode')
}

export default glpiClient