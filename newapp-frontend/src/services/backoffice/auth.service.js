// src/services/backoffice/auth.service.js
import axios from 'axios'

const GLPI_URL = import.meta.env.VITE_GLPI_URL
const APP_TOKEN = import.meta.env.VITE_GLPI_APP_TOKEN
const USER_TOKEN = import.meta.env.VITE_GLPI_USER_TOKEN
const BACKOFFICE_CODE = import.meta.env.VITE_BACKOFFICE_CODE

// Logs de configuration désactivés pour réduire le bruit dans la console
// console.log('🔧 Configuration chargée :')
// console.log('  GLPI_URL:', GLPI_URL)
// console.log('  APP_TOKEN:', APP_TOKEN?.substring(0, 20) + '...')
// console.log('  USER_TOKEN:', USER_TOKEN?.substring(0, 20) + '...')
// console.log('  BACKOFFICE_CODE:', BACKOFFICE_CODE)

let sessionToken = null

export function isAuthenticated() {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('glpi_session_token')
        const expiry = localStorage.getItem('glpi_session_expiry')
        return !!(token && expiry && Date.now() < parseInt(expiry))
    }
    return false
}

export async function login(code) {
    console.log('📝 Code entré:', code)
    console.log('🔑 Code attendu:', BACKOFFICE_CODE)
    
    // Vérifier d'abord le code unique
    if (code !== BACKOFFICE_CODE) {
        console.log('❌ Code incorrect')
        return { success: false, error: 'Code incorrect' }
    }
    
    console.log('✅ Code valide, appel à GLPI...')
    console.log('📡 URL complète:', `${GLPI_URL}/initSession`)
    
    try {
        const response = await axios.get(`${GLPI_URL}/initSession`, {
            headers: {
                'Content-Type': 'application/json',
                'App-Token': APP_TOKEN,
                'Authorization': `user_token ${USER_TOKEN}`
            }
        })
        
        console.log('✅ Réponse GLPI:', response.data)
        
        sessionToken = response.data.session_token
        const expiry = Date.now() + 3600000
        
        localStorage.setItem('glpi_session_token', sessionToken)
        localStorage.setItem('glpi_session_expiry', expiry.toString())
        localStorage.removeItem('glpi_mock_mode') // Désactiver le mode mock si connexion réussie
        
        return { success: true, sessionToken }
        
    } catch (error) {
        console.warn('⚠️ Connexion au serveur GLPI échouée. Détails:', error.message)
        console.warn('⚠️ Activation du mode MOCK local pour démonstration.')
        
        // Mode Mock fallback
        localStorage.setItem('glpi_mock_mode', 'true')
        sessionToken = 'mock_session_' + Math.random().toString(36).substring(2, 9)
        const expiry = Date.now() + 3600000
        
        localStorage.setItem('glpi_session_token', sessionToken)
        localStorage.setItem('glpi_session_expiry', expiry.toString())
        
        return { success: true, sessionToken, isMock: true }
    }
}

export async function logout() {
    const isMock = localStorage.getItem('glpi_mock_mode') === 'true'
    try {
        const token = localStorage.getItem('glpi_session_token')
        if (token && !isMock) {
            await axios.get(`${GLPI_URL}/killSession`, {
                headers: {
                    'App-Token': APP_TOKEN,
                    'Session-Token': token
                }
            })
        }
    } catch (error) {
        console.error('Erreur logout:', error)
    } finally {
        localStorage.removeItem('glpi_session_token')
        localStorage.removeItem('glpi_session_expiry')
        localStorage.removeItem('glpi_mock_mode')
        sessionToken = null
    }
}

export function isSessionValid() {
    const token = localStorage.getItem('glpi_session_token')
    const expiry = localStorage.getItem('glpi_session_expiry')
    return !!(token && expiry && Date.now() < parseInt(expiry))
}

export function getSessionToken() {
    return localStorage.getItem('glpi_session_token')
}