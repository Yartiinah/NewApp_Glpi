<template>
  <div class="elements-container">
    <header class="page-header">
      <div class="header-left">
        <h1 class="page-title">🖥️ Recherche d'Éléments</h1>
        <p class="page-subtitle">Consultez et recherchez parmi tous les équipements (ordinateurs, moniteurs) enregistrés dans GLPI.</p>
      </div>
      <div class="header-right">
        <button @click="loadItems" :disabled="loading" class="btn btn-secondary">
          <i class="fa-solid" :class="loading ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'"></i> Actualiser
        </button>
      </div>
    </header>

    <!-- Filtres -->
    <div class="card search-card">
      <h2 class="search-title"><i class="fa-solid fa-sliders"></i> Filtres de recherche multicritères</h2>
      <div class="filter-grid">
        <div class="form-group">
          <label class="form-label">Nom de l'élément</label>
          <input type="text" v-model="filterName" placeholder="Ex: PC_SALLE_A..." class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">Type d'élément</label>
          <select v-model="filterType" class="form-select">
            <option value="">Tous les types</option>
            <option value="Computer">💻 Ordinateur</option>
            <option value="Monitor">🖥️ Moniteur</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Fabricant</label>
          <input type="text" v-model="filterManufacturer" placeholder="Ex: Dell, Apple..." class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">Modèle</label>
          <input type="text" v-model="filterModel" placeholder="Ex: Latitude 5420..." class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">Localisation</label>
          <input type="text" v-model="filterLocation" placeholder="Ex: Bureau 102..." class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">Statut</label>
          <input type="text" v-model="filterStatus" placeholder="Ex: Actif, En panne..." class="form-input" />
        </div>
      </div>
      <div class="search-actions">
        <button @click="resetFilters" class="btn btn-secondary">Effacer les filtres</button>
      </div>
    </div>

    <!-- Liste -->
    <div class="card list-card">
      <div v-if="loading" class="table-loading">
        <i class="fa-solid fa-spinner fa-spin loading-spinner"></i>
        <span>Chargement des équipements GLPI...</span>
      </div>

      <div v-else-if="paginatedItems.length === 0" class="empty-table-state">
        <i class="fa-solid fa-laptop-code empty-icon"></i>
        <p>Aucun équipement ne correspond à vos filtres.</p>
      </div>

      <div v-else>
        <div class="table-container">
          <table class="custom-table">
            <thead>
              <tr>
                <th class="col-img">Image</th>
                <th>Type</th>
                <th>Nom</th>
                <th>Fabricant</th>
                <th>Modèle</th>
                <th>N° Inventaire</th>
                <th>Localisation</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedItems" :key="`${item.itemtype}-${item.id}`">

                <!-- Colonne image -->
                <td class="col-img">
                  <div
                    class="item-img-wrapper"
                    :class="{ 'has-image': blobUrls[item.id] }"
                    @click="blobUrls[item.id] && openPreview(item)"
                  >
                    <!-- Spinner pendant le chargement -->
                    <div v-if="loadingImages[item.id]" class="img-loading">
                      <i class="fa-solid fa-spinner fa-spin"></i>
                    </div>

                    <!-- Image chargée via blob URL -->
                    <img
                      v-else-if="blobUrls[item.id]"
                      :src="blobUrls[item.id]"
                      :alt="item.name"
                      class="item-thumb"
                    />

                    <!-- Placeholder si pas d'image -->
                    <div v-else class="no-img-placeholder">
                      <i class="fa-solid" :class="item.itemtype === 'Monitor' ? 'fa-desktop' : 'fa-laptop'"></i>
                    </div>

                    <!-- Badge statut -->
                    <span class="img-badge" :class="blobUrls[item.id] ? 'img-ok' : 'img-none'">
                      <i class="fa-solid" :class="blobUrls[item.id] ? 'fa-check' : 'fa-xmark'"></i>
                    </span>
                  </div>
                </td>

                <td>
                  <span class="type-icon-wrapper" :class="item.itemtype.toLowerCase()">
                    <i class="fa-solid" :class="item.itemtype === 'Monitor' ? 'fa-desktop' : 'fa-laptop'"></i>
                    <span class="type-label">{{ item.itemtype }}</span>
                  </span>
                </td>
                <td class="item-name">{{ item.name }}</td>
                <td>{{ item.manufacturer }}</td>
                <td>{{ item.model }}</td>
                <td><code class="inventory-tag">{{ item.inventory_number }}</code></td>
                <td>
                  <span class="location-badge">
                    <i class="fa-solid fa-location-dot"></i> {{ item.location }}
                  </span>
                </td>
                <td>
                  <span class="status-indicator-badge">{{ item.status }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="pagination-bar" v-if="totalPages > 1">
          <div class="pagination-info">
            Affichage de {{ startItemIndex + 1 }} à {{ endItemIndex }} sur {{ filteredItems.length }} élément(s)
          </div>
          <div class="pagination-buttons">
            <button @click="currentPage--" :disabled="currentPage === 1" class="btn-pagination">
              <i class="fa-solid fa-chevron-left"></i> Précédent
            </button>
            <span class="page-number-display">Page {{ currentPage }} sur {{ totalPages }}</span>
            <button @click="currentPage++" :disabled="currentPage === totalPages" class="btn-pagination">
              Suivant <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal prévisualisation image -->
    <div v-if="preview" class="preview-overlay" @click.self="preview = null">
      <div class="preview-modal">
        <button class="preview-close" @click="preview = null">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <div class="preview-header">
          <span class="preview-name">{{ preview.name }}</span>
          <span class="preview-type">{{ preview.itemtype }}</span>
        </div>
        <img :src="blobUrls[preview.id]" :alt="preview.name" class="preview-img" />
        <div class="preview-meta">
          <span><i class="fa-solid fa-barcode"></i> {{ preview.inventory_number }}</span>
          <span><i class="fa-solid fa-location-dot"></i> {{ preview.location }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted, watch } from 'vue'
import { getAllItems } from '../../services/frontoffice/glpi.service'

const GLPI_URL   = import.meta.env.VITE_GLPI_URL
const APP_TOKEN  = import.meta.env.VITE_GLPI_APP_TOKEN

const items         = ref([])
const loading       = ref(false)
const preview       = ref(null)
const blobUrls      = reactive({})   // item.id → blob URL
const loadingImages = reactive({})   // item.id → true/false

const filterName         = ref('')
const filterType         = ref('')
const filterManufacturer = ref('')
const filterModel        = ref('')
const filterLocation     = ref('')
const filterStatus       = ref('')
const currentPage        = ref(1)
const itemsPerPage       = 10

// ── Charge une image GLPI avec les headers d'auth et crée une blob URL ──
// picture_front contient l'URL directe : base/apirest.php/Document/{id}?alt=media
async function loadImage(item) {
  if (!item.picture_front) return
  if (blobUrls[item.id])   return   // déjà chargée

  const sessionToken = localStorage.getItem('glpi_session_token') || ''
  const url = item.picture_front   // URL directe déjà construite dans glpi.service

  loadingImages[item.id] = true
  try {
    const res = await fetch(url, {
      headers: {
        'App-Token':     APP_TOKEN,
        'Session-Token': sessionToken
      }
    })
    if (!res.ok) {
      console.warn(`⚠️ Image non accessible pour ${item.name} (${res.status}):`, url)
      return
    }
    const blob = await res.blob()
    blobUrls[item.id] = URL.createObjectURL(blob)
    console.log(`🖼️ Image chargée : ${item.name}`)
  } catch (err) {
    console.warn(`⚠️ Erreur chargement image ${item.name}:`, err.message)
  } finally {
    loadingImages[item.id] = false
  }
}

// ── Charge les images des items visibles sur la page courante ──
async function loadVisibleImages() {
  for (const item of paginatedItems.value) {
    loadImage(item)   // pas de await → chargement parallèle
  }
}

async function loadItems() {
  // Libère les anciennes blob URLs
  Object.values(blobUrls).forEach(url => URL.revokeObjectURL(url))
  Object.keys(blobUrls).forEach(k => delete blobUrls[k])

  loading.value = true
  try {
    const data = await getAllItems()
    items.value = Array.isArray(data) ? data : []
    console.log(`📦 ${items.value.length} items chargés,`,
      items.value.filter(i => i.picture_front).length, 'avec image')
  } catch (err) {
    console.error('Failed to load items:', err)
  } finally {
    loading.value = false
    // Charge les images de la première page
    await loadVisibleImages()
  }
}

function resetFilters() {
  filterName.value = ''
  filterType.value = ''
  filterManufacturer.value = ''
  filterModel.value = ''
  filterLocation.value = ''
  filterStatus.value = ''
  currentPage.value = 1
}

function openPreview(item) {
  preview.value = item
}

watch([filterName, filterType, filterManufacturer, filterModel, filterLocation, filterStatus], () => {
  currentPage.value = 1
})

// Quand on change de page → charger les images de la nouvelle page
watch(currentPage, () => {
  loadVisibleImages()
})

const filteredItems = computed(() => {
  return items.value.filter(item => {
    const n = String(item.name         || '').toLowerCase()
    const t = String(item.itemtype     || '').toLowerCase()
    const m = String(item.manufacturer || '').toLowerCase()
    const d = String(item.model        || '').toLowerCase()
    const l = String(item.location     || '').toLowerCase()
    const s = String(item.status       || '').toLowerCase()
    return (!filterName.value         || n.includes(filterName.value.toLowerCase())) &&
           (!filterType.value         || t === filterType.value.toLowerCase()) &&
           (!filterManufacturer.value || m.includes(filterManufacturer.value.toLowerCase())) &&
           (!filterModel.value        || d.includes(filterModel.value.toLowerCase())) &&
           (!filterLocation.value     || l.includes(filterLocation.value.toLowerCase())) &&
           (!filterStatus.value       || s.includes(filterStatus.value.toLowerCase()))
  })
})

const totalPages     = computed(() => Math.ceil(filteredItems.value.length / itemsPerPage) || 1)
const startItemIndex = computed(() => (currentPage.value - 1) * itemsPerPage)
const endItemIndex   = computed(() => Math.min(currentPage.value * itemsPerPage, filteredItems.value.length))
const paginatedItems = computed(() => filteredItems.value.slice(startItemIndex.value, endItemIndex.value))

onMounted(() => {
  loadItems()
  window.addEventListener('glpi-data-changed', loadItems)
})

onUnmounted(() => {
  window.removeEventListener('glpi-data-changed', loadItems)
  Object.values(blobUrls).forEach(url => URL.revokeObjectURL(url))
})
</script>

<style scoped>
.elements-container { max-width: 1400px; margin: 0 auto; }

.search-card { padding: 1.5rem; margin-bottom: 1.5rem; }
.search-title {
  font-size: 1.1rem; font-weight: 700; color: var(--text-main);
  margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.5rem;
}
.filter-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
.search-actions {
  display: flex; justify-content: flex-end;
  margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);
}

.list-card { padding: 0; overflow: hidden; }
.table-loading, .empty-table-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 5rem 2rem; color: var(--text-muted); gap: 1rem;
}
.loading-spinner { font-size: 2.5rem; color: var(--primary); }
.empty-icon      { font-size: 3rem; color: #cbd5e1; }

/* ── Colonne image ── */
.col-img { width: 80px; text-align: center; padding: 0.5rem !important; }

.item-img-wrapper {
  position: relative;
  display: inline-flex; align-items: center; justify-content: center;
  width: 56px; height: 56px; border-radius: 10px;
  overflow: visible; cursor: default;
}
.item-img-wrapper.has-image { cursor: zoom-in; }

.img-loading {
  width: 56px; height: 56px; border-radius: 10px;
  background: #f1f5f9; display: flex; align-items: center;
  justify-content: center; color: #94a3b8; font-size: 1.1rem;
}

.item-thumb {
  width: 56px; height: 56px; object-fit: cover;
  border-radius: 10px; border: 1px solid var(--border);
  background: #f8fafc; transition: transform 0.2s;
}
.item-img-wrapper.has-image:hover .item-thumb { transform: scale(1.08); }

.no-img-placeholder {
  width: 56px; height: 56px; border-radius: 10px;
  background: #f1f5f9; border: 1px dashed #cbd5e1;
  display: flex; align-items: center; justify-content: center;
  color: #94a3b8; font-size: 1.3rem;
}

.img-badge {
  position: absolute; bottom: -5px; right: -5px;
  width: 18px; height: 18px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.6rem; font-weight: 700; border: 2px solid #fff; z-index: 1;
}
.img-ok   { background: #22c55e; color: #fff; }
.img-none { background: #e2e8f0; color: #94a3b8; }

/* ── Reste du tableau ── */
.type-icon-wrapper {
  display: inline-flex; align-items: center; gap: 0.35rem;
  padding: 0.25rem 0.5rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600;
}
.type-icon-wrapper.computer { background: rgba(59,130,246,0.1); color: #3b82f6; }
.type-icon-wrapper.monitor  { background: rgba(245,158,11,0.1);  color: #f59e0b; }
.type-label { font-size: 0.75rem; text-transform: uppercase; }
.item-name  { font-weight: 600; }

.inventory-tag {
  background: #f1f5f9; padding: 0.2rem 0.4rem;
  border-radius: 4px; font-family: monospace; font-size: 0.8rem; color: #475569;
}
.location-badge { font-size: 0.85rem; color: #475569; display: flex; align-items: center; gap: 0.25rem; }
.location-badge i { color: var(--danger); }
.status-indicator-badge {
  font-size: 0.8rem; font-weight: 600;
  color: var(--success-hover); background: var(--success-light);
  padding: 0.2rem 0.5rem; border-radius: 6px;
}

/* Pagination */
.pagination-bar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1rem 1.5rem; background: #f8fafc; border-top: 1px solid var(--border);
}
.pagination-info { font-size: 0.85rem; color: var(--text-muted); font-weight: 500; }
.pagination-buttons { display: flex; align-items: center; gap: 1rem; }
.btn-pagination {
  padding: 0.4rem 0.8rem; border: 1px solid var(--border); background: #fff;
  border-radius: 6px; font-size: 0.8rem; font-weight: 600; color: var(--text-main);
  cursor: pointer; display: flex; align-items: center; gap: 0.35rem; transition: all 0.2s;
}
.btn-pagination:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.btn-pagination:disabled { opacity: 0.5; cursor: not-allowed; }
.page-number-display { font-size: 0.85rem; font-weight: 600; color: var(--text-muted); }

/* ── Modal prévisualisation ── */
.preview-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  z-index: 1000; display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(4px);
}
.preview-modal {
  background: #fff; border-radius: 16px; padding: 1.5rem;
  max-width: 480px; width: 90%; position: relative;
  box-shadow: 0 24px 60px rgba(0,0,0,0.3);
}
.preview-close {
  position: absolute; top: 0.75rem; right: 0.75rem;
  width: 32px; height: 32px; border: none; background: #f1f5f9;
  border-radius: 8px; cursor: pointer; font-size: 1rem; color: #64748b;
  display: flex; align-items: center; justify-content: center;
}
.preview-close:hover { background: #e2e8f0; }
.preview-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
.preview-name { font-size: 1rem; font-weight: 700; color: var(--text-main); }
.preview-type {
  font-size: 0.75rem; font-weight: 600; background: #eff6ff;
  color: #3b82f6; padding: 0.2rem 0.5rem; border-radius: 6px; text-transform: uppercase;
}
.preview-img {
  width: 100%; max-height: 320px; object-fit: contain;
  border-radius: 10px; background: #f8fafc; border: 1px solid var(--border);
}
.preview-meta { display: flex; gap: 1.5rem; margin-top: 1rem; font-size: 0.85rem; color: #64748b; }
.preview-meta i { margin-right: 0.3rem; color: #94a3b8; }
</style>