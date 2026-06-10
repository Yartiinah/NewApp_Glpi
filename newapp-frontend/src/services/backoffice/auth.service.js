// src/services/backoffice/auth.service.js
import axios from 'axios'

const GLPI_URL = import.meta.env.VITE_GLPI_URL
const APP_TOKEN = import.meta.env.VITE_GLPI_APP_TOKEN
const USER_TOKEN = import.meta.env.VITE_GLPI_USER_TOKEN
const BACKOFFICE_CODE = import.meta.env.VITE_BACKOFFICE_CODE

// Durée de session : 5 jours (en millisecondes)
const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000 // 432000000 ms

let sessionToken = null

export function isAuthenticated() {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('glpi_session_token')
        const expiry = localStorage.getItem('glpi_session_expiry')
        return !!(token && expiry && Date.now() < parseInt(expiry))
    }
    return false
}

// Vérifier et renouveler la session si expirée
export async function ensureSessionValid() {
    const expiry = localStorage.getItem('glpi_session_expiry')
    if (expiry && Date.now() > parseInt(expiry)) {
        console.log('🔄 Session expirée, suppression...')
        localStorage.removeItem('glpi_session_token')
        localStorage.removeItem('glpi_session_expiry')
        sessionToken = null
        return false
    }
    return sessionToken !== null || localStorage.getItem('glpi_session_token') !== null
}

export async function login(code) {
    console.log('📝 Code entré:', code)
    console.log('🔑 Code attendu:', BACKOFFICE_CODE)
    
    // Vérifier d'abord le code unique
    if (code !== BACKOFFICE_CODE) {
        console.log('❌ Code incorrect')
        return { success: false, error: 'Code incorrect' }
    }
    
    // 🔄 FORCER la suppression de l'ancienne session pour en créer une nouvelle
    localStorage.removeItem('glpi_session_token')
    localStorage.removeItem('glpi_session_expiry')
    localStorage.removeItem('glpi_mock_mode')
    sessionToken = null
    
    const apiUrl = `${GLPI_URL}/initSession`
    console.log('✅ Code valide, appel à GLPI...')
    console.log('📡 URL complète:', apiUrl)
    
    try {
        const response = await axios.get(apiUrl, {
            headers: {
                'Content-Type': 'application/json',
                'App-Token': APP_TOKEN,
                'Authorization': `user_token ${USER_TOKEN}`
            }
        })
        
        console.log('✅ Réponse GLPI reçue')
        
        sessionToken = response.data.session_token
        const expiry = Date.now() + SESSION_DURATION_MS
        const expiryDate = new Date(expiry).toLocaleString()
        
        localStorage.setItem('glpi_session_token', sessionToken)
        localStorage.setItem('glpi_session_expiry', expiry.toString())
        localStorage.removeItem('glpi_mock_mode')
        
        console.log(`✅ Session GLPI initialisée, expire le ${expiryDate} (5 jours)`)
        
        return { success: true, sessionToken }
        
    } catch (error) {
        console.error('❌ Erreur connexion GLPI:', error.message)
        if (error.response?.status === 400) {
            console.error('⚠️ Vérifie que GLPI est accessible sur:', apiUrl)
            console.error('⚠️ Vérifie que les tokens sont valides dans le fichier .env')
        }
        
        // Mode Mock fallback
        console.warn('⚠️ Activation du mode MOCK local pour démonstration.')
        localStorage.setItem('glpi_mock_mode', 'true')
        sessionToken = 'mock_session_' + Math.random().toString(36).substring(2, 9)
        const expiry = Date.now() + SESSION_DURATION_MS
        
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