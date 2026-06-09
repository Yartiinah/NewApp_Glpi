<template>
  <div class="reset-container">
    <header class="page-header">
      <h1 class="page-title">🗑️ Réinitialisation des Données</h1>
      <p class="page-subtitle">Supprimez toutes les données de toutes les tables GLPI avant d'importer de nouvelles données.</p>
    </header>

    <div class="card reset-card">
      <!-- En-tête danger -->
      <div class="danger-header">
        <div class="danger-icon-wrapper">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <div class="danger-title-block">
          <h2>Zone de Danger GLPI</h2>
          <p>La réinitialisation supprimera définitivement TOUTES les données de votre serveur GLPI ({{ ALL_TABLES.length }} tables).</p>
        </div>
      </div>

      <!-- Compteurs actuels -->
      <div class="info-section" v-if="!loading">
        <h3>Données actuelles dans GLPI :</h3>
        <div class="data-counts">
          <div class="count-item">
            <span class="count-label">Tickets</span>
            <span class="count-value">{{ ticketsCount }}</span>
          </div>
          <div class="count-item">
            <span class="count-label">Ordinateurs</span>
            <span class="count-value">{{ computersCount }}</span>
          </div>
          <div class="count-item">
            <span class="count-label">Moniteurs</span>
            <span class="count-value">{{ monitorsCount }}</span>
          </div>
          <div class="count-item">
            <span class="count-label">Utilisateurs</span>
            <span class="count-value">{{ usersCount }}</span>
          </div>
          <div class="count-item">
            <span class="count-label">Documents</span>
            <span class="count-value">{{ documentsCount }}</span>
          </div>
        </div>
      </div>

      <!-- ===== BLOC PROGRESSION (visible pendant le reset) ===== -->
      <div v-if="loading || done" class="progress-block">

        <!-- Barre globale -->
        <div class="global-progress">
          <div class="global-progress-header">
            <span class="global-label">
              <i class="fa-solid fa-spinner fa-spin" v-if="loading"></i>
              <i class="fa-solid fa-circle-check" v-else style="color:#22c55e"></i>
              Progression globale
            </span>
            <span class="global-percent">{{ globalPercent }}%</span>
          </div>
          <div class="global-bar-track">
            <div class="global-bar-fill" :style="{ width: globalPercent + '%' }"></div>
          </div>
          <div class="global-stats">
            {{ doneCount }} / {{ ALL_TABLES.length }} tables traitées
            <span v-if="totalDeleted > 0" class="stat-deleted"> · {{ totalDeleted }} éléments supprimés</span>
          </div>
        </div>

        <!-- Grille des tables -->
        <div class="tables-grid">
          <div
            v-for="table in ALL_TABLES"
            :key="table"
            class="table-row"
            :class="getTableClass(table)"
          >
            <div class="table-row-left">
              <!-- Icône statut -->
              <div class="table-status-icon">
                <i v-if="tableStatus[table] === 'done'"    class="fa-solid fa-check"></i>
                <i v-else-if="tableStatus[table] === 'failed'" class="fa-solid fa-xmark"></i>
                <i v-else-if="tableStatus[table] === 'skipped'" class="fa-solid fa-minus"></i>
                <i v-else-if="tableStatus[table] === 'running'" class="fa-solid fa-spinner fa-spin"></i>
                <i v-else class="fa-regular fa-clock"></i>
              </div>
              <span class="table-name">{{ table }}</span>
            </div>

            <div class="table-row-right">
              <!-- Mini barre de progression -->
              <div class="mini-bar-track">
                <div
                  class="mini-bar-fill"
                  :class="'fill-' + (tableStatus[table] || 'pending')"
                  :style="{ width: getMiniBarWidth(table) + '%' }"
                ></div>
              </div>
              <!-- Compte supprimé -->
              <span class="table-count" v-if="tableStatus[table] === 'done'">
                {{ tableDeleted[table] || 0 }}
              </span>
              <span class="table-count skipped" v-else-if="tableStatus[table] === 'skipped'">vide</span>
              <span class="table-count failed"  v-else-if="tableStatus[table] === 'failed'">erreur</span>
              <span class="table-count pending"  v-else>—</span>
            </div>
          </div>
        </div>

        <!-- Message final -->
        <div v-if="done && !loading" class="final-message" :class="hasErrors ? 'final-warn' : 'final-ok'">
          <i :class="hasErrors ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-check'"></i>
          <span>{{ finalMessage }}</span>
        </div>
      </div>

      <!-- Boutons -->
      <div class="reset-action-bar">
        <button @click="loadCounts" :disabled="loading" class="btn btn-secondary">
          <i class="fa-solid fa-arrows-rotate"></i> Actualiser les comptes
        </button>
        <button @click="showConfirmModal" :disabled="loading" class="btn btn-danger">
          <i class="fa-solid" :class="loading ? 'fa-spinner fa-spin' : 'fa-trash-can'"></i>
          <span>{{ loading ? 'Suppression en cours...' : 'Supprimer TOUTES les données' }}</span>
        </button>
      </div>
    </div>

    <ConfirmModal
      :visible="showConfirm"
      title="Confirmer la suppression définitive"
      message="Attention ! Cette action va supprimer de manière irréversible TOUTES les données de votre serveur GLPI. Voulez-vous continuer ?"
      confirmLabel="Oui, supprimer TOUT"
      :loading="loading"
      @confirm="doReset"
      @cancel="showConfirm = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import ConfirmModal from '../../components/backoffice/ConfirmModal.vue'
import { getDataCounts } from '../../services/backoffice/reset.service'
import { glpiClient, ensureSession } from '../../services/backoffice/glpi.service'

// ---- Liste complète des tables (même ordre que reset.service) ----
const ALL_TABLES = [
  'TicketCost', 'Item_Ticket', 'Ticket', 'Problem', 'Change',
  'SoftwareVersion', 'Software', 'SoftwareLicense', 'Computer', 'Monitor',
  'NetworkEquipment', 'Printer', 'Phone', 'Peripheral', 'Rack',
  'Enclosure', 'PDU', 'PassiveDCEquipment', 'Unmanaged',
  'DeviceCamera', 'DeviceGraphicCard', 'DeviceNetworkCard', 'DeviceSoundCard',
  'DeviceDrive', 'DevicePci', 'DevicePowerSupply', 'DeviceBattery', 'DeviceCase',
  'DeviceSensor', 'DeviceSimcard', 'DeviceMotherboard', 'DeviceGeneric',
  'DeviceControl', 'DeviceHardDrive', 'DeviceFirmware', 'DeviceMemory', 'DeviceProcessor',
  'Document_Item',
  'Document',
  'ComputerModel', 'MonitorModel', 'Manufacturer', 'Location', 'State',
  'User'
]

const SYSTEM_USER_IDS = new Set([2, 6])
const SYSTEM_DOCUMENT_IDS = new Set() // Ajoutez ici les IDs de documents système si nécessaire

// ---- State ----
const ticketsCount   = ref(0)
const computersCount = ref(0)
const monitorsCount  = ref(0)
const usersCount     = ref(0)
const documentsCount = ref(0)

const showConfirm = ref(false)
const loading     = ref(false)
const done        = ref(false)
const finalMessage = ref('')
const hasErrors    = ref(false)
const totalDeleted = ref(0)
const doneCount    = ref(0)

// Statut par table : 'pending' | 'running' | 'done' | 'failed' | 'skipped'
const tableStatus  = reactive({})
const tableDeleted = reactive({})

// ---- Computed ----
const globalPercent = computed(() => {
  if (ALL_TABLES.length === 0) return 0
  return Math.round((doneCount.value / ALL_TABLES.length) * 100)
})

// ---- Helpers ----
function getTableClass(table) {
  const s = tableStatus[table]
  if (s === 'done')    return 'row-done'
  if (s === 'failed')  return 'row-failed'
  if (s === 'skipped') return 'row-skipped'
  if (s === 'running') return 'row-running'
  return 'row-pending'
}

function getMiniBarWidth(table) {
  const s = tableStatus[table]
  if (s === 'done' || s === 'skipped') return 100
  if (s === 'running') return 60
  if (s === 'failed')  return 100
  return 0
}

function resetTableState() {
  ALL_TABLES.forEach(t => {
    tableStatus[t]  = 'pending'
    tableDeleted[t] = 0
  })
  doneCount.value    = 0
  totalDeleted.value = 0
  hasErrors.value    = false
  finalMessage.value = ''
  done.value         = false
}

// ---- Chargement des compteurs ----
async function loadCounts() {
  try {
    const counts = await getDataCounts()
    ticketsCount.value   = counts.tickets
    computersCount.value = counts.computers
    monitorsCount.value  = counts.monitors
    usersCount.value     = counts.users
    documentsCount.value = counts.documents
  } catch (err) {
    console.error('Impossible de charger les compteurs:', err)
  }
}

// ---- Modal ----
function showConfirmModal() {
  showConfirm.value = true
}

// ---- RESET avec progression par table ----
async function doReset() {
  showConfirm.value = false
  loading.value = true
  resetTableState()

  try {
    await ensureSession()

    for (let i = 0; i < ALL_TABLES.length; i++) {
      const table = ALL_TABLES[i]
      tableStatus[table] = 'running'

      try {
        const result = await purgeTable(table)
        tableDeleted[table] = result.count || 0
        totalDeleted.value += result.count || 0

        if (result.skipped) {
          tableStatus[table] = 'skipped'
        } else if (result.failed > 0 && result.count === 0) {
          tableStatus[table] = 'failed'
          hasErrors.value = true
        } else {
          tableStatus[table] = 'done'
        }
      } catch (err) {
        tableStatus[table] = 'failed'
        hasErrors.value = true
        console.warn(`⚠️ ${table}:`, err.message)
      }

      doneCount.value = i + 1
    }

    finalMessage.value = hasErrors.value
      ? `Purge terminée avec des avertissements. ${totalDeleted.value} élément(s) supprimé(s).`
      : `Purge réussie ! ${totalDeleted.value} élément(s) supprimé(s) dans GLPI.`

  } catch (err) {
    finalMessage.value = `Erreur critique : ${err.message}`
    hasErrors.value = true
  } finally {
    loading.value = false
    done.value = true
    await loadCounts()
  }
}

// ---- Purge d'une table (logique directement ici pour le suivi fin) ----
async function purgeTable(itemtype) {
  const ids = new Set()
  await collectIds(itemtype, 0, ids)
  await collectIds(itemtype, 1, ids)

  if (ids.size === 0) return { count: 0, failed: 0, skipped: true }

  let count = 0
  let failed = 0

  for (const id of ids) {
    if (itemtype === 'User' && SYSTEM_USER_IDS.has(id)) continue
    if (itemtype === 'Document' && SYSTEM_DOCUMENT_IDS.has(id)) continue
    const ok = await deleteOne(itemtype, id)
    if (ok) count++
    else failed++
  }

  return { count, failed, skipped: false }
}

async function collectIds(itemtype, isDeleted, idSet) {
  let start = 0
  const pageSize = 50
  while (true) {
    let res
    try {
      res = await glpiClient.get(`/${itemtype}`, {
        params: { range: `${start}-${start + pageSize - 1}`, only_id: true, is_deleted: isDeleted }
      })
    } catch (err) {
      const s = err.response?.status
      if (s === 404 || s === 400) return
      throw err
    }
    let page = res.data
    if (!Array.isArray(page)) page = Object.values(page || {})
    const valid = page.filter(item => item && typeof item.id === 'number')
    if (valid.length === 0) break
    valid.forEach(item => idSet.add(item.id))
    if (valid.length < pageSize) break
    start += pageSize
  }
}

async function deleteOne(itemtype, id) {
  try {
    await glpiClient.delete(`/${itemtype}/${id}`, { params: { force_purge: 1 } })
    return true
  } catch (err) {
    const s = err.response?.status
    if (s === 404) return true
    if ((itemtype === 'TicketCost' || itemtype === 'Item_Ticket' || itemtype === 'Document_Item') && s === 400) return true
    return false
  }
}

onMounted(() => {
  loadCounts()
  ALL_TABLES.forEach(t => { tableStatus[t] = 'pending'; tableDeleted[t] = 0 })
})
</script>

<style scoped>
.reset-container {
  max-width: 900px;
  margin: 0 auto;
}

.reset-card {
  padding: 2.5rem;
}

/* --- En-tête danger --- */
.danger-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 2rem;
}

.danger-icon-wrapper {
  width: 56px;
  height: 56px;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  flex-shrink: 0;
}

.danger-title-block h2 {
  font-size: 1.25rem;
  font-weight: 800;
  color: #b91c1c;
  margin-bottom: 0.25rem;
}

.danger-title-block p {
  font-size: 0.9rem;
  color: var(--text-muted);
}

/* --- Compteurs --- */
.info-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid var(--border);
}

.info-section h3 {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 1rem;
}

.data-counts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
}

.count-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem;
  background: #fff;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.count-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
}

.count-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: #ef4444;
}

/* --- Bloc progression --- */
.progress-block {
  margin-bottom: 2rem;
}

/* Barre globale */
.global-progress {
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.25rem;
}

.global-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.global-label {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.global-percent {
  font-size: 1.2rem;
  font-weight: 800;
  color: #2563eb;
}

.global-bar-track {
  width: 100%;
  height: 12px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.global-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #2563eb);
  border-radius: 999px;
  transition: width 0.4s ease;
}

.global-stats {
  font-size: 0.82rem;
  color: var(--text-muted);
}

.stat-deleted {
  color: #16a34a;
  font-weight: 600;
}

/* Grille des tables */
.tables-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.75rem;
  max-height: 420px;
  overflow-y: auto;
}

.table-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.45rem 0.75rem;
  border-radius: 8px;
  transition: background 0.2s;
  gap: 1rem;
}

.table-row-left {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex: 1;
  min-width: 0;
}

.table-row-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.table-status-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.table-name {
  font-size: 0.82rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-bar-track {
  width: 80px;
  height: 6px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
}

.mini-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.table-count {
  font-size: 0.75rem;
  font-weight: 700;
  min-width: 32px;
  text-align: right;
}

/* Statuts */
.row-pending  { background: transparent; }
.row-pending  .table-name { color: var(--text-muted); }
.row-pending  .table-status-icon { color: #94a3b8; }

.row-running  { background: #eff6ff; }
.row-running  .table-name { color: #1d4ed8; font-weight: 600; }
.row-running  .table-status-icon { color: #2563eb; }

.row-done     { background: #f0fdf4; }
.row-done     .table-name { color: #15803d; }
.row-done     .table-status-icon { color: #22c55e; }
.row-done     .table-count { color: #15803d; }

.row-skipped  { background: #f8fafc; }
.row-skipped  .table-name { color: #94a3b8; }
.row-skipped  .table-status-icon { color: #94a3b8; }
.row-skipped  .table-count { color: #94a3b8; }

.row-failed   { background: #fef2f2; }
.row-failed   .table-name { color: #b91c1c; }
.row-failed   .table-status-icon { color: #ef4444; }

/* Mini bar couleurs */
.fill-done    { background: #22c55e; }
.fill-running { background: #3b82f6; animation: pulse-bar 1s infinite; }
.fill-failed  { background: #ef4444; }
.fill-skipped { background: #cbd5e1; }
.fill-pending { background: transparent; }

@keyframes pulse-bar {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Message final */
.final-message {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 1rem 1.25rem;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
}

.final-ok {
  background: #f0fdf4;
  border: 1px solid #22c55e;
  color: #15803d;
}

.final-warn {
  background: #fef3c7;
  border: 1px solid #f59e0b;
  color: #92400e;
}

/* Boutons */
.reset-action-bar {
  display: flex;
  justify-content: space-between;
  margin-top: 2rem;
  border-top: 1px solid var(--border);
  padding-top: 1.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.2s;
}

.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  background: #f1f5f9;
  color: var(--text-main);
  border: 1px solid var(--border);
}

.btn-danger {
  background: #ef4444;
  color: #fff;
}

.btn-danger:hover:not(:disabled) { background: #dc2626; }
</style>