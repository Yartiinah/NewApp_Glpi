<template>
  <div class="kanban-container">
    <header class="page-header">
      <h1 class="page-title">📋 Tableau Kanban</h1>
      <p class="page-subtitle">Gérez vos tickets en mode Kanban</p>
    </header>

    <div class="kanban-actions">
      <button @click="showCreateDialog = true" class="btn btn-primary">
        <i class="fa-solid fa-plus"></i>
        <span>Ajouter 1 ticket</span>
      </button>
    </div>

    <div class="kanban-board">
      <div 
        v-for="column in columns" 
        :key="column.id"
        class="kanban-column"
        :style="{ backgroundColor: column.color }"
        @dragover.prevent="onDragOver"
        @drop="onDrop($event, column.id)"
      >
        <div class="column-header">
          <div class="column-title-block">
            <h3 class="column-title">{{ column.name }}</h3>
            <span class="column-title-mg">{{ column.nameMg }}</span>
          </div>
          <span class="column-count">{{ getTicketsByStatus(column.status).length }}</span>
        </div>
        
        <div class="column-tickets">
          <div 
            v-for="ticket in getTicketsByStatus(column.status)" 
            :key="ticket.id"
            class="ticket-card"
            draggable="true"
            @dragstart="onDragStart($event, ticket)"
            @click="showTicketDetails(ticket)"
          >
            <div class="ticket-header">
              <span class="ticket-id">#{{ ticket.id }}</span>
              <span class="ticket-priority" :class="getPriorityClass(ticket.priority)">
                {{ getPriorityLabel(ticket.priority) }}
              </span>
            </div>
            <h4 class="ticket-title">{{ ticket.name }}</h4>
            <p class="ticket-description">{{ truncate(ticket.content, 100) }}</p>
            <div class="ticket-footer">
              <span class="ticket-date">{{ formatDate(ticket.date_creation || ticket.date) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Ticket Dialog -->
    <div v-if="showCreateDialog" class="dialog-overlay" @click="showCreateDialog = false">
      <div class="dialog-content dialog-content-large" @click.stop>
        <div class="dialog-header">
          <h3>Créer un nouveau ticket</h3>
          <button @click="showCreateDialog = false" class="dialog-close">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        <form @submit.prevent="createTicket">
          <div class="form-row">
            <div class="form-group half-width">
              <label class="form-label">Titre *</label>
              <input v-model="newTicket.title" type="text" class="form-input" required placeholder="Titre du ticket" />
            </div>
            <div class="form-group half-width">
              <label class="form-label">Type d'incident</label>
              <select v-model="newTicket.type" class="form-select">
                <option :value="1">Incident (Dysfonctionnement)</option>
                <option :value="2">Demande (Besoin / Service)</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group half-width">
              <label class="form-label">Statut</label>
              <select v-model="newTicket.status" class="form-select">
                <option :value="1">Nouveau</option>
                <option :value="2">En cours</option>
                <option :value="6">Terminé</option>
              </select>
            </div>
            <div class="form-group half-width">
              <label class="form-label">Priorité</label>
              <select v-model="newTicket.priority" class="form-select">
                <option :value="1">Très basse</option>
                <option :value="2">Basse</option>
                <option :value="3">Moyenne</option>
                <option :value="4">Haute</option>
                <option :value="5">Très haute</option>
              </select>
            </div>
          </div>

          <!-- ⭐ DEMANDEUR (USER) ⭐ -->
          <div class="form-group">
            <label class="form-label">
              <i class="fa-solid fa-user"></i> Demandeur (optionnel)
            </label>
            <select v-model="selectedUserId" class="form-select" :disabled="loadingUsers">
              <option :value="null">-- Sélectionner un utilisateur --</option>
              <option 
                v-for="user in users" 
                :key="user.id" 
                :value="user.id"
              >
                {{ user.realname || user.name }} ({{ user.name }})
              </option>
            </select>
            <div v-if="selectedUserId" class="form-hint">
              <i class="fa-solid fa-user-check"></i> Demandeur sélectionné
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Description *</label>
            <textarea v-model="newTicket.description" class="form-textarea" required rows="4" placeholder="Description du ticket"></textarea>
          </div>

          <!-- Cost Section -->
          <div class="form-section">
            <h4 class="form-section-title">Coût Imputé (optionnel)</h4>
            <div class="form-row">
              <div class="form-group half-width">
                <label class="form-label">Durée (minutes)</label>
                <input v-model="costDuration" type="number" min="0" step="1" class="form-input" placeholder="Ex: 30" @input="calculateTotal" />
              </div>
              <div class="form-group half-width">
                <label class="form-label">Taux horaire (€)</label>
                <input v-model="costRate" type="number" min="0" step="0.01" class="form-input" placeholder="Ex: 50.00" @input="calculateTotal" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group half-width">
                <label class="form-label">Coût fixe (€)</label>
                <input v-model="costFixed" type="number" min="0" step="0.01" class="form-input" placeholder="Ex: 100.00" @input="calculateTotal" />
              </div>
              <div class="form-group half-width">
                <label class="form-label">Total estimé (€)</label>
                <div class="total-display">
                  <span class="total-value">{{ calculatedTotal.toFixed(2) }} €</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Equipment Section -->
          <div class="form-section">
            <h4 class="form-section-title">Lier des Équipements (optionnel)</h4>
            <div class="mini-search-box">
              <i class="fa-solid fa-magnifying-glass search-icon-mini"></i>
              <input type="text" v-model="itemSearch" placeholder="Filtrer les matériels par nom ou modèle..." class="form-input form-input-mini" />
            </div>
            <div v-if="loadingItems" class="equipment-loading">
              <i class="fa-solid fa-spinner fa-spin"></i>
              <span>Chargement des équipements...</span>
            </div>
            <div v-else-if="filteredItems.length === 0" class="equipment-empty">
              <i class="fa-solid fa-magnifying-glass-minus"></i>
              <p>Aucun matériel trouvé pour ce filtre.</p>
            </div>
            <div v-else class="equipment-list">
              <div 
                v-for="item in filteredItems" 
                :key="`${item.itemtype}-${item.id}`" 
                class="equipment-item-row"
                :class="{ selected: selectedItemIds.includes(`${item.itemtype}-${item.id}`) }"
              >
                <label class="checkbox-label-container">
                  <input 
                    type="checkbox" 
                    :value="`${item.itemtype}-${item.id}`" 
                    v-model="selectedItemIds"
                    class="checkbox-input"
                  />
                  <span class="checkbox-custom"></span>
                  <span class="eq-icon">
                    <i class="fa-solid" :class="item.itemtype === 'Monitor' ? 'fa-desktop' : 'fa-laptop'"></i>
                  </span>
                  <div class="eq-meta">
                    <span class="eq-name">{{ item.name }}</span>
                    <span class="eq-type-model">{{ item.itemtype }} — {{ item.model }}</span>
                  </div>
                </label>
              </div>
            </div>
            <div class="selected-summary">
              <span>{{ selectedItemIds.length }} matériel(s) sélectionné(s)</span>
            </div>
          </div>

          <div class="dialog-actions">
            <button type="button" @click="showCreateDialog = false" class="btn btn-secondary">Annuler</button>
            <button type="submit" class="btn btn-primary">Créer</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Ticket Details Dialog -->
    <div v-if="showDetailsDialog" class="dialog-overlay" @click="showDetailsDialog = false">
      <div class="dialog-content dialog-content-large" @click.stop>
        <div class="dialog-header">
          <h3>Détails du ticket #{{ selectedTicket?.id }}</h3>
          <button @click="showDetailsDialog = false" class="dialog-close">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        <div v-if="loadingTicketDetails" class="ticket-details-loading">
          <i class="fa-solid fa-spinner fa-spin"></i>
          <span>Chargement des détails...</span>
        </div>
        <div v-else-if="selectedTicket" class="ticket-details">
          <div class="detail-row">
            <span class="detail-label">Titre:</span>
            <span class="detail-value">{{ selectedTicket.name }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Statut:</span>
            <span class="detail-value">{{ getStatusLabel(selectedTicket.status) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Priorité:</span>
            <span class="detail-value">{{ getPriorityLabel(selectedTicket.priority) }}</span>
          </div>
          <div class="detail-row" v-if="selectedTicket._users_id_requester">
            <span class="detail-label">Demandeur:</span>
            <span class="detail-value">{{ getRequesterName(selectedTicket._users_id_requester) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date de création:</span>
            <span class="detail-value">{{ formatDate(selectedTicket.date_creation || selectedTicket.date) }}</span>
          </div>
          <div class="detail-row" v-if="selectedTicket.date_mod">
            <span class="detail-label">Date de modification:</span>
            <span class="detail-value">{{ formatDate(selectedTicket.date_mod) }}</span>
          </div>
          <div class="detail-row full-width">
            <span class="detail-label">Description:</span>
            <p class="detail-value">{{ selectedTicket.content }}</p>
          </div>

          <!-- Cost Section -->
          <div class="detail-section" v-if="ticketCosts.length > 0">
            <h4 class="detail-section-title">Coûts associés</h4>
            <div class="costs-list">
              <div v-for="cost in ticketCosts" :key="cost.id" class="cost-item">
                <div class="cost-name">{{ cost.name || 'Coût' }}</div>
                <div class="cost-details">
                  <span v-if="cost.actiontime">Durée: {{ Math.round(cost.actiontime / 60) }} min</span>
                  <span v-if="cost.cost_time">Coût temps: {{ parseFloat(cost.cost_time).toFixed(2) }} €</span>
                  <span v-if="cost.cost_fixed">Coût fixe: {{ parseFloat(cost.cost_fixed).toFixed(2) }} €</span>
                </div>
                <div class="cost-total">
                  {{ (parseFloat(cost.cost_time || 0) + parseFloat(cost.cost_fixed || 0)).toFixed(2) }} €
                </div>
              </div>
            </div>
            <div class="total-cost-row">
              <span class="total-cost-label">Total des coûts:</span>
              <span class="total-cost-value">{{ totalTicketCost.toFixed(2) }} €</span>
            </div>
          </div>

          <!-- Linked Equipment Section -->
          <div class="detail-section" v-if="ticketLinkedItems.length > 0">
            <h4 class="detail-section-title">Équipements liés</h4>
            <div class="linked-items-list">
              <div v-for="item in ticketLinkedItems" :key="item.id" class="linked-item">
                <span class="linked-item-type">{{ item.itemtype }}</span>
                <span class="linked-item-id">#{{ item.items_id }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="dialog-actions">
          <button @click="showDetailsDialog = false" class="btn btn-secondary">Fermer</button>
        </div>
      </div>
    </div>

    <!-- Status Change Dialog -->
    <div v-if="showStatusDialog" class="dialog-overlay" @click="showStatusDialog = false">
      <div class="dialog-content" @click.stop>
        <div class="dialog-header">
          <h3>Changement de statut</h3>
          <button @click="showStatusDialog = false" class="dialog-close">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        <p class="dialog-message">Voulez-vous ajouter des informations supplémentaires lors de ce changement de statut ?</p>
        <div class="form-group">
          <label class="form-label">Commentaire (optionnel)</label>
          <textarea v-model="statusChangeComment" class="form-textarea" rows="3" placeholder="Ajoutez un commentaire..."></textarea>
        </div>
        <div class="dialog-actions">
          <button @click="showStatusDialog = false" class="btn btn-secondary">Annuler</button>
          <button @click="confirmStatusChange" class="btn btn-primary">Confirmer</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { 
  createTicket as createTicketGLPI, 
  getAllTickets, 
  updateTicketStatus, 
  getAllItems, 
  linkItemToTicket, 
  addTicketCost,
  getTicketCosts, 
  getTicketLinkedItems, 
  getTicketById, 
  getUsers 
} from '../../services/frontoffice/glpi.service'

const columns = ref([
  { id: 'nouveau', name: 'Nouveau', nameMg: 'vaovao', status: 1, color: '#e0f2fe' },
  { id: 'inprogress', name: 'In progress', nameMg: 'efa manao', status: 2, color: '#fef3c7' },
  { id: 'termine', name: 'Terminé', nameMg: 'vita', status: 6, color: '#dcfce7' }
])

const tickets = ref([])
const showCreateDialog = ref(false)
const showDetailsDialog = ref(false)
const showStatusDialog = ref(false)
const selectedTicket = ref(null)
const draggedTicket = ref(null)
const targetStatus = ref(null)
const statusChangeComment = ref('')
const submitting = ref(false)

// Ticket details additional data
const ticketCosts = ref([])
const ticketLinkedItems = ref([])
const loadingTicketDetails = ref(false)

// Cost fields for creation
const costDuration = ref('')
const costRate = ref('')
const costFixed = ref('')
const calculatedTotal = ref(0)

// Utilisateur demandeur
const users = ref([])
const loadingUsers = ref(false)
const selectedUserId = ref(null)

// Computed pour afficher le nom du demandeur sélectionné
const selectedUserDisplay = computed(() => {
  if (!selectedUserId.value) return ''
  const user = users.value.find(u => u.id === selectedUserId.value)
  return user ? (user.realname || user.name) : ''
})

const newTicket = ref({
  title: '',
  description: '',
  priority: 3,
  type: 1,
  status: 1
})

// Equipment fields
const items = ref([])
const loadingItems = ref(false)
const itemSearch = ref('')
const selectedItemIds = ref([])

// Calcul du total pour la création
function calculateTotal() {
  const duration = parseFloat(costDuration.value) || 0
  const rate = parseFloat(costRate.value) || 0
  const fixed = parseFloat(costFixed.value) || 0
  const timeCost = (duration / 60) * rate
  calculatedTotal.value = timeCost + fixed
}

async function fetchTickets() {
  try {
    const data = await getAllTickets()
    tickets.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Failed to fetch tickets:', err)
    tickets.value = []
  }
}

async function fetchEquipments() {
  loadingItems.value = true
  try {
    const data = await getAllItems()
    items.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Failed to load items:', err)
  } finally {
    loadingItems.value = false
  }
}

async function fetchUsers() {
  loadingUsers.value = true
  try {
    const data = await getUsers()
    users.value = Array.isArray(data) ? data : []
    console.log('👥 Utilisateurs chargés:', users.value.length)
  } catch (err) {
    console.error('Failed to load users:', err)
    users.value = []
  } finally {
    loadingUsers.value = false
  }
}

function getRequesterName(userId) {
  if (!userId) return ''
  const user = users.value.find(u => u.id === userId)
  return user ? (user.realname || user.name) : `ID: ${userId}`
}

function getTicketsByStatus(status) {
  return tickets.value.filter(t => t.status === status)
}

const filteredItems = computed(() => {
  if (!itemSearch.value) return items.value
  const query = itemSearch.value.toLowerCase()
  return items.value.filter(item => {
    return (item.name && item.name.toLowerCase().includes(query)) ||
           (item.model && item.model.toLowerCase().includes(query)) ||
           (item.itemtype && item.itemtype.toLowerCase().includes(query))
  })
})

const totalTicketCost = computed(() => {
  return ticketCosts.value.reduce((total, cost) => {
    const timeCost = parseFloat(cost.cost_time) || 0
    const fixedCost = parseFloat(cost.cost_fixed) || 0
    return total + timeCost + fixedCost
  }, 0)
})

function onDragStart(event, ticket) {
  draggedTicket.value = ticket
  event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(event) {
  event.dataTransfer.dropEffect = 'move'
}

function onDrop(event, columnId) {
  event.preventDefault()
  const column = columns.value.find(c => c.id === columnId)
  if (!column || !draggedTicket.value) return

  if (draggedTicket.value.status !== column.status) {
    targetStatus.value = column.status
    showStatusDialog.value = true
  }
}

async function confirmStatusChange() {
  if (!draggedTicket.value || targetStatus.value === null) return

  try {
    await updateTicketStatus(draggedTicket.value.id, targetStatus.value, statusChangeComment.value)
    draggedTicket.value.status = targetStatus.value
    showStatusDialog.value = false
    statusChangeComment.value = ''
    draggedTicket.value = null
    targetStatus.value = null
    await fetchTickets()
  } catch (err) {
    console.error('Failed to update ticket status:', err)
    alert('Erreur lors de la mise à jour du statut')
  }
}

async function createTicket() {
  submitting.value = true
  try {
    const ticketPayload = {
      name: newTicket.value.title,
      content: newTicket.value.description,
      type: newTicket.value.type,
      priority: newTicket.value.priority,
      status: newTicket.value.status
    }
    
    if (selectedUserId.value) {
      ticketPayload._users_id_requester = selectedUserId.value
      console.log('👤 Demandeur associé:', selectedUserDisplay.value, '(ID:', selectedUserId.value, ')')
    }

    const ticketRes = await createTicketGLPI(ticketPayload)
    const newTicketId = ticketRes.id

    let linkedCount = 0
    for (const key of selectedItemIds.value) {
      const [itemtype, id] = key.split('-')
      try {
        await linkItemToTicket(newTicketId, itemtype, parseInt(id))
        linkedCount++
      } catch (err) {
        console.error(`Failed to link asset ${key} to ticket ${newTicketId}:`, err)
      }
    }

    // Ajout du coût si des données sont fournies
    if (costDuration.value || costRate.value || costFixed.value) {
      const duration = parseFloat(costDuration.value) || 0
      const rate = parseFloat(costRate.value) || 0
      const fixed = parseFloat(costFixed.value) || 0
      
      await addTicketCost(newTicketId, {
        duration: duration,
        cost_time: rate,
        cost_fixed: fixed,
        name: 'Coût Intervention'
      })
    }

    showCreateDialog.value = false
    newTicket.value = { title: '', description: '', priority: 3, type: 1, status: 1 }
    selectedItemIds.value = []
    selectedUserId.value = null
    costDuration.value = ''
    costRate.value = ''
    costFixed.value = ''
    calculatedTotal.value = 0

    await fetchTickets()
  } catch (err) {
    console.error('Failed to create ticket:', err)
    alert('Erreur lors de la création du ticket')
  } finally {
    submitting.value = false
  }
}

async function showTicketDetails(ticket) {
  selectedTicket.value = ticket
  loadingTicketDetails.value = true
  ticketCosts.value = []
  ticketLinkedItems.value = []
  showDetailsDialog.value = true

  try {
    const [costs, linkedItems, fullTicket] = await Promise.all([
      getTicketCosts(ticket.id).catch(() => []),
      getTicketLinkedItems(ticket.id).catch(() => []),
      getTicketById(ticket.id).catch(() => ticket)
    ])

    console.log('📊 Coûts reçus de GLPI:', costs)
    costs.forEach(cost => {
      console.log(`  - ${cost.name}: actiontime=${cost.actiontime}s, cost_time=${cost.cost_time}, cost_fixed=${cost.cost_fixed}`)
    })

    ticketCosts.value = costs
    ticketLinkedItems.value = linkedItems

    if (fullTicket && fullTicket.date_mod) {
      selectedTicket.value = { ...ticket, ...fullTicket }
    }
  } catch (err) {
    console.error('Failed to fetch ticket details:', err)
  } finally {
    loadingTicketDetails.value = false
  }
}

function getPriorityClass(priority) {
  const classes = {
    1: 'priority-very-low',
    2: 'priority-low',
    3: 'priority-medium',
    4: 'priority-high',
    5: 'priority-very-high'
  }
  return classes[priority] || 'priority-medium'
}

function getPriorityLabel(priority) {
  const labels = {
    1: 'Très basse',
    2: 'Basse',
    3: 'Moyenne',
    4: 'Haute',
    5: 'Très haute'
  }
  return labels[priority] || 'Moyenne'
}

function getStatusLabel(status) {
  const labels = {
    1: 'Nouveau',
    2: 'En cours',
    6: 'Terminé'
  }
  return labels[status] || 'Inconnu'
}

function truncate(text, length) {
  if (!text) return ''
  return text.length > length ? text.substring(0, length) + '...' : text
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  localStorage.removeItem('glpi_mock_mode')
  fetchTickets()
  fetchEquipments()
  fetchUsers()
})
</script>

<style scoped>
.kanban-container {
  max-width: 1600px;
  margin: 0 auto;
}

.kanban-actions {
  margin-bottom: 1.5rem;
}

.kanban-board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  min-height: 600px;
}

@media (max-width: 1024px) {
  .kanban-board {
    grid-template-columns: 1fr;
  }
}

.kanban-column {
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  min-height: 500px;
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid rgba(0, 0, 0, 0.1);
}

.column-title-block {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.column-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.column-title-mg {
  font-size: 0.72rem;
  color: rgba(0,0,0,0.45);
  font-style: italic;
  font-weight: 500;
}

.column-count {
  background: rgba(0, 0, 0, 0.1);
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-main);
}

.column-tickets {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
}

.ticket-card {
  background: white;
  border-radius: var(--radius-md);
  padding: 1rem;
  border: 1px solid var(--border);
  cursor: move;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.ticket-card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.ticket-card:active {
  cursor: grabbing;
}

.ticket-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.ticket-id {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
}

.ticket-priority {
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
}

.priority-very-low { background: #e0f2fe; color: #0369a1; }
.priority-low { background: #dcfce7; color: #15803d; }
.priority-medium { background: #fef3c7; color: #b45309; }
.priority-high { background: #fed7aa; color: #c2410c; }
.priority-very-high { background: #fecaca; color: #dc2626; }

.ticket-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-main);
  margin: 0 0 0.5rem 0;
  line-height: 1.3;
}

.ticket-description {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin: 0 0 0.75rem 0;
  line-height: 1.4;
}

.ticket-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ticket-date {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Dialog Styles */
.dialog-overlay {
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
}

.dialog-content {
  background: white;
  border-radius: var(--radius-lg);
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.dialog-content-large {
  max-width: 700px;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.dialog-header h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.dialog-close {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: var(--text-muted);
  padding: 0.25rem;
  transition: color 0.2s ease;
}

.dialog-close:hover {
  color: var(--danger);
}

.dialog-message {
  font-size: 0.9rem;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

/* Ticket Details */
.ticket-details-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 0;
  color: var(--text-muted);
}

.ticket-details-loading i {
  font-size: 2rem;
  color: var(--primary);
}

.ticket-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-row {
  display: flex;
  gap: 1rem;
}

.detail-row.full-width {
  flex-direction: column;
  gap: 0.5rem;
}

.detail-label {
  font-weight: 600;
  color: var(--text-muted);
  min-width: 140px;
  font-size: 0.9rem;
}

.detail-value {
  color: var(--text-main);
  font-size: 0.9rem;
  line-height: 1.4;
}

/* Detail Sections */
.detail-section {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}

.detail-section-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 1rem 0;
}

/* Cost List */
.costs-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.cost-item {
  background: white;
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cost-name {
  font-weight: 600;
  color: var(--text-main);
  font-size: 0.85rem;
}

.cost-details {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.cost-details span {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.cost-total {
  font-weight: 700;
  color: var(--success);
  font-size: 0.9rem;
  text-align: right;
}

.total-cost-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.75rem;
  border-top: 2px solid var(--border);
}

.total-cost-label {
  font-weight: 700;
  color: var(--text-main);
  font-size: 0.95rem;
}

.total-cost-value {
  font-weight: 700;
  color: var(--success);
  font-size: 1.1rem;
}

/* Linked Items List */
.linked-items-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.linked-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: white;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.linked-item-type {
  font-weight: 600;
  color: var(--text-main);
  font-size: 0.85rem;
}

.linked-item-id {
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* Form Styles */
.form-row {
  display: flex;
  gap: 1rem;
}

.half-width {
  flex: 1;
}

@media (max-width: 600px) {
  .form-row {
    flex-direction: column;
    gap: 0;
  }
}

.form-group {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  color: var(--text-main);
  background: white;
  transition: border-color 0.2s ease;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--primary);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

/* Form Section */
.form-section {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}

.form-section-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 1rem 0;
}

/* Equipment Selection Styles */
.mini-search-box {
  position: relative;
  margin-bottom: 1rem;
}

.search-icon-mini {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  font-size: 0.9rem;
}

.form-input-mini {
  padding: 0.5rem 0.75rem 0.5rem 2.25rem;
  font-size: 0.85rem;
}

.equipment-loading,
.equipment-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  gap: 0.5rem;
  padding: 2rem 0;
}

.equipment-loading i {
  font-size: 1.5rem;
  color: var(--primary);
}

.equipment-empty i {
  font-size: 1.5rem;
  color: #cbd5e1;
}

.equipment-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  margin-bottom: 0.75rem;
  background: white;
}

.equipment-item-row {
  border-bottom: 1px solid var(--border);
  transition: all 0.15s ease;
}

.equipment-item-row:last-child {
  border-bottom: none;
}

.equipment-item-row:hover {
  background: #f1f5f9;
}

.equipment-item-row.selected {
  background: rgba(16, 185, 129, 0.03);
}

.checkbox-label-container {
  display: flex;
  align-items: center;
  padding: 0.6rem 0.75rem;
  cursor: pointer;
  width: 100%;
}

.checkbox-input {
  display: none;
}

.checkbox-custom {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-radius: 4px;
  margin-right: 0.75rem;
  position: relative;
  background: #fff;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.checkbox-label-container:hover .checkbox-custom {
  border-color: var(--success);
}

.checkbox-input:checked + .checkbox-custom {
  background-color: var(--success);
  border-color: var(--success);
}

.checkbox-input:checked + .checkbox-custom:after {
  content: "";
  position: absolute;
  left: 4px;
  top: 1px;
  width: 3px;
  height: 7px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.eq-icon {
  font-size: 1rem;
  color: var(--text-muted);
  margin-right: 0.75rem;
  width: 20px;
  display: flex;
  justify-content: center;
}

.checkbox-input:checked ~ .eq-icon {
  color: var(--success);
}

.eq-meta {
  display: flex;
  flex-direction: column;
}

.eq-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.2;
}

.eq-type-model {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 0.1rem;
}

.selected-summary {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
  background: white;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  text-align: center;
}

/* Form Hint */
.form-hint {
  margin-top: 0.35rem;
  font-size: 0.75rem;
  color: var(--success);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

/* Cost Section Styles */
.total-display {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 0.75rem;
  background: white;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  height: 38px;
}

.total-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--success);
}
</style>