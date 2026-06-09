<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="logo">
        <span class="logo-icon">🛠️</span>
        <span class="logo-text">NewApp <span class="logo-badge">GLPI</span></span>
      </div>
    </div>

    <nav class="sidebar-nav">
      <!-- Backoffice section -->
      <div class="nav-section">
        <span class="section-title">🔐 BACKOFFICE</span>
        <router-link to="/admin/dashboard" class="nav-link" active-class="active" exact>
          <span class="nav-icon">📊</span>
          <span>Dashboard</span>
        </router-link>
        <router-link to="/admin/import" class="nav-link" active-class="active">
          <span class="nav-icon">📥</span>
          <span>Import CSV / ZIP</span>
        </router-link>
        <router-link to="/admin/tickets" class="nav-link" active-class="active">
          <span class="nav-icon">🎫</span>
          <span>Gestion Tickets</span>
        </router-link>
        <router-link to="/admin/reset" class="nav-link" active-class="active">
          <span class="nav-icon">🗑️</span>
          <span>Réinitialisation</span>
        </router-link>
      </div>
    </nav>

    <div class="sidebar-footer">
      <div class="user-info">
        <div class="avatar">G</div>
        <div class="user-meta">
          <span class="user-name">GLPI Admin</span>
          <span class="user-role">Administrateur (Mock)</span>
        </div>
      </div>
      <button @click="handleLogout" class="btn-logout" title="Se déconnecter">
        <span>🚪</span>
        <span>Déconnexion</span>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useBackofficeAuthStore } from '../stores/backoffice/authStore'

const router = useRouter()
const authStore = useBackofficeAuthStore()

async function handleLogout() {
  await authStore.logout()
  router.push('/admin')
}
</script>

<style scoped>
.sidebar {
  width: 260px;
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
  color: #f8fafc;
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  box-shadow: 4px 0 25px rgba(0, 0, 0, 0.15);
  z-index: 100;
  transition: all 0.3s ease;
}

.sidebar-header {
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-icon {
  font-size: 1.5rem;
}

.logo-text {
  font-family: 'Outfit', sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.logo-badge {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  font-size: 0.65rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-weight: 600;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.sidebar-nav {
  flex: 1;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  overflow-y: auto;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.section-title {
  font-size: 0.7rem;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.075em;
  padding-left: 0.75rem;
  margin-bottom: 0.5rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.75rem;
  color: #94a3b8;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.03);
  color: #f8fafc;
}

.nav-link.active {
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%);
  color: #3b82f6;
  border-left: 3px solid #3b82f6;
  padding-left: calc(0.75rem - 3px);
  font-weight: 600;
}

.nav-icon {
  font-size: 1.1rem;
  width: 1.5rem;
  text-align: center;
}

.sidebar-footer {
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.avatar {
  width: 2.25rem;
  height: 2.25rem;
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-family: 'Outfit', sans-serif;
}

.user-meta {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #e2e8f0;
}

.user-role {
  font-size: 0.75rem;
  color: #64748b;
}

.btn-logout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
  padding: 0.6rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  transition: all 0.2s ease;
  width: 100%;
}

.btn-logout:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}
</style>
