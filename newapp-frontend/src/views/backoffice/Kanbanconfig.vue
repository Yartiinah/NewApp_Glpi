<template>
  <div class="kanban-cfg-page">
    <header class="cfg-header">
      <h1>Configuration Kanban</h1>
      <button @click="saveAll" :disabled="saving || loading" class="btn-save">
        {{ saving ? 'Enregistrement...' : 'Sauvegarder' }}
      </button>
    </header>

    <p v-if="alert.message" class="alert" :class="alert.type">{{ alert.message }}</p>
    <p v-if="loading" class="muted">Chargement...</p>

    <template v-else>
      <div class="card">
        <div class="row">
          <label for="lang-select">Langue des titres</label>
          <select id="lang-select" v-model="form.kanban_language">
            <option v-for="lang in LANGUAGES" :key="lang.code" :value="lang.code">
              {{ lang.label }}
            </option>
          </select>
        </div>

        <div class="row" v-for="col in KANBAN_COLUMNS" :key="col.id">
          <label>{{ labelFor(col) }}</label>
          <input type="color" v-model="form[col.colorKey]" />
          <input
            type="text"
            v-model="form[col.colorKey]"
            class="hex"
            placeholder="#e0f2fe"
            @input="validateHex(col.colorKey)"
          />
        </div>
      </div>

      <h2>Aperçu</h2>
      <div class="preview">
        <div
          v-for="col in KANBAN_COLUMNS"
          :key="col.id"
          class="preview-col"
          :style="{ backgroundColor: form[col.colorKey] }"
        >
          {{ labelFor(col) }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getKanbanConfig, saveKanbanConfig } from '../../services/backoffice/Kanbanconfig.service'

// --- Statuts Kanban : langues, colonnes + libellés prédéfinis par langue ---
const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'mg', label: 'Malagasy' }
]
const KANBAN_COLUMNS = [
  { id: 'nouveau',    status: 1, colorKey: 'column_nouveau_color',    defaultColor: '#e0f2fe' },
  { id: 'inprogress', status: 2, colorKey: 'column_inprogress_color', defaultColor: '#fef3c7' },
  { id: 'termine',    status: 6, colorKey: 'column_termine_color',    defaultColor: '#dcfce7' }
]
const STATUS_LABELS = {
  fr: { 1: 'Nouveau', 2: 'En cours (attribué)', 6: 'Clos' },
  en: { 1: 'New',     2: 'In progress (assigned)', 6: 'Closed' },
  mg: { 1: 'Vaovao',  2: 'Efa manao',          6: 'Vita' }
}
const LANGUAGE_KEY = 'kanban_language'
const DEFAULT_LANGUAGE = 'fr'
function statusLabel(status, lang) {
  const dict = STATUS_LABELS[lang] || STATUS_LABELS[DEFAULT_LANGUAGE]
  return dict[status] || STATUS_LABELS[DEFAULT_LANGUAGE][status] || ''
}

const loading = ref(true)
const saving  = ref(false)
const alert   = reactive({ message: '', type: 'success' })

// Formulaire réactif : langue + une couleur par statut
const form = reactive({
  [LANGUAGE_KEY]: DEFAULT_LANGUAGE,
  ...Object.fromEntries(KANBAN_COLUMNS.map(c => [c.colorKey, c.defaultColor]))
})

// Libellé prédéfini d'une colonne dans la langue sélectionnée
function labelFor(col) {
  return statusLabel(col.status, form[LANGUAGE_KEY])
}

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
    showAlert('Configuration sauvegardée.')
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
.kanban-cfg-page { max-width: 640px; margin: 0 auto; }

.cfg-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.btn-save {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
  font-weight: 600;
}
.btn-save:disabled { opacity: 0.6; cursor: default; }

.muted { color: #64748b; }

.alert { padding: 0.6rem 0.9rem; border-radius: 6px; margin-bottom: 1rem; }
.alert.success { background: #f0fdf4; color: #15803d; }
.alert.error { background: #fef2f2; color: #dc2626; }

.card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.25rem;
  background: #fff;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.9rem;
}
.row:last-child { margin-bottom: 0; }
.row label { min-width: 170px; font-weight: 600; }
.row select,
.row input[type="text"] {
  padding: 0.45rem 0.6rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}
.row input[type="color"] {
  width: 40px;
  height: 34px;
  padding: 2px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
}
.hex { width: 120px; font-family: monospace; }

h2 { margin: 1.5rem 0 0.75rem; font-size: 1.05rem; }

.preview { display: flex; gap: 0.75rem; }
.preview-col {
  flex: 1;
  padding: 1rem 0.75rem;
  border-radius: 6px;
  font-weight: 700;
  text-align: center;
}
</style>
