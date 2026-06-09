<template>
  <div class="dashboard-container">
    <header class="page-header">
      <div class="header-left">
        <h1 class="page-title">📊 Tableau de Bord</h1>
        <p class="page-subtitle">Statistiques en temps réel issues de l'API GLPI</p>
      </div>
      <div class="header-right">
        <button @click="loadAll" :disabled="loading" class="btn btn-primary">
          <i class="fa-solid" :class="loading ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'"></i>
          <span>Rafraîchir</span>
        </button>
      </div>
    </header>

    <!-- Elements Section -->
    <div class="section-container">
      <h2 class="section-title">
        <i class="fa-solid fa-boxes-stacked icon-green"></i>
        <span>Éléments</span>
      </h2>
      <div class="stats-grid">
        <div class="stat-card total-elements">
          <div class="stat-icon">
            <i class="fa-solid fa-cubes"></i>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ totalElements }}</span>
            <span class="stat-label">Total Éléments</span>
          </div>
        </div>

        <div class="stat-card total-computers">
          <div class="stat-icon">
            <i class="fa-solid fa-laptop"></i>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ computers.length }}</span>
            <span class="stat-label">Ordinateurs</span>
          </div>
        </div>

        <div class="stat-card total-monitors">
          <div class="stat-icon">
            <i class="fa-solid fa-desktop"></i>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ monitors.length }}</span>
            <span class="stat-label">Moniteurs</span>
          </div>
        </div>

        <div class="stat-card total-phones">
          <div class="stat-icon">
            <i class="fa-solid fa-phone"></i>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ phones.length }}</span>
            <span class="stat-label">Téléphones</span>
          </div>
        </div>

      </div>
    </div>

    <!-- Tickets Section -->
    <div class="section-container">
      <h2 class="section-title">
        <i class="fa-solid fa-ticket-simple icon-blue"></i>
        <span>Tickets</span>
      </h2>
      <div class="stats-grid">
        <div class="stat-card total-tickets">
          <div class="stat-icon">
            <i class="fa-solid fa-ticket-simple"></i>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ tickets.length }}</span>
            <span class="stat-label">Total Tickets</span>
          </div>
        </div>

        <div class="stat-card" v-for="stat in ticketTypeStats" :key="stat.type" :class="`type-card-${stat.type}`">
          <div class="stat-icon">
            <i class="fa-solid" :class="stat.type === 1 ? 'fa-fire' : 'fa-clipboard-list'"></i>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ stat.count }}</span>
            <span class="stat-label">{{ stat.label }}</span>
          </div>
        </div>

        <div class="stat-card" v-for="stat in ticketStatusStats" :key="stat.status" :class="`status-card-${stat.status}`">
          <div class="stat-icon">
            <i class="fa-solid fa-circle-dot"></i>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ stat.count }}</span>
            <span class="stat-label">{{ stat.label }}</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getTickets, getComputers, getMonitors, getPhones } from '../../services/backoffice/glpi.service'

const tickets = ref([])
const computers = ref([])
const monitors = ref([])
const phones = ref([])
const loading = ref(false)

async function loadAll() {
  loading.value = true
  try {
    console.log('📊 Récupération des données de GLPI pour le Dashboard...')
    const [t, c, m, p] = await Promise.all([
      getTickets().catch(() => []),
      getComputers().catch(() => []),
      getMonitors().catch(() => []),
      getPhones().catch(() => [])
    ])
    tickets.value = Array.isArray(t) ? t : []
    computers.value = Array.isArray(c) ? c : []
    monitors.value = Array.isArray(m) ? m : []
    phones.value = Array.isArray(p) ? p : []
    console.log('📊 Données récupérées :')
    console.log(`- Tickets: ${tickets.value.length}`)
    console.log(`- Ordinateurs: ${computers.value.length}`)
    console.log(`- Moniteurs: ${monitors.value.length}`)
    console.log(`- Téléphones: ${phones.value.length}`)
  } catch (e) {
    console.error('Error fetching dashboard stats:', e)
  } finally {
    loading.value = false
  }
}

const totalElements = computed(() => {
  return computers.value.length + monitors.value.length + phones.value.length
})

const ticketTypeStats = computed(() => {
  const counts = { 1: 0, 2: 0 }
  tickets.value.forEach(t => {
    const type = t.type || 1
    if (counts[type] !== undefined) counts[type]++
  })

  const total = tickets.value.length || 1
  return [
    { type: 1, label: 'Incidents', count: counts[1], class: 'fill-incident', percentage: Math.round((counts[1] / total) * 100) },
    { type: 2, label: 'Demandes', count: counts[2], class: 'fill-request', percentage: Math.round((counts[2] / total) * 100) }
  ]
})

const ticketStatusStats = computed(() => {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  tickets.value.forEach(t => {
    const s = t.status || 1
    if (counts[s] !== undefined) counts[s]++
  })

  const total = tickets.value.length || 1
  return [
    { status: 1, label: 'Nouveau', count: counts[1], class: 'fill-new', percentage: Math.round((counts[1] / total) * 100) },
    { status: 2, label: 'En cours (assigné)', count: counts[2], class: 'fill-processing', percentage: Math.round((counts[2] / total) * 100) },
    { status: 4, label: 'En attente', count: counts[4], class: 'fill-pending', percentage: Math.round((counts[4] / total) * 100) },
    { status: 5, label: 'Résolu', count: counts[5], class: 'fill-solved', percentage: Math.round((counts[5] / total) * 100) },
    { status: 6, label: 'Clos', count: counts[6], class: 'fill-closed', percentage: Math.round((counts[6] / total) * 100) }
  ]
})

onMounted(() => {
  loadAll()
})
</script>

<style scoped>
.dashboard-container {
  max-width: 1400px;
  margin: 0 auto;
}

.header-left {
  display: flex;
  flex-direction: column;
}

.header-right {
  display: flex;
  align-items: center;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.stat-icon {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.total-elements .stat-icon {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.total-tickets .stat-icon {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.total-computers .stat-icon {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.total-monitors .stat-icon {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.total-phones .stat-icon {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.total-users .stat-icon {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

/* Type Cards */
.type-card-1 .stat-icon {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.type-card-2 .stat-icon {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-family: var(--font-title);
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text-main);
  line-height: 1.2;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: 500;
}

/* Section Containers */
.section-container {
  margin-bottom: 2rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.icon-green {
  color: #10b981;
}

.icon-blue {
  color: #3b82f6;
}

/* Status Cards */
.status-card-1 .stat-icon {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-card-2 .stat-icon {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.status-card-4 .stat-icon {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.status-card-5 .stat-icon {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-card-6 .stat-icon {
  background: rgba(100, 116, 139, 0.1);
  color: #64748b;
}
</style>