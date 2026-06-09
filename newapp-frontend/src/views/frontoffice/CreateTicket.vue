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
// Importation des fonctions Vue réactives
import { ref, computed, onMounted } from 'vue'
// Importation des services GLPI
import { createTicket, getAllItems, linkItemToTicket, addTicketCost } from '../../services/frontoffice/glpi.service'

// Champs du formulaire de ticket
const title = ref('') // Titre du ticket
const type = ref(1) // Type: 1=Incident, 2=Demande
const priority = ref(3) // Priorité: 3=Moyenne
const description = ref('') // Description détaillée

// Champs de coût
const costDuration = ref('') // Durée en minutes
const costRate = ref('') // Taux horaire
const costFixed = ref('') // Coût fixe
const calculatedTotal = ref(0) // Total calculé

// Liste des équipements disponibles
const items = ref([])
const loadingItems = ref(false) // Indicateur de chargement
const itemSearch = ref('') // Recherche d'équipement
const selectedItemIds = ref([]) // IDs des équipements sélectionnés (format: "itemtype-id")

// État du formulaire
const submitting = ref(false) // Indicateur d'envoi
const successMessage = ref('') // Message de succès
const errorMessage = ref('') // Message d'erreur

// Charge la liste des équipements depuis GLPI
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

  // Calcul: (durée en minutes / 60) * taux horaire + coût fixe
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
      status: 1 // Toujours commence à 1: Nouveau
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
    if (costAdded) {
      message += ` Coût imputé: ${calculatedTotal.value.toFixed(2)} €.`
    }
    successMessage.value = message
    
    // Réinitialise le formulaire mais garde les équipements en cache
    title.value = ''
    description.value = ''
    selectedItemIds.value = []
    costDuration.value = ''
    costRate.value = ''
    costFixed.value = ''
    calculatedTotal.value = 0
    
  } catch (err) {
    errorMessage.value = `Échec de déclaration du ticket : ${err.message}`
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
}

// Charge les équipements au montage du composant
onMounted(() => {
  fetchEquipments()
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
}

.icon-primary { color: var(--primary); }
.icon-success { color: var(--success); }
.icon-warning { color: var(--warning); }

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

.form-actions-card {
  background: white;
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
}

.submit-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-submit {
  padding: 0.85rem 2rem;
}

/* Equipment Selection Panel */
.equipment-card {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  height: 580px;
}

.section-desc {
  font-size: 0.85rem;
  color: var(--text-muted);
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
  color: var(--text-muted);
  font-size: 0.9rem;
}

.form-input-mini {
  padding: 0.5rem 0.75rem 0.5rem 2.25rem;
  font-size: 0.85rem;
  border-radius: var(--radius-sm);
}

.equipment-loading, .equipment-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  gap: 0.75rem;
}

.equipment-loading i {
  font-size: 2rem;
  color: var(--primary);
}

.equipment-empty i {
  font-size: 2.5rem;
  color: #cbd5e1;
}

.equipment-list {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
  background: #f8fafc;
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
  border: 2px solid var(--border);
  border-radius: 5px;
  margin-right: 0.85rem;
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
  color: var(--text-muted);
  margin-right: 0.85rem;
  width: 24px;
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
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.2;
}

.eq-type-model {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.15rem;
}

.selected-summary {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-muted);
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  text-align: center;
}

/* Cost Section Styles */
.total-display {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  height: 42px;
}

.total-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--success);
}
</style>
