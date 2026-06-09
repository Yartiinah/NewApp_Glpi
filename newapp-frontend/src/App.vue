<template>
  <div class="app-layout" :class="{ 'has-sidebar': showBackofficeSidebar || showFrontofficeSidebar }">
    <BackofficeSidebar v-if="showBackofficeSidebar" />
    <FrontofficeSidebar v-if="showFrontofficeSidebar" />
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useBackofficeAuthStore } from './stores/backoffice/authStore'
import BackofficeSidebar from './components/Sidebar.vue'
import FrontofficeSidebar from './components/frontoffice/FrontofficeSidebar.vue'

const route = useRoute()
const authStore = useBackofficeAuthStore()

const showBackofficeSidebar = computed(() => {
  // Show backoffice sidebar if authenticated and on backoffice route
  return authStore.isAuthenticated && route.meta.requiresBackofficeAuth
})

const showFrontofficeSidebar = computed(() => {
  // Show frontoffice sidebar on frontoffice routes (no auth required)
  return route.path.startsWith('/elements') || route.path.startsWith('/create-ticket')
})
</script>

<style>
/* Base Variables & Styles */
:root {
  --primary: #3b82f6;
  --primary-hover: #2563eb;
  --primary-light: rgba(59, 130, 246, 0.1);
  --success: #10b981;
  --success-hover: #059669;
  --success-light: rgba(16, 185, 129, 0.1);
  --warning: #f59e0b;
  --danger: #ef4444;
  --danger-hover: #dc2626;
  --danger-light: rgba(239, 68, 68, 0.1);
  --bg-main: #f8fafc;
  --bg-card: #ffffff;
  --text-main: #0f172a;
  --text-muted: #64748b;
  --border: #e2e8f0;
  --radius-lg: 12px;
  --radius-md: 8px;
  --radius-sm: 6px;
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05);
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-title: 'Outfit', sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-sans);
  background: var(--bg-main);
  color: var(--text-main);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* App Layout */
.app-layout {
  display: flex;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  padding: 2rem;
  background: var(--bg-main);
  min-width: 0; /* Prevents flex items from overflowing */
  transition: padding-left 0.3s ease;
}

.has-sidebar .main-content {
  padding-left: calc(260px + 2rem);
}

/* Common UI Elements */
.page-header {
  margin-bottom: 2rem;
}

.page-title {
  font-family: var(--font-title);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.02em;
}

.page-subtitle {
  font-size: 0.95rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

.card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 1.75rem;
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
  margin-bottom: 1.5rem;
}

.card-title {
  font-family: var(--font-title);
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Form Styles */
.form-group {
  margin-bottom: 1.25rem;
}

.form-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 0.5rem;
}

.form-input, .form-select, .form-textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  font-family: var(--font-sans);
  font-size: 0.9rem;
  color: var(--text-main);
  background: #fff;
  transition: all 0.2s ease;
}

.form-input:focus, .form-select:focus, .form-textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

/* Button Styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

.btn-primary {
  background: var(--primary);
  color: #fff;
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.btn-success {
  background: var(--success);
  color: #fff;
}

.btn-success:hover {
  background: var(--success-hover);
}

.btn-danger {
  background: var(--danger);
  color: #fff;
}

.btn-danger:hover {
  background: var(--danger-hover);
}

.btn-secondary {
  background: #e2e8f0;
  color: #475569;
}

.btn-secondary:hover {
  background: #cbd5e1;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Alert Styles */
.alert {
  padding: 1rem 1.25rem;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 500;
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.alert-success {
  background: var(--success-light);
  color: var(--success-hover);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.alert-error {
  background: var(--success-light);
  color: var(--success-hover);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

/* Table Styles */
.table-container {
  width: 100%;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: #fff;
}

.custom-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9rem;
}

.custom-table th {
  background: #f8fafc;
  padding: 1rem;
  font-weight: 600;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}

.custom-table td {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  color: var(--text-main);
}

.custom-table tr:last-child td {
  border-bottom: none;
}

.custom-table tbody tr:hover {
  background: #f8fafc;
}

/* Custom Scrollbar for modern feel */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f5f9;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
