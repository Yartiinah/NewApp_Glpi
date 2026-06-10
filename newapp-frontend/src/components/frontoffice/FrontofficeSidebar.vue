<template>
  <aside class="sidebar frontoffice-sidebar">
    <div class="sidebar-header">
      <div class="logo">
        <span class="logo-icon">🖥️</span>
        <span class="logo-text">NewApp <span class="logo-badge">FRONT</span></span>
      </div>
    </div>

    <nav class="sidebar-nav">
      <div class="nav-section">
        <span class="section-title">🎯 FRONTOFFICE</span>
        <router-link to="/elements" class="nav-link" active-class="active" exact>
          <span class="nav-icon">💻</span>
          <span>Recherche Éléments</span>
        </router-link>
        <router-link to="/kanban" class="nav-link" active-class="active">
          <span class="nav-icon">📋</span>
          <span>Ajout Ticket</span>
        </router-link>
      </div>
    </nav>

    <div class="sidebar-footer">
      <div class="footer-info">
        <span class="footer-text">Portail Public</span>
        <span class="footer-subtext">Accès sans authentification</span>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<style scoped>
.sidebar {
  width: 260px;
  background: #ffffff;
  color: #0f172a;
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
  border-bottom: 1px solid #e2e8f0;
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
  background: #10b981;
  color: #fff;
  font-size: 0.65rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-weight: 600;
  border: 1px solid #059669;
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
  color: #475569;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.nav-link:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.nav-link.active {
  background: #3b82f6;
  color: #fff;
  border-left: 3px solid #2563eb;
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
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.footer-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.footer-text {
  font-size: 0.85rem;
  font-weight: 600;
  color: #0f172a;
}

.footer-subtext {
  font-size: 0.75rem;
  color: #64748b;
}
</style>
