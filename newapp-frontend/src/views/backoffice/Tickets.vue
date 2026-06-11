<template>
  <div class="tickets-container">
    <header class="page-header">
      <div class="header-left">
        <h1 class="page-title">🎫 Gestion des Tickets</h1>
        <p class="page-subtitle">Consultez les requêtes de support, leurs équipements associés et leurs imputations de coûts.</p>
      </div>
      <div class="header-right">
        <button @click="loadTickets" :disabled="loading" class="btn btn-secondary">
          <i class="fa-solid" :class="loading ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'"></i> Actualiser
        </button>
      </div>
    </header>

    <!-- Filters Section -->
    <div class="card filter-card">
      <div class="filter-row">
        <div class="search-box">
          <i class="fa-solid fa-magnifying-glass search-icon"></i>
          <input type="text" v-model="filterSearch" placeholder="Rechercher par titre ou ID..." class="form-input" />
        </div>
        
        <div class="select-box">
          <label class="select-label">Statut</label>
          <select v-model="filterStatus" class="form-select">
            <option value="">Tous les statuts</option>
            <option value="1">Nouveau</option>
            <option value="2">En cours (Assigné)</option>
            <option value="4">En attente</option>
            <option value="5">Résolu</option>
            <option value="6">Clos</option>
          </select>
        </div>

        <div class="select-box">
          <label class="select-label">Priorité</label>
          <select v-model="filterPriority" class="form-select">
            <option value="">Toutes les priorités</option>
            <option value="1">Très basse</option>
            <option value="2">Basse</option>
            <option value="3">Moyenne</option>
            <option value="4">Haute</option>
            <option value="5">Très haute</option>
          </select>
        </div>

        <div class="select-box">
          <label class="select-label">Tri par date</label>
          <select v-model="sortByDate" class="form-select">
            <option value="date_creation">Date de création</option>
            <option value="date">Date d'import</option>
          </select>
        </div>

        <div class="select-box">
          <label class="select-label">Ordre</label>
          <select v-model="sortOrder" class="form-select">
            <option value="desc">Décroissant</option>
            <option value="asc">Croissant</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Main Content: Table & Drawer -->
    <div class="tickets-layout-grid">
      <!-- Tickets Table -->
      <div class="card list-card">
        <div v-if="loading" class="table-loading">
          <i class="fa-solid fa-spinner fa-spin loading-spinner"></i>
          <span>Chargement des tickets GLPI...</span>
        </div>
        
        <div v-else-if="filteredTickets.length === 0" class="empty-table-state">
          <i class="fa-solid fa-ticket-simple empty-icon"></i>
          <p>Aucun ticket ne correspond à vos critères de recherche.</p>
        </div>

        <div v-else class="table-container">
          <table class="custom-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Titre</th>
                <th>Statut</th>
                <th>Priorité</th>
                <th>Date Création</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="ticket in filteredTickets" 
                :key="ticket.id"
                :class="{ 'row-selected': selectedTicket?.id === ticket.id }"
                @click="selectTicket(ticket)"
                class="clickable-row"
              >
                <td><span class="ticket-id-tag">#{{ ticket.id }}</span></td>
                <td class="ticket-name-cell" :title="ticket.name">{{ ticket.name || 'Sans titre' }}</td>
                <td>
                  <span class="badge" :class="`badge-status-${ticket.status || 1}`">
                    {{ statusLabel(ticket.status) }}
                  </span>
                </td>
                <td>
                  <span class="badge" :class="`badge-priority-${ticket.priority || 3}`">
                    {{ priorityLabel(ticket.priority) }}
                  </span>
                </td>
                <td class="date-cell">{{ formatDate(ticket.date_creation || ticket.date) }}</td>
                <td>
                  <button @click.stop="openEditModal(ticket)" class="btn-icon-edit" title="Modifier ce ticket">
                    <i class="fa-regular fa-pen-to-square"></i>
                  </button>
                  <button @click.stop="confirmDelete(ticket)" class="btn-icon-danger" title="Supprimer ce ticket">
                    <i class="fa-regular fa-trash-can"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Ticket Details Drawer (Card on right side) -->
      <div class="ticket-details-panel">
        <div v-if="!selectedTicket" class="card empty-details-card">
          <i class="fa-regular fa-id-card details-empty-icon"></i>
          <p>Sélectionnez un ticket dans la liste pour afficher ses détails, équipements associés et coûts imputés.</p>
        </div>

        <div v-else class="card details-active-card">
          <div class="details-header">
            <div class="details-header-title">
              <span class="details-id">Ticket #{{ selectedTicket.id }}</span>
              <h2>{{ selectedTicket.name || 'Sans titre' }}</h2>
            </div>
            <button @click="selectedTicket = null" class="btn-close-details">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="details-body">
            <!-- Badges -->
            <div class="details-badges-row">
              <div class="detail-badge-group">
                <span class="badge-title">Statut</span>
                <span class="badge" :class="`badge-status-${selectedTicket.status || 1}`">
                  {{ statusLabel(selectedTicket.status) }}
                </span>
              </div>
              <div class="detail-badge-group">
                <span class="badge-title">Priorité</span>
                <span class="badge" :class="`badge-priority-${selectedTicket.priority || 3}`">
                  {{ priorityLabel(selectedTicket.priority) }}
                </span>
              </div>
            </div>

            <!-- Description -->
            <div class="detail-section">
              <h4 class="detail-section-title"><i class="fa-solid fa-align-left"></i> Description</h4>
              <div class="description-box" v-html="selectedTicket.content || '<em>Aucune description fournie.</em>'"></div>
            </div>

            <!-- Associated Items -->
            <div class="detail-section">
              <h4 class="detail-section-title"><i class="fa-solid fa-laptop"></i> Équipements associés</h4>
              <div v-if="loadingDetails" class="mini-loading">
                <i class="fa-solid fa-spinner fa-spin"></i> Chargement...
              </div>
              <div v-else-if="associatedItems.length === 0" class="mini-empty">
                Aucun équipement lié à ce ticket.
              </div>
              <div v-else class="linked-items-list">
                <div v-for="item in associatedItems" :key="item.id" class="linked-item-tag">
                  <i class="fa-solid" :class="item.itemtype === 'Monitor' ? 'fa-desktop' : 'fa-laptop'"></i>
                  <span class="linked-item-name">{{ item.itemtype }} #{{ item.items_id }}</span>
                </div>
              </div>
            </div>

            <!-- Associated Costs -->
            <div class="detail-section">
              <h4 class="detail-section-title"><i class="fa-solid fa-sack-dollar"></i> Coûts imputés</h4>
              <div v-if="loadingDetails" class="mini-loading">
                <i class="fa-solid fa-spinner fa-spin"></i> Chargement...
              </div>
              <div v-else-if="associatedCosts.length === 0" class="mini-empty">
                Aucun coût imputé à ce ticket.
              </div>
              <div v-else class="costs-table-wrapper">
                <table class="costs-mini-table">
                  <thead>
                    <tr>
                      <th>Libellé</th>
                      <th>Durée</th>
                      <th>Taux/h</th>
                      <th>Fixe</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="cost in associatedCosts" :key="cost.id">
                      <td>{{ cost.name || 'Coût' }}</td>
                      <td>{{ formatDuration(cost.actiontime) }}</td>
                      <td>{{ cost.cost_time }} €</td>
                      <td>{{ cost.cost_fixed }} €</td>
                      <td class="cost-total-cell">{{ calculateTotalCost(cost) }} €</td>
                    </tr>
                    <tr class="total-row">
                      <td colspan="4" class="total-label">TOTAL</td>
                      <td class="total-value">{{ totalTicketCost }} €</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirm Delete Modal -->
    <ConfirmModal
      :visible="showDeleteModal"
      title="Supprimer le ticket ?"
      confirmLabel="Supprimer"
      :message="`Êtes-vous sûr de vouloir supprimer définitivement le ticket #${ticketToDelete?.id} ? Cette opération est irréversible.`"
      :loading="deleting"
      @confirm="doDelete"
      @cancel="showDeleteModal = false"
    />

    <!-- Edit Ticket Modal -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="closeEditModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Modifier le Ticket #{{ editingTicket?.id }}</h3>
          <button @click="closeEditModal" class="btn-close-modal">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Titre du ticket</label>
            <input v-model="editForm.name" type="text" class="form-input" />
          </div>
          <div class="form-row">
            <div class="form-group half-width">
              <label class="form-label">Statut</label>
              <select v-model="editForm.status" class="form-select">
                <option :value="1">Nouveau</option>
                <option :value="2">En cours (Assigné)</option>
                <option :value="3">En cours (Planifié)</option>
                <option :value="4">En attente</option>
                <option :value="5">Résolu</option>
                <option :value="6">Clos</option>
              </select>
            </div>
            <div class="form-group half-width">
              <label class="form-label">Priorité</label>
              <select v-model="editForm.priority" class="form-select">
                <option :value="1">Très basse</option>
                <option :value="2">Basse</option>
                <option :value="3">Moyenne</option>
                <option :value="4">Haute</option>
                <option :value="5">Très haute</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea v-model="editForm.content" rows="4" class="form-textarea"></textarea>
          </div>

          <!-- Coûts Imputés -->
          <div class="form-group">
            <label class="form-label">Coûts Imputés</label>
            <div v-if="editForm.costs.length === 0" class="mini-empty">
              Aucun coût imputé
            </div>
            <div v-for="(cost, index) in editForm.costs" :key="index" class="cost-row">
              <div class="cost-inputs">
                <input type="text" v-model="cost.name" placeholder="Libellé" class="form-input cost-input" />
                <input type="number" v-model="cost.duration" placeholder="Durée (min)" class="form-input cost-input" title="Durée en minutes" />
                <input type="number" v-model="cost.cost_time" placeholder="Taux/h (€)" class="form-input cost-input" />
                <input type="number" v-model="cost.cost_fixed" placeholder="Fixe (€)" class="form-input cost-input" />
              </div>
              <button @click="removeCost(index)" class="btn-icon-danger btn-small" title="Supprimer ce coût">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
            <button @click="addCost" class="btn btn-secondary btn-small mt-2">
              <i class="fa-solid fa-plus"></i> Ajouter un coût
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeEditModal" class="btn btn-secondary">Annuler</button>
          <button @click="saveTicket" :disabled="saving" class="btn btn-primary">
            <i class="fa-solid" :class="saving ? 'fa-spinner fa-spin' : 'fa-save'"></i>
            <span>{{ saving ? 'Enregistrement...' : 'Enregistrer' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ConfirmModal from '../../components/backoffice/ConfirmModal.vue'
import {
  getTickets,
  deleteTicket,
  getTicketCosts,
  getTicketItems,
  updateTicket,
  deleteTicketCost,
  addTicketCost
} from '../../services/backoffice/glpi.service'

const tickets = ref([])
const loading = ref(false)
const selectedTicket = ref(null)

// Details states
const associatedItems = ref([])
const associatedCosts = ref([])
const loadingDetails = ref(false)

// Filtering states
const filterSearch = ref('')
const filterStatus = ref('')
const filterPriority = ref('')
const sortByDate = ref('date_creation')
const sortOrder = ref('desc')

// Delete states
const showDeleteModal = ref(false)
const ticketToDelete = ref(null)
const deleting = ref(false)

// Edit states
const showEditModal = ref(false)
const editingTicket = ref(null)
const saving = ref(false)
const editForm = ref({
  name: '',
  status: 1,
  priority: 3,
  content: '',
  costs: []
})

async function loadTickets() {
  loading.value = true
  selectedTicket.value = null
  try {
    const data = await getTickets()
    tickets.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Failed to load tickets:', err)
  } finally {
    loading.value = false
  }
}

const filteredTickets = computed(() => {
  let result = tickets.value.filter(t => {
    // Search filter
    const matchesSearch = !filterSearch.value || 
      (t.id && t.id.toString().includes(filterSearch.value)) ||
      (t.name && t.name.toLowerCase().includes(filterSearch.value.toLowerCase())) ||
      (t.content && t.content.toLowerCase().includes(filterSearch.value.toLowerCase()))
    
    // Status filter
    const matchesStatus = !filterStatus.value || (t.status && t.status.toString() === filterStatus.value)

    // Priority filter
    const matchesPriority = !filterPriority.value || (t.priority && t.priority.toString() === filterPriority.value)

    return matchesSearch && matchesStatus && matchesPriority
  })

  // Sort by date
  result.sort((a, b) => {
    const dateA = a[sortByDate.value] || a.date_creation || a.date
    const dateB = b[sortByDate.value] || b.date_creation || b.date
    
    if (!dateA && !dateB) return 0
    if (!dateA) return 1
    if (!dateB) return -1
    
    const timeA = new Date(dateA).getTime()
    const timeB = new Date(dateB).getTime()
    
    if (isNaN(timeA) && isNaN(timeB)) return 0
    if (isNaN(timeA)) return 1
    if (isNaN(timeB)) return -1
    
    return sortOrder.value === 'desc' ? timeB - timeA : timeA - timeB
  })

  return result
})

async function selectTicket(ticket) {
  selectedTicket.value = ticket
  associatedItems.value = []
  associatedCosts.value = []
  loadingDetails.value = true

  try {
    const [items, costs] = await Promise.all([
      getTicketItems(ticket.id).catch(() => []),
      getTicketCosts(ticket.id).catch(() => [])
    ])
    associatedItems.value = Array.isArray(items) ? items : []
    associatedCosts.value = Array.isArray(costs) ? costs : []
    console.log('📊 Coûts récupérés pour le ticket', ticket.id, ':', associatedCosts.value)
  } catch (err) {
    console.error('Failed to load ticket details:', err)
  } finally {
    loadingDetails.value = false
  }
}

function confirmDelete(ticket) {
  ticketToDelete.value = ticket
  showDeleteModal.value = true
}

async function doDelete() {
  if (!ticketToDelete.value) return
  deleting.value = true
  try {
    await deleteTicket(ticketToDelete.value.id)
    if (selectedTicket.value?.id === ticketToDelete.value.id) {
      selectedTicket.value = null
    }
    await loadTickets()
    showDeleteModal.value = false
  } catch (err) {
    console.error('Failed to delete ticket:', err)
  } finally {
    deleting.value = false
  }
}

function openEditModal(ticket) {
  editingTicket.value = ticket
  editForm.value = {
    name: ticket.name || '',
    status: ticket.status || 1,
    priority: ticket.priority || 3,
    content: ticket.content || '',
    costs: []
  }
  showEditModal.value = true

  // Charger les coûts existants
  loadTicketCosts(ticket.id)
}

async function loadTicketCosts(ticketId) {
  try {
    const costs = await getTicketCosts(ticketId)
    editForm.value.costs = Array.isArray(costs) ? costs.map(c => ({
      id: c.id,
      name: c.name || 'Coût',
      duration: Math.round((c.actiontime || 0) / 60),  // secondes → minutes pour l'affichage
      cost_time: c.cost_time || 0,
      cost_fixed: c.cost_fixed || 0
    })) : []
  } catch (err) {
    console.error('Failed to load ticket costs:', err)
    editForm.value.costs = []
  }
}

function closeEditModal() {
  showEditModal.value = false
  editingTicket.value = null
  editForm.value = {
    name: '',
    status: 1,
    priority: 3,
    content: '',
    costs: []
  }
}

function addCost() {
  editForm.value.costs.push({
    id: null,
    name: 'Coût',
    duration: 0,
    cost_time: 0,
    cost_fixed: 0
  })
}

function removeCost(index) {
  editForm.value.costs.splice(index, 1)
}

async function saveTicket() {
  if (!editingTicket.value) return
  saving.value = true
  try {
    // 1. Mettre à jour le ticket
    await updateTicket(editingTicket.value.id, {
      name: editForm.value.name,
      status: editForm.value.status,
      priority: editForm.value.priority,
      content: editForm.value.content
    })

    // 2. Gérer les coûts: supprimer les anciens et créer les nouveaux
    const existingCosts = await getTicketCosts(editingTicket.value.id)
    if (Array.isArray(existingCosts)) {
      for (const cost of existingCosts) {
        try {
          await deleteTicketCost(cost.id)
        } catch (err) {
          console.error(`Failed to delete cost ${cost.id}:`, err)
        }
      }
    }

    // Créer les nouveaux coûts
    for (const cost of editForm.value.costs) {
      try {
        await addTicketCost(editingTicket.value.id, {
          name:             cost.name,
          duration_seconds: (cost.duration || 0) * 60,  // minutes → secondes (actiontime GLPI)
          cost_time:        cost.cost_time,
          cost_fixed:       cost.cost_fixed
        })
      } catch (err) {
        console.error(`Failed to add cost:`, err)
      }
    }

    await loadTickets()
    if (selectedTicket.value?.id === editingTicket.value.id) {
      await selectTicket(selectedTicket.value)
    }
    closeEditModal()
  } catch (err) {
    console.error('Failed to update ticket:', err)
  } finally {
    saving.value = false
  }
}

// Helpers
function statusLabel(status) {
  const labels = {
    1: 'Nouveau',
    2: 'En cours (Assigné)',
    3: 'En cours (Planifié)',
    4: 'En attente',
    5: 'Résolu',
    6: 'Clos'
  }
  return labels[status] || `Inconnu (${status})`
}

function priorityLabel(prio) {
  const labels = {
    1: 'Très basse',
    2: 'Basse',
    3: 'Moyenne',
    4: 'Haute',
    5: 'Très haute',
    6: 'Majeure'
  }
  return labels[prio] || 'Moyenne'
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatDuration(seconds) {
  if (!seconds) return '0m'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function calculateTotalCost(cost) {
  const timeCost = parseFloat(cost.cost_time || 0)
  const fixedCost = parseFloat(cost.cost_fixed || 0)
  const durationHours = (cost.actiontime || 0) / 3600
  return (timeCost * durationHours + fixedCost).toFixed(2)
}

const totalTicketCost = computed(() => {
  return associatedCosts.value.reduce((sum, cost) => {
    return sum + parseFloat(calculateTotalCost(cost))
  }, 0).toFixed(2)
})

onMounted(() => {
  loadTickets()
})
</script>

<style scoped>
.tickets-container {
  max-width: 1400px;
  margin: 0 auto;
}

.filter-card {
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.filter-row {
  display: flex;
  gap: 1.5rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 280px;
  position: relative;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.search-box .form-input {
  padding-left: 2.5rem;
}

.select-box {
  width: 200px;
}

.select-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: 0.35rem;
  letter-spacing: 0.05em;
}

/* Layout Split */
.tickets-layout-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 1024px) {
  .tickets-layout-grid {
    grid-template-columns: 1fr;
  }
}

.list-card {
  padding: 0;
  overflow: hidden;
}

.table-loading, .empty-table-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem 2rem;
  color: var(--text-muted);
  gap: 1rem;
}

.loading-spinner {
  font-size: 2.5rem;
  color: var(--primary);
}

.empty-icon {
  font-size: 3rem;
  color: #cbd5e1;
}

.clickable-row {
  cursor: pointer;
  transition: background 0.15s ease;
}

.row-selected {
  background: rgba(59, 130, 246, 0.05) !important;
}

.ticket-id-tag {
  font-weight: 700;
  color: var(--primary);
  font-size: 0.85rem;
}

.ticket-name-cell {
  font-weight: 600;
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.date-cell {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.btn-icon-danger {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-icon-danger:hover {
  background: var(--danger-light);
  color: var(--danger);
}

.btn-icon-edit {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 0.5rem;
}

.btn-icon-edit:hover {
  background: var(--primary-light);
  color: var(--primary);
}

/* Badges styling */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.badge-status-1 { background: rgba(59, 130, 246, 0.15); color: #2563eb; }
.badge-status-2 { background: rgba(245, 158, 11, 0.15); color: #d97706; }
.badge-status-3 { background: rgba(234, 179, 8, 0.15); color: #ca8a04; }
.badge-status-4 { background: rgba(239, 68, 68, 0.15); color: #dc2626; }
.badge-status-5 { background: rgba(16, 185, 129, 0.15); color: #059669; }
.badge-status-6 { background: rgba(100, 116, 139, 0.15); color: #475569; }

.badge-priority-1 { background: #f1f5f9; color: #475569; }
.badge-priority-2 { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
.badge-priority-3 { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
.badge-priority-4 { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.badge-priority-5 { background: rgba(239, 68, 68, 0.2); color: #b91c1c; font-weight: 700; }

/* Details Panel styling */
.ticket-details-panel {
  position: sticky;
  top: 2rem;
}

.empty-details-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  color: var(--text-muted);
  gap: 1rem;
  border-style: dashed;
}

.details-empty-icon {
  font-size: 3.5rem;
  color: #cbd5e1;
}

.details-active-card {
  padding: 2rem;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.details-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid var(--border);
  padding-bottom: 1.25rem;
  margin-bottom: 1.5rem;
  gap: 1rem;
}

.details-header-title h2 {
  font-family: var(--font-title);
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--text-main);
  margin-top: 0.15rem;
}

.details-id {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--primary);
  text-transform: uppercase;
}

.btn-close-details {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  color: var(--text-muted);
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-close-details:hover {
  background: #f1f5f9;
  color: var(--text-main);
}

.details-body {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.details-badges-row {
  display: flex;
  gap: 2rem;
}

.detail-badge-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.badge-title {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-section-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-main);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 0.25rem;
}

.description-box {
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 1rem;
  font-size: 0.9rem;
  color: #334155;
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}

.mini-loading, .mini-empty {
  font-size: 0.85rem;
  color: var(--text-muted);
  padding: 0.5rem 0;
  font-style: italic;
}

.linked-items-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.linked-item-tag {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f1f5f9;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  font-size: 0.85rem;
  color: #334155;
  font-weight: 500;
}

.linked-item-tag i {
  color: var(--primary);
}

.costs-table-wrapper {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.costs-mini-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.costs-mini-table th {
  background: #f8fafc;
  padding: 0.5rem;
  font-weight: 700;
  color: var(--text-muted);
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.costs-mini-table td {
  padding: 0.5rem;
  border-bottom: 1px solid var(--border);
  color: var(--text-main);
}

.costs-mini-table tr:last-child td {
  border-bottom: none;
}

.cost-total-cell {
  font-weight: 700;
  color: var(--success-hover);
}

.total-row {
  background: #f8fafc;
  font-weight: 700;
}

.total-label {
  text-align: right;
  padding-right: 1rem;
  color: var(--text-main);
  font-weight: 700;
}

.total-value {
  color: var(--success-hover);
  font-weight: 800;
  font-size: 0.9rem;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 500px;
  box-shadow: var(--shadow-lg);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  font-family: var(--font-title);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.btn-close-modal {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  color: var(--text-muted);
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-close-modal:hover {
  background: #f1f5f9;
  color: var(--text-main);
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid var(--border);
}

/* Cost Row Styles */
.cost-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.cost-inputs {
  display: flex;
  gap: 0.5rem;
  flex: 1;
}

.cost-input {
  flex: 1;
  padding: 0.5rem;
  font-size: 0.85rem;
}

.btn-small {
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
}

.mt-2 {
  margin-top: 0.5rem;
}
</style>