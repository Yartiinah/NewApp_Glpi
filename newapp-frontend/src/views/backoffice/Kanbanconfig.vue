<template>
  <div class="kanban-cfg-page">
    <header class="page-header">
      <div class="header-left">
        <h1 class="page-title">🎨 Configuration Kanban</h1>
        <p class="page-subtitle">Personnalisez les couleurs et les noms des colonnes (français / malgache)</p>
      </div>
      <div class="header-right">
        <button @click="saveAll" :disabled="saving || loading" class="btn btn-primary">
          <i class="fa-solid" :class="saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'"></i>
          <span>{{ saving ? 'sEnregistrement...' : 'Sauvegarder' }}</span>
        </button>
      </div>
    </header>

    <!-- Alert -->
    <transition name="fade">
      <div v-if="alert.message" class="alert-banner" :class="alert.type">
        <i class="fa-solid" :class="alert.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'"></i>
        {{ alert.message }}
      </div>
    </transition>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <span>Chargement de la configuration...</span>
    </div>

    <div v-else class="columns-grid">
      <div
        v-for="col in columns"
        :key="col.id"
        class="column-card"
        :style="{ borderTopColor: form[col.colorKey] }"
      >
        <!-- Preview header -->
        <div class="column-preview" :style="{ backgroundColor: form[col.colorKey] }">
          <span class="preview-label">Aperçu colonne</span>
          <span class="preview-count">3</span>
        </div>

        <div class="column-card-body">
          <h3 class="column-card-title">
            <span class="col-dot" :style="{ background: form[col.colorKey] }"></span>
            {{ col.label }}
          </h3>

          <!-- Couleur -->
          <div class="field-group">
            <label class="field-label">
              <i class="fa-solid fa-palette"></i> Couleur de fond
            </label>
            <div class="color-row">
              <input
                type="color"
                v-model="form[col.colorKey]"
                class="color-picker"
                :title="'Couleur ' + col.label"
              />
              <input
                type="text"
                v-model="form[col.colorKey]"
                class="color-text-input"
                placeholder="#e0f2fe"
                @input="validateHex(col.colorKey)"
              />
            </div>
            <div class="color-presets">
              <button
                v-for="preset in colorPresets"
                :key="preset"
                class="color-preset-btn"
                :style="{ backgroundColor: preset }"
                :class="{ active: form[col.colorKey] === preset }"
                @click="form[col.colorKey] = preset"
                :title="preset"
              ></button>
            </div>
          </div>

          <!-- Nom FR -->
          <div class="field-group">
            <label class="field-label">
              <span class="flag">🇫🇷</span> Nom en français
            </label>
            <input
              type="text"
              v-model="form[col.nameFrKey]"
              class="field-input"
              :placeholder="col.defaultFr"
            />
          </div>

          <!-- Nom MG -->
          <div class="field-group">
            <label class="field-label">
              <span class="flag">🇲🇬</span> Nom en malgache
            </label>
            <input
              type="text"
              v-model="form[col.nameMgKey]"
              class="field-input"
              :placeholder="col.defaultMg"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Live Preview -->
    <div v-if="!loading" class="preview-section">
      <h2 class="preview-section-title">👁️ Aperçu du tableau Kanban</h2>
      <div class="kanban-preview-board">
        <div
          v-for="col in columns"
          :key="col.id"
          class="kanban-preview-col"
          :style="{ backgroundColor: form[col.colorKey] }"
        >
          <div class="kanban-preview-header">
            <span class="kanban-preview-name">{{ form[col.nameFrKey] || col.defaultFr }}</span>
            <span class="kanban-preview-name-mg">{{ form[col.nameMgKey] || col.defaultMg }}</span>
            <span class="kanban-preview-count">2</span>
          </div>
          <div class="kanban-preview-card">Ticket exemple #1</div>
          <div class="kanban-preview-card">Ticket exemple #2</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getKanbanConfig, saveKanbanConfig } from '../../services/backoffice/kanbanConfig.service'

const loading = ref(true)
const saving  = ref(false)
const alert   = reactive({ message: '', type: 'success' })

const columns = [
  {
    id: 'nouveau',
    label: 'Nouveau',
    colorKey:  'column_nouveau_color',
    nameFrKey: 'column_nouveau_name_fr',
    nameMgKey: 'column_nouveau_name_mg',
    defaultFr: 'Nouveau',
    defaultMg: 'vaovao'
  },
  {
    id: 'inprogress',
    label: 'In Progress',
    colorKey:  'column_inprogress_color',
    nameFrKey: 'column_inprogress_name_fr',
    nameMgKey: 'column_inprogress_name_mg',
    defaultFr: 'In progress',
    defaultMg: 'efa manao'
  },
  {
    id: 'termine',
    label: 'Terminé',
    colorKey:  'column_termine_color',
    nameFrKey: 'column_termine_name_fr',
    nameMgKey: 'column_termine_name_mg',
    defaultFr: 'Terminé',
    defaultMg: 'vita'
  }
]

const colorPresets = [
  '#e0f2fe', '#dbeafe', '#ede9fe', '#fce7f3',
  '#fef3c7', '#fef9c3', '#fed7aa', '#fecaca',
  '#dcfce7', '#d1fae5', '#ccfbf1', '#cffafe',
  '#f1f5f9', '#f8fafc', '#e2e8f0', '#fff7ed'
]

// Formulaire réactif
const form = reactive({
  column_nouveau_color:      '#e0f2fe',
  column_inprogress_color:   '#fef3c7',
  column_termine_color:      '#dcfce7',
  column_nouveau_name_fr:    'Nouveau',
  column_inprogress_name_fr: 'In progress',
  column_termine_name_fr:    'Terminé',
  column_nouveau_name_mg:    'vaovao',
  column_inprogress_name_mg: 'efa manao',
  column_termine_name_mg:    'vita'
})

function showAlert(message, type = 'success') {
  alert.message = message
  alert.type = type
  setTimeout(() => { alert.message = '' }, 4000)
}

function validateHex(key) {
  const val = form[key]
  if (!val.startsWith('#')) form[key] = '#' + val.replace('#', '')
}

async function loadConfig() {
  loading.value = true
  try {
    const config = await getKanbanConfig()
    for (const key of Object.keys(form)) {
      if (config[key] !== undefined) form[key] = config[key]
    }
  } catch (err) {
    console.error('❌ Erreur chargement config kanban:', err.message)
    showAlert('Impossible de charger la configuration.', 'error')
  } finally {
    loading.value = false
  }
}

async function saveAll() {
  saving.value = true
  try {
    const updates = Object.entries(form).map(([key, value]) => ({ key, value }))
    await saveKanbanConfig(updates)
    showAlert('✅ Configuration sauvegardée avec succès !')
    // Notifie le Kanban frontoffice que la config a changé
    window.dispatchEvent(new CustomEvent('kanban-config-updated'))
  } catch (err) {
    console.error('❌ Erreur sauvegarde config kanban:', err.message)
    showAlert('Erreur lors de la sauvegarde.', 'error')
  } finally {
    saving.value = false
  }
}

onMounted(loadConfig)
</script>

<style scoped>
.kanban-cfg-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

/* Alert */
.alert-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1.25rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}
.alert-banner.success {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}
.alert-banner.error {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Loading */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem;
  color: var(--text-muted);
  font-size: 1rem;
}
.loading-state i { font-size: 1.5rem; color: var(--primary); }

/* Columns grid */
.columns-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}
@media (max-width: 900px) {
  .columns-grid { grid-template-columns: 1fr; }
}

.column-card {
  background: white;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  border-top: 4px solid #e2e8f0;
  box-shadow: var(--shadow);
  overflow: hidden;
  transition: box-shadow 0.2s;
}
.column-card:hover { box-shadow: var(--shadow-lg); }

.column-preview {
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.3s;
}
.preview-label { font-size: 0.75rem; font-weight: 600; color: rgba(0,0,0,0.4); }
.preview-count {
  background: rgba(0,0,0,0.1);
  padding: 0.15rem 0.6rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(0,0,0,0.5);
}

.column-card-body { padding: 1.25rem; }

.column-card-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.col-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  transition: background 0.3s;
}

.field-group { margin-bottom: 1rem; }
.field-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 0.45rem;
}
.flag { font-size: 1rem; }

/* Color row */
.color-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.color-picker {
  width: 42px;
  height: 36px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  background: white;
}
.color-text-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-family: monospace;
  color: var(--text-main);
}
.color-text-input:focus { outline: none; border-color: var(--primary); }

.color-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.color-preset-btn {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
}
.color-preset-btn:hover { transform: scale(1.2); }
.color-preset-btn.active { border-color: #1e293b; transform: scale(1.15); }

.field-input {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  color: var(--text-main);
  background: white;
  transition: border-color 0.2s;
}
.field-input:focus { outline: none; border-color: var(--primary); }

/* Preview board */
.preview-section {
  background: white;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow);
}
.preview-section-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 1.25rem;
}
.kanban-preview-board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}
@media (max-width: 700px) {
  .kanban-preview-board { grid-template-columns: 1fr; }
}
.kanban-preview-col {
  border-radius: var(--radius-md);
  padding: 0.75rem;
  border: 1px solid rgba(0,0,0,0.06);
  transition: background-color 0.3s;
}
.kanban-preview-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}
.kanban-preview-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-main);
}
.kanban-preview-name-mg {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-style: italic;
}
.kanban-preview-count {
  margin-left: auto;
  background: rgba(0,0,0,0.1);
  padding: 0.1rem 0.5rem;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-main);
}
.kanban-preview-card {
  background: white;
  border-radius: 6px;
  padding: 0.6rem 0.75rem;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-muted);
  border: 1px solid rgba(0,0,0,0.06);
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
</style>