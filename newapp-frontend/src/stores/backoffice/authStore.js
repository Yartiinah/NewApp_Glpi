// src/stores/backoffice/authStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { 
    login as apiLogin, 
    logout as apiLogout, 
    isAuthenticated, 
    isSessionValid
} from '../../services/backoffice/auth.service'

export const useBackofficeAuthStore = defineStore('backofficeAuth', () => {
    const isAuth = ref(false)
    const error = ref(null)

    function init() {
        isAuth.value = isAuthenticated() && isSessionValid()
    }

    async function login(code) {
        error.value = null
        const result = await apiLogin(code)
        
        if (result.success) {
            isAuth.value = true
            return { success: true }
        }
        
        error.value = result.error
        return { success: false, error: result.error }
    }

    async function logout() {
        await apiLogout()
        isAuth.value = false
    }

    const isLoggedIn = computed(() => isAuth.value)

    init()

    return { 
        isAuthenticated: isAuth, 
        isLoggedIn, 
        error, 
        login, 
        logout 
    }
})