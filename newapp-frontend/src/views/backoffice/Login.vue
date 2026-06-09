<template>
  <div class="login-container">
    <div class="glow-bg">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
    </div>
    
    <div class="login-card">
      <div class="card-header">
        <div class="icon-wrapper">
          <i class="fa-solid fa-shield-halved lock-icon"></i>
        </div>
        <h1>NewApp Portal</h1>
        <p class="subtitle">Connexion sécurisée à l'API GLPI</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label class="input-label">Code d'accès sécurisé</label>
          <div class="input-wrapper">
            <i class="fa-solid fa-key input-icon"></i>
            <input 
              v-model="code" 
              type="password" 
              placeholder="Code unique"
              disabled
              class="styled-input"
            />
          </div>
        </div>

        <div v-if="error" class="error-msg">
          <i class="fa-solid fa-circle-exclamation"></i>
          <span>{{ error }}</span>
        </div>

        <button type="submit" :disabled="loading" class="login-button">
          <span v-if="loading">
            <i class="fa-solid fa-spinner fa-spin"></i> Authentification...
          </span>
          <span v-else>
            <i class="fa-solid fa-right-to-bracket"></i> Entrer dans le Backoffice
          </span>
        </button>
      </form>

      <div class="card-footer">
        <span class="status-indicator">
          <span class="dot"></span> Prêt pour l'authentification
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBackofficeAuthStore } from '../../stores/backoffice/authStore'

const router = useRouter()
const authStore = useBackofficeAuthStore()
const code = ref('')
const loading = ref(false)
const error = ref(null)

const DEFAULT_CODE = import.meta.env.VITE_BACKOFFICE_CODE || 'glpi'

onMounted(() => {
  code.value = DEFAULT_CODE
  // Auto-login after 300ms for developer speed
  setTimeout(() => {
    handleLogin()
  }, 300)
})

async function handleLogin() {
  if (!code.value) {
    error.value = 'Code non configuré'
    return
  }
  
  loading.value = true
  error.value = null
  
  const result = await authStore.login(code.value)
  
  if (result.success) {
    router.push('/admin/import')
  } else {
    error.value = result.error || 'Erreur de connexion'
  }
  
  loading.value = false
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f172a;
  padding: 1.5rem;
  position: relative;
  overflow: hidden;
  font-family: 'Inter', sans-serif;
}

/* Background elements */
.glow-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
}

.circle {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.15;
}

.circle-1 {
  width: 400px;
  height: 400px;
  background: #3b82f6;
  top: -100px;
  right: -100px;
}

.circle-2 {
  width: 450px;
  height: 450px;
  background: #6366f1;
  bottom: -150px;
  left: -150px;
}

/* Glassmorphism Card */
.login-card {
  position: relative;
  z-index: 10;
  background: rgba(30, 41, 59, 0.7);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  width: 100%;
  max-width: 400px;
  padding: 2.5rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  text-align: center;
  transition: all 0.3s ease;
}

.icon-wrapper {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.25rem;
  box-shadow: 0 8px 16px rgba(59, 130, 246, 0.3);
}

.lock-icon {
  font-size: 1.75rem;
  color: white;
}

h1 {
  font-family: 'Outfit', sans-serif;
  font-size: 1.75rem;
  font-weight: 800;
  color: #ffffff;
  margin-bottom: 0.25rem;
  letter-spacing: -0.02em;
}

.subtitle {
  color: #94a3b8;
  font-size: 0.9rem;
  margin-bottom: 2rem;
}

.login-form {
  text-align: left;
}

.form-group {
  margin-bottom: 1.5rem;
}

.input-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.input-wrapper {
  position: relative;
}

.input-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  font-size: 1rem;
}

.styled-input {
  width: 100%;
  padding: 0.85rem 1rem 0.85rem 2.5rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.6);
  color: #f8fafc;
  font-size: 1rem;
  transition: all 0.2s ease;
  letter-spacing: 0.1em;
}

.styled-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-msg {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.25);
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.login-button {
  width: 100%;
  padding: 0.85rem;
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

.login-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.3);
}

.login-button:active:not(:disabled) {
  transform: translateY(1px);
}

.login-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card-footer {
  margin-top: 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 1rem;
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #64748b;
}

.dot {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 8px #10b981;
}
</style>