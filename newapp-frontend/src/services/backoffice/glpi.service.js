import axios from 'axios'
import { isMockActive, getMockData, setMockData } from './glpi.mock'

const GLPI_URL  = import.meta.env.VITE_GLPI_URL
const APP_TOKEN = import.meta.env.VITE_GLPI_APP_TOKEN

const BASE_URL = GLPI_URL.endsWith('/') ? GLPI_URL.slice(0, -1) : GLPI_URL

export const glpiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json', 'App-Token': APP_TOKEN }
})

const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000

let sessionToken = null

const savedToken  = localStorage.getItem('glpi_session_token')
const savedExpiry = localStorage.getItem('glpi_session_expiry')
if (savedToken && savedExpiry && Date.now() < parseInt(savedExpiry)) {
  sessionToken = savedToken
}

glpiClient.interceptors.request.use(config => {
  if (sessionToken) config.headers['Session-Token'] = sessionToken
  return config
})

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
    const response = await glpiClient.get('initSession', {
      headers: {
        'Content-Type': 'application/json',
        'App-Token': APP_TOKEN,
        'Authorization': `user_token ${USER_TOKEN}`
      }
    })
    sessionToken = response.data.session_token
    localStorage.setItem('glpi_session_token', sessionToken)
    const expiryTime = Date.now() + SESSION_DURATION_MS
    localStorage.setItem('glpi_session_expiry', expiryTime.toString())
    localStorage.removeItem('glpi_mock_mode')
    console.log('✅ Session GLPI initialisée, expire le', new Date(expiryTime).toLocaleString())
    return sessionToken
  } catch (err) {
    console.error('❌ Erreur connexion GLPI:', err.message)
    throw err
  }
}

export async function ensureSession() {
  const expiry = localStorage.getItem('glpi_session_expiry')
  if (expiry && Date.now() > parseInt(expiry)) {
    console.log('🔄 Session expirée, renouvellement...')
    localStorage.removeItem('glpi_session_token')
    localStorage.removeItem('glpi_session_expiry')
    sessionToken = null
  }
  if (!sessionToken) await initSessionWithUserToken()
}

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
        headers: { 'Range': `${offset}-${offset + limit - 1}` }
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
  } catch (err) { 
    console.error('❌ getTickets:', err.message)
    return [] 
  }
}

export async function getTicket(id) {
  await ensureSession()
  try { return (await glpiClient.get(`/Ticket/${id}`)).data }
  catch (err) { console.error('❌ getTicket:', err.message); throw err }
}

export async function createTicket(data) {
  if (isMockActive()) {
    const list = getMockData('tickets')
    const newId = list.length ? Math.max(...list.map(t => t.id)) + 1 : 1
    const newTicket = {
      id: newId,
      name: data.name,
      content: data.content,
      status: data.status || 1,
      priority: data.priority || 3,
      date_creation: new Date().toISOString().replace('T', ' ').substring(0, 19),
      is_deleted: 0
    }
    list.unshift(newTicket)
    setMockData('tickets', list)
    return { id: newId }
  }
  await ensureSession()
  try {
    console.log('📝 Création ticket GLPI:', data.name)
    return (await glpiClient.post('/Ticket', { input: data })).data
  } catch (err) { 
    console.error('❌ createTicket:', err.response?.data || err.message)
    throw err 
  }
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

export async function updateTicketStatus(id, status, comment = '') {
  await ensureSession()
  try {
    const payload = { input: { id: id, status: status } }
    if (comment) {
      await glpiClient.post('/ITILFollowup', {
        input: { itemtype: 'Ticket', items_id: id, content: comment }
      })
    }
    return (await glpiClient.put(`/Ticket/${id}`, payload)).data
  } catch (err) { 
    console.error('❌ updateTicketStatus:', err.response?.data || err.message)
    throw err 
  }
}

export function extractTicketRef(content) {
  if (!content) return null
  const match = content.match(/<!-- REF_TICKET:(.*?) -->/)
  return match ? match[1].trim() : null
}

// =============================================
// ORDINATEURS
// =============================================

export async function getComputers() {
  if (isMockActive()) return getMockData('computers').filter(c => !c.is_deleted)
  await ensureSession()
  try {
    return await fetchPaginated('Computer', { is_deleted: '0' })
  }
  catch (err) { 
    console.error('❌ getComputers:', err.message)
    return [] 
  }
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
    list.push(item)
    setMockData('computers', list)
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
  } catch (err) { 
    console.error('❌ createComputer:', err.response?.data || err.message)
    throw err 
  }
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
    return await fetchPaginated('Monitor', { is_deleted: '0' })
  }
  catch (err) { 
    console.error('❌ getMonitors:', err.message)
    return [] 
  }
}

export async function createMonitor(data) {
  if (isMockActive()) {
    const list = getMockData('monitors')
    const id = list.length ? Math.max(...list.map(m => m.id)) + 1 : 201
    const item = { id, ...data, is_deleted: 0 }
    list.push(item)
    setMockData('monitors', list)
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
  } catch (err) { 
    console.error('❌ createMonitor:', err.response?.data || err.message)
    throw err 
  }
}

export async function deleteMonitor(id, forcePurge = false) {
  await ensureSession()
  try {
    return (await glpiClient.delete(`/Monitor/${id}`, { params: forcePurge ? { force_purge: 1 } : {} })).data
  } catch (err) { console.error('❌ deleteMonitor:', err.message); throw err }
}

// =============================================
// TÉLÉPHONES
// =============================================

export async function getPhones() {
  if (isMockActive()) return getMockData('phones')?.filter(p => !p.is_deleted) || []
  await ensureSession()
  try {
    return await fetchPaginated('Phone', { is_deleted: '0' })
  }
  catch (err) { 
    console.error('❌ getPhones:', err.message)
    return [] 
  }
}

// =============================================
// UTILISATEURS
// =============================================

export async function getUsers() {
  if (isMockActive()) return getMockData('users').filter(u => !u.is_deleted)
  await ensureSession()
  try {
    return await fetchPaginated('User', { is_deleted: '0' })
  } catch (err) { 
    console.error('❌ getUsers:', err.message)
    return [] 
  }
}

export async function getUser(id) {
  await ensureSession()
  try { return (await glpiClient.get(`/User/${id}`)).data }
  catch (err) { console.error('❌ getUser:', err.message); throw err }
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
    list.push(user)
    setMockData('users', list)
    return user
  }
  await ensureSession()
  try {
    console.log('📝 Création user GLPI:', data.name)
    const payload = { name: data.name }
    if (data.realname) payload.realname = data.realname
    return (await glpiClient.post('/User', { input: payload })).data
  } catch (err) { 
    console.error('❌ createUser:', err.response?.data || err.message)
    throw err 
  }
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
// LOOKUP TABLES
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
  if (existing) { 
    lookupCaches[itemtype][n] = existing.id
    return { id: existing.id, created: false }
  }
  await ensureSession()
  try {
    const res = await glpiClient.post(`/${itemtype}`, { input: { name: name.trim() } })
    const id = res.data?.id
    if (id) { 
      lookupCaches[itemtype][n] = id
      if (lookupListCaches[itemtype]) lookupListCaches[itemtype].push({ id, name: name.trim() })
    }
    return { id: id || null, created: true }
  } catch (err) {
    console.error(`❌ Création lookup ${itemtype}/${name} échouée:`, err.message)
    return { id: null, created: false }
  }
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
// LIENS ET COÛTS
// =============================================

export async function linkItemToTicket(ticketId, itemtype, itemId) {
  await ensureSession()
  try {
    return (await glpiClient.post('/Item_Ticket', {
      input: { tickets_id: ticketId, itemtype: itemtype, items_id: itemId }
    })).data
  } catch (err) { 
    console.error('❌ linkItemToTicket:', err.message)
    throw err 
  }
}

export async function addTicketCost(ticketId, costData) {
  if (isMockActive()) {
    const costs = getMockData('ticket_costs')
    if (!costs[ticketId]) costs[ticketId] = []
    const newId = Math.floor(Math.random() * 1000)
    costs[ticketId].push({
      id: newId,
      name: costData.name || 'Coût CSV',
      actiontime: costData.actiontime || 0,
      cost_time: costData.cost_time || 0,
      cost_fixed: costData.cost_fixed || 0
    })
    setMockData('ticket_costs', costs)
    return { id: newId }
  }

  await ensureSession()
  try {
    const actiontime = costData.actiontime || 0
    const costTime = costData.cost_time || 0
    const costFixed = costData.cost_fixed || 0
    const name = costData.name || 'Coût CSV'
    
    console.log(`💰 Ajout coût ticket ${ticketId}: actiontime=${actiontime}s, cost_time=${costTime}, cost_fixed=${costFixed}`)
    
    const res = await glpiClient.post('/TicketCost', {
      input: {
        tickets_id: parseInt(ticketId),
        name: name,
        actiontime: parseInt(actiontime),
        cost_time: parseFloat(costTime),
        cost_fixed: parseFloat(costFixed)
      }
    })
    console.log('✅ Coût ajouté avec succès:', res.data)
    return res.data
  } catch (err) { 
    console.error('❌ addTicketCost:', err.response?.data || err.message)
    throw err 
  }
}

export async function getTicketCosts(ticketId) {
  if (isMockActive()) {
    const costs = getMockData('ticket_costs')
    return costs[ticketId] || []
  }
  await ensureSession()
  try { 
    const res = await glpiClient.get(`/Ticket/${ticketId}/TicketCost`)
    return normalizeGlpiResponse(res.data)
  } catch { 
    return [] 
  }
}

export async function deleteTicketCost(id) {
  await ensureSession()
  try { 
    return (await glpiClient.delete(`/TicketCost/${id}`, { params: { force_purge: '1' } })).data 
  }
  catch (err) { 
    console.error('❌ deleteTicketCost:', err.message)
    throw err 
  }
}

export async function getTicketItems(ticketId) {
  await ensureSession()
  try { 
    const res = await glpiClient.get(`/Ticket/${ticketId}/Item_Ticket`)
    return normalizeGlpiResponse(res.data)
  }
  catch { 
    return [] 
  }
}

export async function deleteItemTicket(id) {
  await ensureSession()
  try { 
    return (await glpiClient.delete(`/Item_Ticket/${id}`, { params: { force_purge: '1' } })).data 
  }
  catch (err) { 
    console.error('❌ deleteItemTicket:', err.message)
    throw err 
  }
}

export function disableMockMode() {
  localStorage.removeItem('glpi_mock_mode')
  localStorage.removeItem('glpi_session_token')
  localStorage.removeItem('glpi_session_expiry')
  sessionToken = null
  console.log('✅ Mode Mock désactivé')
}

export default glpiClient