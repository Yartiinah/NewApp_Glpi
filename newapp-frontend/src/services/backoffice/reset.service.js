import { glpiClient, ensureSession } from './glpi.service'

// Ordre de suppression : dépendances d'abord, puis assets, puis lookups, puis users
const TABLES_TO_DELETE = [
  // Phase 1 : ITIL (dépendances d'abord)
  'TicketCost',
  'Item_Ticket',
  'Ticket',
  'Problem',
  'Change',
  // Phase 2 : Assets
  'SoftwareVersion',
  'Software',
  'SoftwareLicense',
  'Computer',
  'Monitor',
  'NetworkEquipment',
  'Printer',
  'Phone',
  'Peripheral',
  'Rack',
  'Enclosure',
  'PDU',
  'PassiveDCEquipment',
  'Unmanaged',
  // Phase 2.5 : Composants
  'DeviceCamera',
  'DeviceGraphicCard',
  'DeviceNetworkCard',
  'DeviceSoundCard',
  'DeviceDrive',
  'DevicePci',
  'DevicePowerSupply',
  'DeviceBattery',
  'DeviceCase',
  'DeviceSensor',
  'DeviceSimcard',
  'DeviceMotherboard',
  'DeviceGeneric',
  'DeviceControl',
  'DeviceHardDrive',
  'DeviceFirmware',
  'DeviceMemory',
  'DeviceProcessor',
  // Phase 3 : Documents (liens d'abord, puis documents)
  'Document_Item',
  'Document',
  // Lookups (après assets)
  'ComputerModel',
  'MonitorModel',
  'Manufacturer',
  'Location',
  'State',
  // Users en dernier
  'User'
]

// IDs système GLPI à ne jamais supprimer
const SYSTEM_USER_IDS = new Set([2, 6])
const SYSTEM_DOCUMENT_IDS = new Set() // Ajoutez ici les IDs de documents système si nécessaire

/**
 * Récupère tous les IDs d'un itemtype — actifs ET en corbeille.
 * On passe is_deleted=2 qui est le "joker" GLPI = tous les items.
 * Si GLPI ne supporte pas is_deleted=2, on fait deux appels séparés (0 puis 1).
 */
async function fetchAllIds(itemtype) {
  const ids = new Set()

  // Passe 1 : items actifs (is_deleted=0)
  await collectIds(itemtype, 0, ids)

  // Passe 2 : items en corbeille (is_deleted=1)
  // Indispensable car DELETE sans force_purge met en corbeille
  await collectIds(itemtype, 1, ids)

  return [...ids]
}

async function collectIds(itemtype, isDeleted, idSet) {
  let start = 0
  const pageSize = 50

  while (true) {
    let res
    try {
      res = await glpiClient.get(`/${itemtype}`, {
        params: {
          range: `${start}-${start + pageSize - 1}`,
          only_id: true,
          is_deleted: isDeleted
        }
      })
    } catch (err) {
      const status = err.response?.status
      // 404 = table vide ou inexistante, 400 = non supporté → on arrête proprement
      if (status === 404 || status === 400) return
      throw err
    }

    // Normalise : GLPI peut renvoyer un tableau OU un objet numéroté
    let page = res.data
    if (!Array.isArray(page)) page = Object.values(page || {})

    const valid = page.filter(item => item && typeof item.id === 'number')
    if (valid.length === 0) break

    valid.forEach(item => idSet.add(item.id))
    if (valid.length < pageSize) break
    start += pageSize
  }
}

/**
 * Supprime un item de façon définitive avec force_purge=1 directement.
 * Plus besoin de double tentative : on purge directement.
 */
async function deleteOne(itemtype, id) {
  try {
    // force_purge=1 : supprime définitivement sans passer par la corbeille
    await glpiClient.delete(`/${itemtype}/${id}`, {
      params: { force_purge: 1 }
    })
    return true
  } catch (err) {
    const status = err.response?.status
    // 404 = déjà supprimé → succès
    if (status === 404) return true
    // 400 sur tables de liens → on ignore et continue
    if ((itemtype === 'TicketCost' || itemtype === 'Item_Ticket' || itemtype === 'Document_Item') && status === 400) return true
    console.warn(`⚠️ ${itemtype} #${id} non supprimé (${status}):`, err.response?.data)
    return false
  }
}

/**
 * Supprime TOUS les items d'un itemtype (actifs + corbeille) dans GLPI.
 */
async function deleteAllItems(itemtype) {
  console.log(`🔍 Début suppression ${itemtype}`)

  let ids
  try {
    ids = await fetchAllIds(itemtype)
  } catch (err) {
    const status = err.response?.status
    if (status === 404 || status === 400) {
      console.log(`ℹ️ ${itemtype} : ignoré (${status})`)
      return { count: 0, failed: 0, skipped: true }
    }
    throw err
  }

  if (ids.length === 0) {
    console.log(`ℹ️ ${itemtype} : aucun item`)
    return { count: 0, failed: 0, skipped: true }
  }

  console.log(`📦 ${itemtype} : ${ids.length} items à purger`)

  let count = 0
  let failed = 0

  for (const id of ids) {
    if (itemtype === 'User' && SYSTEM_USER_IDS.has(id)) {
      console.log(`⏭️ User #${id} ignoré (système)`)
      continue
    }

    if (itemtype === 'Document' && SYSTEM_DOCUMENT_IDS.has(id)) {
      console.log(`⏭️ Document #${id} ignoré (système)`)
      continue
    }

    const ok = await deleteOne(itemtype, id)
    if (ok) {
      count++
      console.log(`✅ ${itemtype} #${id} purgé`)
    } else {
      failed++
      console.error(`❌ Échec suppression ${itemtype} #${id}`)
    }
  }

  console.log(`🏁 ${itemtype} : ${count} purgés, ${failed} échoués`)
  return { count, failed, skipped: false }
}

/**
 * Point d'entrée principal.
 * @param {Function} onProgress  callback(percent: number, tableName: string)
 */
export async function resetAllGLPIData(onProgress) {
  await ensureSession()

  let deletedCount = 0
  let failedCount = 0
  const errors = []
  const deletedTables = []
  const failedTables = []

  for (let i = 0; i < TABLES_TO_DELETE.length; i++) {
    const table = TABLES_TO_DELETE[i]

    if (onProgress) onProgress(Math.round((i / TABLES_TO_DELETE.length) * 100), table)

    try {
      console.log(`🗑️ Suppression : ${table}`)
      const result = await deleteAllItems(table)

      if (!result.skipped) {
        deletedCount += result.count || 0
        failedCount += result.failed || 0
        if (result.count > 0) deletedTables.push(table)
        if (result.failed > 0) {
          failedTables.push(table)
          errors.push(`${table} : ${result.failed} non supprimé(s)`)
        }
      }
    } catch (err) {
      const msg = `${table}: ${err.response?.data?.[1] || err.message}`
      console.warn(`⚠️ Table ${table}:`, msg)
      errors.push(msg)
      failedTables.push(table)
    }

    if (onProgress) onProgress(Math.round(((i + 1) / TABLES_TO_DELETE.length) * 100), table)
  }

  const success = deletedCount > 0 || errors.length === 0

  return {
    success,
    deletedCount,
    failedCount,
    errors,
    deletedTables,
    failedTables,
    message: success
      ? `Purge effectuée : ${deletedCount} élément(s) supprimé(s) dans GLPI.${failedCount > 0 ? ` ${failedCount} élément(s) non supprimé(s).` : ''}`
      : `Erreur lors de la purge : ${errors.join(' | ')}`
  }
}

/**
 * Compte les items actuels dans GLPI (actifs + corbeille) pour l'affichage.
 */
export async function getDataCounts() {
  await ensureSession()

  async function safeCount(itemtype) {
    const ids = new Set()
    try { await collectIds(itemtype, 0, ids) } catch {}
    try { await collectIds(itemtype, 1, ids) } catch {}
    return ids.size
  }

  const [tickets, computers, monitors, users, documents] = await Promise.all([
    safeCount('Ticket'),
    safeCount('Computer'),
    safeCount('Monitor'),
    safeCount('User'),
    safeCount('Document')
  ])

  // Retire les 2 users système du compte
  return { tickets, computers, monitors, users: Math.max(0, users - 2), documents }
}