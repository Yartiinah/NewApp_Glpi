<template>
  <div class="create-ticket-container">
    <header class="page-header">
      <h1 class="page-title">🎫 Création de Ticket d'Assistance</h1>
      <p class="page-subtitle">Déclarez un nouvel incident ou une demande de service et associez-y vos équipements IT.</p>
    </header>

    <div class="ticket-form-layout">
      <!-- Left side: Form fields -->
      <form @submit.prevent="handleSubmit" class="ticket-main-form">
        <div class="card form-card">
          <h2 class="card-title">
            <i class="fa-solid fa-file-pen icon-primary"></i>
            <span>Détails du Ticket</span>
          </h2>

          <!-- Titre -->
          <div class="form-group">
            <label class="form-label" for="ticket-title">Titre du ticket *</label>
            <input 
              v-model="title" 
              type="text" 
              id="ticket-title" 
              placeholder="Ex: Problème d'impression sur l'imprimante réseau..." 
              required 
              :disabled="submitting"
              class="form-input" 
            />
          </div>

          <!-- Type + Priorité -->
          <div class="form-row">
            <div class="form-group half-width">
              <label class="form-label" for="ticket-type">Type d'incident</label>
              <select v-model="type" id="ticket-type" :disabled="submitting" class="form-select">
                <option :value="1">Incident (Dysfonctionnement)</option>
                <option :value="2">Demande (Besoin / Service)</option>
              </select>
            </div>

            <div class="form-group half-width">
              <label class="form-label" for="ticket-priority">Niveau d'urgence</label>
              <select v-model="priority" id="ticket-priority" :disabled="submitting" class="form-select">
                <option :value="1">Très basse</option>
                <option :value="2">Basse</option>
                <option :value="3">Moyenne</option>
                <option :value="4">Haute</option>
                <option :value="5">Très haute (Critique)</option>
              </select>
            </div>
          </div>

          <!-- ⭐ DEMANDEUR (USER) ⭐ -->
          <div class="form-group">
            <label class="form-label" for="ticket-user">
              <i class="fa-solid fa-user"></i> Demandeur
            </label>
            <div class="user-select-wrapper">
              <div class="user-search-box">
                <i class="fa-solid fa-magnifying-glass search-icon-mini"></i>
                <input
                  type="text"
                  v-model="userSearch"
                  placeholder="Rechercher un utilisateur..."
                  class="form-input form-input-mini"
                  :disabled="submitting || loadingUsers"
                  @focus="showUserDropdown = true"
                  @blur="hideUserDropdown"
                />
                <i v-if="loadingUsers" class="fa-solid fa-spinner fa-spin user-loading-icon"></i>
              </div>
              <div v-if="showUserDropdown && filteredUsers.length > 0" class="user-dropdown">
                <div
                  v-for="user in filteredUsers"
                  :key="user.id"
                  class="user-dropdown-item"
                  :class="{ selected: selectedUserId === user.id }"
                  @mousedown.prevent="selectUser(user)"
                >
                  <i class="fa-solid fa-user user-item-icon"></i>
                  <div class="user-item-meta">
                    <span class="user-item-name">{{ user.realname || user.name }}</span>
                    <span class="user-item-login">{{ user.name }}</span>
                  </div>
                  <i v-if="selectedUserId === user.id" class="fa-solid fa-check user-check-icon"></i>
                </div>
              </div>
              <div v-if="showUserDropdown && userSearch && filteredUsers.length === 0 && !loadingUsers" class="user-dropdown">
                <div class="user-dropdown-empty">Aucun utilisateur trouvé</div>
              </div>
            </div>
            <div v-if="selectedUserName" class="selected-user-badge">
              <i class="fa-solid fa-user-check"></i>
              <span>{{ selectedUserName }}</span>
              <button type="button" @click="clearUser" class="clear-user-btn">
                <i class="fa-solid fa-times"></i>
              </button>
            </div>
          </div>

          <!-- Description -->
          <div class="form-group">
            <label class="form-label" for="ticket-desc">Description détaillée *</label>
            <textarea
              v-model="description"
              id="ticket-desc"
              rows="6"
              placeholder="Décrivez précisément le symptôme constaté, le code d'erreur affiché, etc..."
              required
              :disabled="submitting"
              class="form-textarea"
            ></textarea>
          </div>
        </div>

        <!-- Cost Section -->
        <div class="card form-card">
          <h2 class="card-title">
            <i class="fa-solid fa-coins icon-warning"></i>
            <span>Coût Imputé</span>
          </h2>
          <p class="section-desc">Ajoutez un coût estimé pour cette intervention (optionnel).</p>

          <div class="form-row">
            <div class="form-group half-width">
              <label class="form-label" for="cost-duration">Durée (minutes)</label>
              <input
                v-model="costDuration"
                type="number"
                id="cost-duration"
                min="0"
                step="1"
                placeholder="Ex: 30"
                :disabled="submitting"
                class="form-input"
                @input="calculateTotal"
              />
            </div>

            <div class="form-group half-width">
              <label class="form-label" for="cost-rate">Taux horaire (€)</label>
              <input
                v-model="costRate"
                type="number"
                id="cost-rate"
                min="0"
                step="0.01"
                placeholder="Ex: 50.00"
                :disabled="submitting"
                class="form-input"
                @input="calculateTotal"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group half-width">
              <label class="form-label" for="cost-fixed">Coût fixe (€)</label>
              <input
                v-model="costFixed"
                type="number"
                id="cost-fixed"
                min="0"
                step="0.01"
                placeholder="Ex: 100.00"
                :disabled="submitting"
                class="form-input"
                @input="calculateTotal"
              />
            </div>

            <div class="form-group half-width">
              <label class="form-label">Total estimé (€)</label>
              <div class="total-display">
                <span class="total-value">{{ calculatedTotal.toFixed(2) }} €</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Submit actions -->
        <div class="form-actions-card">
          <div v-if="successMessage" class="alert alert-success">
            <i class="fa-solid fa-circle-check"></i>
            <span>{{ successMessage }}</span>
          </div>

          <div v-if="errorMessage" class="alert alert-error">
            <i class="fa-solid fa-circle-exclamation"></i>
            <span>{{ errorMessage }}</span>
          </div>

          <div class="submit-row">
            <button type="button" @click="resetForm" :disabled="submitting" class="btn btn-secondary">
              Réinitialiser
            </button>
            <button type="submit" :disabled="submitting || !title || !description" class="btn btn-primary btn-submit">
              <i class="fa-solid" :class="submitting ? 'fa-spinner fa-spin' : 'fa-paper-plane'"></i>
              <span>{{ submitting ? 'Envoi en cours...' : 'Déclarer le Ticket GLPI' }}</span>
            </button>
          </div>
        </div>
      </form>

      <!-- Right side: Equipment Association -->
      <div class="equipment-selection-panel">
        <div class="card equipment-card">
          <h2 class="card-title">
            <i class="fa-solid fa-laptop-medical icon-success"></i>
            <span>Lier des Équipements</span>
          </h2>
          <p class="section-desc">Cochez les matériels affectés par ce problème pour les associer à votre déclaration.</p>

          <!-- Search items -->
          <div class="mini-search-box">
            <i class="fa-solid fa-magnifying-glass search-icon-mini"></i>
            <input 
              type="text" 
              v-model="itemSearch" 
              placeholder="Filtrer les matériels par nom ou modèle..." 
              class="form-input form-input-mini" 
            />
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
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { createTicket, getAllItems, linkItemToTicket, addTicketCost, getUsers } from '../../services/frontoffice/glpi.service'

// Champs du formulaire de ticket
const title = ref('')
const type = ref(1)
const priority = ref(3)
const description = ref('')

// Champs utilisateur demandeur
const users = ref([])
const loadingUsers = ref(false)
const userSearch = ref('')
const showUserDropdown = ref(false)
const selectedUserId = ref(null)
const selectedUserName = ref('')

// Champs de coût
const costDuration = ref('')
const costRate = ref('')
const costFixed = ref('')
const calculatedTotal = ref(0)

// Liste des équipements disponibles
const items = ref([])
const loadingItems = ref(false)
const itemSearch = ref('')
const selectedItemIds = ref([])

// État du formulaire
const submitting = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

// Charge la liste des équipements depuis GLPI
async function fetchEquipments() {
  loadingItems.value = true
  try {
    const data = await getAllItems()
    items.value = Array.isArray(data) ? data : []
    console.log('📦 Équipements chargés:', items.value.length)
  } catch (err) {
    console.error('Failed to load items:', err)
  } finally {
    loadingItems.value = false
  }
}

// Charge la liste des utilisateurs depuis GLPI
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

// Filtre les utilisateurs selon la recherche
const filteredUsers = computed(() => {
  if (!userSearch.value) return users.value.slice(0, 20)
  const q = userSearch.value.toLowerCase()
  return users.value.filter(u =>
    (u.name && u.name.toLowerCase().includes(q)) ||
    (u.realname && u.realname.toLowerCase().includes(q))
  ).slice(0, 20)
})

function selectUser(user) {
  selectedUserId.value = user.id
  selectedUserName.value = user.realname || user.name
  userSearch.value = ''
  showUserDropdown.value = false
}

function clearUser() {
  selectedUserId.value = null
  selectedUserName.value = ''
  userSearch.value = ''
}

function hideUserDropdown() {
  setTimeout(() => { showUserDropdown.value = false }, 150)
}

// Filtre les équipements selon la recherche
const filteredItems = computed(() => {
  if (!itemSearch.value) return items.value
  const query = itemSearch.value.toLowerCase()
  return items.value.filter(item => {
    return (item.name && item.name.toLowerCase().includes(query)) ||
           (item.model && item.model.toLowerCase().includes(query)) ||
           (item.itemtype && item.itemtype.toLowerCase().includes(query))
  })
})

// Calcule le total du coût
function calculateTotal() {
  const duration = parseFloat(costDuration.value) || 0
  const rate = parseFloat(costRate.value) || 0
  const fixed = parseFloat(costFixed.value) || 0
  const timeCost = (duration / 60) * rate
  calculatedTotal.value = timeCost + fixed
}

// Soumet le formulaire de création de ticket
async function handleSubmit() {
  submitting.value = true
  successMessage.value = ''
  errorMessage.value = ''

  try {
    // Prépare les données du ticket
    const ticketPayload = {
      name: title.value,
      content: description.value,
      type: type.value,
      priority: priority.value,
      status: 1
    }
    
    // Ajouter l'utilisateur demandeur si sélectionné
    if (selectedUserId.value) {
      ticketPayload._users_id_requester = selectedUserId.value
      console.log('👤 Demandeur associé:', selectedUserName.value, '(ID:', selectedUserId.value, ')')
    }

    // 1. Crée le ticket dans GLPI
    const ticketRes = await createTicket(ticketPayload)
    const newTicketId = ticketRes.id

    // 2. Lie les équipements sélectionnés au ticket
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

    // 3. Ajoute le coût si des données de coût sont fournies
    let costAdded = false
    if (costDuration.value || costRate.value || costFixed.value) {
      try {
        const duration = parseFloat(costDuration.value) || 0
        const rate = parseFloat(costRate.value) || 0
        const fixed = parseFloat(costFixed.value) || 0
        const timeCost = (duration / 60) * rate

        await addTicketCost(newTicketId, {
          duration: duration,
          cost_time: timeCost,
          cost_fixed: fixed
        })
        costAdded = true
      } catch (err) {
        console.error(`Failed to add cost to ticket ${newTicketId}:`, err)
      }
    }

    let message = `Ticket #${newTicketId} déclaré avec succès dans GLPI ! ${linkedCount} équipement(s) lié(s).`
    if (selectedUserId.value) message += ` Demandeur: ${selectedUserName.value}.`
    if (costAdded) message += ` Coût imputé: ${calculatedTotal.value.toFixed(2)} €.`
    successMessage.value = message
    
    // Réinitialise le formulaire
    resetForm()
    
  } catch (err) {
    errorMessage.value = `Échec de déclaration du ticket : ${err.message}`
    console.error('❌ Erreur création ticket:', err)
  } finally {
    submitting.value = false
  }
}

// Réinitialise complètement le formulaire
function resetForm() {
  title.value = ''
  description.value = ''
  type.value = 1
  priority.value = 3
  selectedItemIds.value = []
  costDuration.value = ''
  costRate.value = ''
  costFixed.value = ''
  calculatedTotal.value = 0
  successMessage.value = ''
  errorMessage.value = ''
  selectedUserId.value = null
  selectedUserName.value = ''
  userSearch.value = ''
  // Ne pas réinitialiser les listes users et items (garder le cache)
}

// Charge les données au montage du composant
onMounted(() => {
  localStorage.removeItem('glpi_mock_mode')
  fetchEquipments()
  fetchUsers()
})
</script>

<style scoped>
.create-ticket-container {
  max-width: 1400px;
  margin: 0 auto;
}

.ticket-form-layout {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 2rem;
  align-items: start;
}

@media (max-width: 1024px) {
  .ticket-form-layout {
    grid-template-columns: 1fr;
  }
}

.ticket-main-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-card {
  padding: 2rem;
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.icon-primary { color: #3b82f6; }
.icon-success { color: #10b981; }
.icon-warning { color: #f59e0b; }

.form-row {
  display: flex;
  gap: 1.5rem;
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
  font-size: 0.85rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.5rem;
}

.form-input, .form-select, .form-textarea {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  transition: border-color 0.2s;
}

.form-input:focus, .form-select:focus, .form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  resize: vertical;
}

.form-actions-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.submit-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-submit {
  padding: 0.85rem 2rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #f1f5f9;
  color: #1e293b;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover:not(:disabled) {
  background: #e2e8f0;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Equipment Selection Panel */
.equipment-selection-panel {
  position: sticky;
  top: 1rem;
}

.equipment-card {
  padding: 2rem;
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  height: 580px;
}

.section-desc {
  font-size: 0.85rem;
  color: #64748b;
  margin-bottom: 1.25rem;
}

.mini-search-box {
  position: relative;
  margin-bottom: 1.25rem;
}

.search-icon-mini {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  font-size: 0.9rem;
}

.form-input-mini {
  padding: 0.5rem 0.75rem 0.5rem 2.25rem;
  font-size: 0.85rem;
  border-radius: 0.375rem;
}

.equipment-loading, .equipment-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #64748b;
  gap: 0.75rem;
}

.equipment-loading i {
  font-size: 2rem;
  color: #3b82f6;
}

.equipment-empty i {
  font-size: 2.5rem;
  color: #cbd5e1;
}

.equipment-list {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  background: #f8fafc;
}

.equipment-item-row {
  border-bottom: 1px solid #e2e8f0;
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
  padding: 0.85rem 1rem;
  cursor: pointer;
  width: 100%;
}

.checkbox-input {
  display: none;
}

.checkbox-custom {
  width: 18px;
  height: 18px;
  border: 2px solid #cbd5e1;
  border-radius: 5px;
  margin-right: 0.85rem;
  position: relative;
  background: #fff;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.checkbox-label-container:hover .checkbox-custom {
  border-color: #10b981;
}

.checkbox-input:checked + .checkbox-custom {
  background-color: #10b981;
  border-color: #10b981;
}

.checkbox-input:checked + .checkbox-custom:after {
  content: "";
  position: absolute;
  left: 5px;
  top: 1px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.eq-icon {
  font-size: 1.15rem;
  color: #64748b;
  margin-right: 0.85rem;
  width: 24px;
  display: flex;
  justify-content: center;
}

.checkbox-input:checked ~ .eq-icon {
  color: #10b981;
}

.eq-meta {
  display: flex;
  flex-direction: column;
}

.eq-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.2;
}

.eq-type-model {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.15rem;
}

.selected-summary {
  font-size: 0.85rem;
  font-weight: 700;
  color: #64748b;
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  text-align: center;
}

/* User Select Styles */
.user-select-wrapper {
  position: relative;
}

.user-search-box {
  position: relative;
}

.user-loading-icon {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #3b82f6;
  font-size: 0.85rem;
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  z-index: 100;
  max-height: 220px;
  overflow-y: auto;
}

.user-dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid #e2e8f0;
}

.user-dropdown-item:last-child {
  border-bottom: none;
}

.user-dropdown-item:hover {
  background: #f1f5f9;
}

.user-dropdown-item.selected {
  background: #eff6ff;
}

.user-item-icon {
  color: #64748b;
  font-size: 0.9rem;
  width: 16px;
}

.user-item-meta {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.user-item-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: #1e293b;
}

.user-item-login {
  font-size: 0.75rem;
  color: #64748b;
}

.user-check-icon {
  color: #3b82f6;
  font-size: 0.85rem;
}

.user-dropdown-empty {
  padding: 1rem;
  text-align: center;
  color: #64748b;
  font-size: 0.85rem;
}

.selected-user-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  background: #eff6ff;
  color: #3b82f6;
  padding: 0.35rem 0.75rem;
  border-radius: 20px;
  font-size: 0.82rem;
  font-weight: 600;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.clear-user-btn {
  background: none;
  border: none;
  color: #3b82f6;
  cursor: pointer;
  padding: 0;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  opacity: 0.7;
  transition: opacity 0.15s;
}

.clear-user-btn:hover {
  opacity: 1;
}

/* Cost Section Styles */
.total-display {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  height: 42px;
}

.total-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: #10b981;
}

/* Alert Messages */
.alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}

.alert-success {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.alert-error {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

/* Page Header */
.page-header {
  margin-bottom: 2rem;
}

.page-title {
  font-size: 1.8rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.25rem;
}

.page-subtitle {
  color: #64748b;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>