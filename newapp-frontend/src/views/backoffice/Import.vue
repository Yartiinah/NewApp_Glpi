<template>
  <div class="import-container">
    <header class="page-header">
      <h1 class="page-title">📂 Importation de données vers GLPI</h1>
      <p class="page-subtitle">Import tout-ou-rien vers GLPI : 1) Éléments → 2) Tickets → 3) Coûts. En cas d'erreur, rien n'est enregistré.</p>
    </header>

    <div class="import-grid">
      <!-- Left Panel: Import Cards -->
      <div class="import-cards-panel">
        
        <!-- CARD 1: Elements (Computers/Monitors) -->
        <div class="card import-card" :class="{ 'card-active': activeType === 'elements' }">
          <div class="card-header-with-icon">
            <div class="icon-box blue-bg">
              <i class="fa-solid fa-laptop"></i>
            </div>
            <div>
              <h2 class="card-section-title">1. Éléments & Équipements</h2>
              <p class="card-section-subtitle">Importation d'ordinateurs, moniteurs et matériels</p>
            </div>
          </div>
          <div class="card-body-section">
            <div class="file-drop-area">
              <input type="file" id="file-elements" accept=".csv" @change="(e) => handleFileChange(e, 'elements')" class="file-input-hidden" />
              <label for="file-elements" class="file-label">
                <i class="fa-solid fa-cloud-arrow-up cloud-icon"></i>
                <span class="file-text-main">Cliquez pour choisir le fichier CSV</span>
                <span class="file-text-sub">Format requis : Name, Status, Location, Manufacturer, Item_Type, Model, Inventory_Number, User</span>
              </label>
            </div>
          </div>
        </div>

        <!-- CARD 2: Tickets -->
        <div class="card import-card" :class="{ 'card-active': activeType === 'tickets' }">
          <div class="card-header-with-icon">
            <div class="icon-box green-bg">
              <i class="fa-solid fa-ticket"></i>
            </div>
            <div>
              <h2 class="card-section-title">2. Tickets d'Assistance</h2>
              <p class="card-section-subtitle">Création en lot de tickets d'incident ou demande</p>
            </div>
          </div>
          <div class="card-body-section">
            <div class="file-drop-area">
              <input type="file" id="file-tickets" accept=".csv" @change="(e) => handleFileChange(e, 'tickets')" class="file-input-hidden" />
              <label for="file-tickets" class="file-label">
                <i class="fa-solid fa-cloud-arrow-up cloud-icon"></i>
                <span class="file-text-main">Cliquez pour choisir le fichier CSV</span>
                <span class="file-text-sub">Format requis : Ref_Ticket, Date, Heure, Type, Titre, Description, Status, Priority, Items</span>
              </label>
            </div>
          </div>
        </div>

        <!-- CARD 3: Costs -->
        <div class="card import-card" :class="{ 'card-active': activeType === 'costs' }">
          <div class="card-header-with-icon">
            <div class="icon-box amber-bg">
              <i class="fa-solid fa-hand-holding-dollar"></i>
            </div>
            <div>
              <h2 class="card-section-title">3. Coûts des Tickets</h2>
              <p class="card-section-subtitle">Enregistrement des coûts de temps et matériels fixes</p>
            </div>
          </div>
          <div class="card-body-section">
            <div class="file-drop-area">
              <input type="file" id="file-costs" accept=".csv" @change="(e) => handleFileChange(e, 'costs')" class="file-input-hidden" />
              <label for="file-costs" class="file-label">
                <i class="fa-solid fa-cloud-arrow-up cloud-icon"></i>
                <span class="file-text-main">Cliquez pour choisir le fichier CSV</span>
                <span class="file-text-sub">Format requis : Num_Ticket, Duration_second, Time_Cost, Fixed_Cost</span>
              </label>
            </div>
          </div>
        </div>

        <!-- CARD 4: ZIP Images -->
        <div class="card import-card" :class="{ 'card-active': activeType === 'zip' }">
          <div class="card-header-with-icon">
            <div class="icon-box purple-bg">
              <i class="fa-solid fa-file-archive"></i>
            </div>
            <div>
              <h2 class="card-section-title">4. Galerie d'Images (ZIP)</h2>
              <p class="card-section-subtitle">Chargement de photos d'équipements pour tickets</p>
            </div>
          </div>
          <div class="card-body-section">
            <div class="zip-download-info">
              <span>Téléchargez le ZIP de test : </span>
              <a :href="zipUrl" target="_blank" class="download-link">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Google Drive ZIP
              </a>
            </div>
            <div class="file-drop-area">
              <input type="file" id="file-zip" accept=".zip" @change="(e) => handleFileChange(e, 'zip')" class="file-input-hidden" />
              <label for="file-zip" class="file-label">
                <i class="fa-solid fa-cloud-arrow-up cloud-icon"></i>
                <span class="file-text-main">Cliquez pour choisir le fichier ZIP</span>
                <span class="file-text-sub">Le ZIP doit contenir des images (.jpg, .jpeg, .png, .gif, .webp, .bmp, .svg)</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel: Preview & Actions -->
      <div class="preview-actions-panel">
        <div class="card preview-card">
          <h2 class="card-title">
            <i class="fa-solid fa-magnifying-glass-chart"></i>
            <span>Aperçu de l'import</span>
          </h2>

          <div v-if="!selectedFile" class="preview-empty">
            <i class="fa-regular fa-file-excel preview-empty-icon"></i>
            <p>Veuillez sélectionner un fichier CSV ou ZIP à gauche pour visualiser les données avant l'importation.</p>
          </div>

          <div v-else class="preview-content">
            <div class="preview-file-info">
              <span class="file-detail-name">
                <i class="fa-solid fa-file-code"></i> {{ selectedFile.name }}
              </span>
              <span class="file-detail-size">({{ formatBytes(selectedFile.size) }})</span>
            </div>

            <!-- CSV Preview Table -->
            <div v-if="previewHeaders.length" class="table-container preview-table-container">
              <table class="custom-table table-mini">
                <thead>
                  <tr>
                    <th v-for="h in previewHeaders" :key="h">{{ h }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in previewRows" :key="idx">
                    <td v-for="h in previewHeaders" :key="h" :title="row[h]">{{ row[h] }}</td>
                  </tr>
                </tbody>
              </table>
              <div class="preview-count-banner">
                <span>Affichage des 5 premières lignes sur {{ totalRowsCount }} détectées.</span>
              </div>
            </div>

            <!-- ZIP Preview Details -->
            <div v-if="activeType === 'zip'" class="zip-preview-details">
              <div class="zip-bullet">
                <i class="fa-solid fa-circle-check"></i>
                <span>Fichier archive ZIP valide</span>
              </div>
              <div class="zip-bullet">
                <i class="fa-solid fa-circle-check"></i>
                <span>Extraction des images (.jpg, .jpeg, .png, .gif, .webp, .bmp, .svg)</span>
              </div>
            </div>

            <!-- Progress & Actions -->
            <div class="import-action-zone">
              <div v-if="progress > 0" class="progress-wrapper">
                <div class="progress-bar-container">
                  <div class="progress-bar-fill" :style="{ width: progress + '%' }"></div>
                </div>
                <div class="progress-stats">
                  <span>Progression : {{ progress }}%</span>
                  <span v-if="progress === 100">Traitement finalisé</span>
                </div>
              </div>

              <!-- Message banner -->
              <div v-if="resultMessage" class="alert" :class="isSuccess ? 'alert-success' : 'alert-error'">
                <i class="fa-solid" :class="isSuccess ? 'fa-circle-check' : 'fa-circle-exclamation'"></i>
                <span>{{ resultMessage }}</span>
              </div>

              <div class="action-buttons">
                <button @click="resetSelection" :disabled="loading" class="btn btn-secondary">
                  <span>Annuler</span>
                </button>
                <button @click="triggerImport" :disabled="loading" class="btn btn-primary">
                  <i class="fa-solid" :class="loading ? 'fa-spinner fa-spin' : 'fa-circle-play'"></i>
                  <span>Lancer l'importation vers GLPI</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { 
  importElementsCSV, 
  importTicketsCSV, 
  importCostsCSV, 
  importImagesZIP,
  clearImportCache,
  parseCSV
} from '../../services/backoffice/import.service.js'

const activeType = ref('')
const selectedFile = ref(null)
const previewHeaders = ref([])
const previewRows = ref([])
const totalRowsCount = ref(0)
const loading = ref(false)
const progress = ref(0)
const resultMessage = ref('')
const isSuccess = ref(false)

const zipUrl = 'https://drive.google.com/file/d/15hjM0xNZ9ui8crPUiT8f33TWr5ZvJg30/view'

function handleFileChange(event, type) {
  const file = event.target.files[0]
  if (!file) return

  // Reset states
  activeType.value = type
  selectedFile.value = file
  previewHeaders.value = []
  previewRows.value = []
  totalRowsCount.value = 0
  progress.value = 0
  resultMessage.value = ''
  isSuccess.value = false

  if (type === 'zip') {
    event.target.value = ''
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    const rows = parseCSV(e.target.result)
    if (rows.length === 0) return

    previewHeaders.value = Object.keys(rows[0])
    totalRowsCount.value = rows.length
    previewRows.value = rows.slice(0, 5)
  }
  reader.readAsText(file)
  event.target.value = ''
}

async function triggerImport() {
  if (!selectedFile.value) return

  loading.value = true
  progress.value = 5 // Start with positive progress
  resultMessage.value = ''
  
  try {
    let result
    if (activeType.value === 'elements') {
      result = await importElementsCSV(selectedFile.value, (p) => { progress.value = p })
    } else if (activeType.value === 'tickets') {
      // Clear cache when starting fresh ticket import to renew references
      clearImportCache()
      result = await importTicketsCSV(selectedFile.value, (p) => { progress.value = p })
    } else if (activeType.value === 'costs') {
      result = await importCostsCSV(selectedFile.value, (p) => { progress.value = p })
    } else if (activeType.value === 'zip') {
      result = await importImagesZIP(selectedFile.value, (p) => { progress.value = p })
    }

    if (result?.success) {
      isSuccess.value = true
      resultMessage.value = result.message
    } else {
      isSuccess.value = false
      resultMessage.value = result?.message || "Une erreur est survenue lors de l'importation."
    }
  } catch (err) {
    isSuccess.value = false
    resultMessage.value = `Erreur critique : ${err.message}`
  } finally {
    loading.value = false
  }
}

function resetSelection() {
  activeType.value = ''
  selectedFile.value = null
  previewHeaders.value = []
  previewRows.value = []
  totalRowsCount.value = 0
  progress.value = 0
  resultMessage.value = ''
  isSuccess.value = false
}

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}
</script>

<style scoped>
.import-container {
  max-width: 1400px;
  margin: 0 auto;
}

.import-grid {
  display: grid;
  grid-template-columns: 1.2fr 1.5fr;
  gap: 2rem;
  align-items: start;
}

@media (max-width: 1024px) {
  .import-grid {
    grid-template-columns: 1fr;
  }
}

.import-cards-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.import-card {
  padding: 1.5rem;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.import-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.card-active {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.card-header-with-icon {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.icon-box {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.blue-bg { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
.green-bg { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.amber-bg { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
.purple-bg { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }

.card-section-title {
  font-family: var(--font-title);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main);
}

.card-section-subtitle {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.file-drop-area {
  position: relative;
  border: 2px dashed var(--border);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  text-align: center;
  background: #f8fafc;
  transition: all 0.2s ease;
  cursor: pointer;
}

.file-drop-area:hover {
  border-color: var(--primary);
  background: rgba(59, 130, 246, 0.02);
}

.file-input-hidden {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.file-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.cloud-icon {
  font-size: 2rem;
  color: var(--text-muted);
  transition: color 0.2s ease;
}

.file-drop-area:hover .cloud-icon {
  color: var(--primary);
}

.file-text-main {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-main);
}

.file-text-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
  max-width: 90%;
  line-height: 1.3;
}

.zip-download-info {
  margin-bottom: 0.75rem;
  font-size: 0.8rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.download-link {
  color: var(--primary);
  text-decoration: none;
  font-weight: 600;
}

.download-link:hover {
  text-decoration: underline;
}

/* Preview Panel CSS */
.preview-card {
  min-height: 520px;
  display: flex;
  flex-direction: column;
}

.preview-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-muted);
  padding: 2rem;
  gap: 1rem;
}

.preview-empty-icon {
  font-size: 4rem;
  color: #cbd5e1;
}

.preview-content {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.preview-file-info {
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  margin-bottom: 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.file-detail-name {
  font-weight: 700;
  color: var(--text-main);
}

.file-detail-size {
  color: var(--text-muted);
}

.preview-table-container {
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  margin-bottom: 0.75rem;
}

.table-mini {
  font-size: 0.75rem;
}

.table-mini th {
  padding: 0.6rem 0.8rem;
}

.table-mini td {
  padding: 0.6rem 0.8rem;
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-count-banner {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 500;
  margin-bottom: 1.5rem;
}

.zip-preview-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: rgba(139, 92, 246, 0.05);
  border: 1px solid rgba(139, 92, 246, 0.15);
  border-radius: var(--radius-md);
}

.zip-bullet {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #6d28d9;
  font-weight: 500;
}

.import-action-zone {
  margin-top: auto;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
}

.progress-wrapper {
  margin-bottom: 1.25rem;
}

.progress-bar-container {
  height: 8px;
  background: #f1f5f9;
  border-radius: 9999px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6 0%, #10b981 100%);
  border-radius: 9999px;
  transition: width 0.3s ease;
}

.progress-stats {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
}

.action-buttons {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.25rem;
}
</style>