// Importation des fonctions de création de routeur Vue
import { createRouter, createWebHistory } from 'vue-router'

// Importation des composants Backoffice (administration)
import BackofficeLogin from '../views/backoffice/Login.vue'
import BackofficeDashboard from '../views/backoffice/Dashboard.vue'
import BackofficeReset from '../views/backoffice/ResetData.vue'
import BackofficeImport from '../views/backoffice/Import.vue'
import BackofficeTickets from '../views/backoffice/Tickets.vue'

// Importation des composants Frontoffice (public - URL séparée)
import FrontofficeElements from '../views/frontoffice/Elements.vue'
import FrontofficeCreateTicket from '../views/frontoffice/CreateTicket.vue'
import FrontofficeKanban from '../views/frontoffice/Kanban.vue'

// Définition des routes de l'application
const routes = [
  { 
    path: '/', // Route racine → redirige vers frontoffice
    redirect: '/elements' 
  },
  { 
    path: '/elements', // Recherche équipements (public - URL simple)
    name: 'FrontofficeElements', 
    component: FrontofficeElements 
  },
  { 
    path: '/create-ticket', // Création ticket (public - URL simple)
    name: 'FrontofficeCreateTicket', 
    component: FrontofficeCreateTicket 
  },
  { 
    path: '/kanban', // Tableau Kanban (public - URL simple)
    name: 'FrontofficeKanban', 
    component: FrontofficeKanban 
  },
  // Redirections pour les anciennes URLs (compatibilité)
  { 
    path: '/backoffice/login', 
    redirect: '/admin' 
  },
  { 
    path: '/backoffice', 
    redirect: '/admin/import' 
  },
  { 
    path: '/backoffice/reset', 
    redirect: '/admin/reset' 
  },
  { 
    path: '/backoffice/import', 
    redirect: '/admin/import' 
  },
  { 
    path: '/backoffice/tickets', 
    redirect: '/admin/tickets' 
  },
  { 
    path: '/frontoffice/elements', 
    redirect: '/elements' 
  },
  { 
    path: '/frontoffice/create-ticket', 
    redirect: '/create-ticket' 
  },
  // Nouvelles URLs
  { 
    path: '/admin', // Page de connexion admin (URL séparée)
    name: 'BackofficeLogin', 
    component: BackofficeLogin 
  },
  { 
    path: '/admin/dashboard', // Dashboard admin (URL séparée)
    name: 'BackofficeDashboard', 
    component: BackofficeDashboard, 
    meta: { requiresBackofficeAuth: true } 
  },
  { 
    path: '/admin/reset', // Réinitialisation données (URL séparée)
    name: 'BackofficeReset', 
    component: BackofficeReset, 
    meta: { requiresBackofficeAuth: true }
  },
  { 
    path: '/admin/import', // Import CSV/JSON (URL séparée)
    name: 'BackofficeImport', 
    component: BackofficeImport, 
    meta: { requiresBackofficeAuth: true }
  },
  { 
    path: '/admin/tickets', // Gestion tickets (URL séparée)
    name: 'BackofficeTickets', 
    component: BackofficeTickets, 
    meta: { requiresBackofficeAuth: true }
  }
]

// Création du routeur avec historique HTML5
const router = createRouter({
  history: createWebHistory(), // Mode historique standard
  routes // Liste des routes
})

// Garde de navigation pour vérifier l'authentification backoffice
router.beforeEach((to, from, next) => {
  const sessionToken = localStorage.getItem('glpi_session_token') // Récup token session
  const expiry = localStorage.getItem('glpi_session_expiry') // Récup date expiration
  const isSessionValid = sessionToken && expiry && Date.now() < parseInt(expiry) // Vérif validité
  
  // Si route admin protégée et session invalide → redirection login admin
  if (to.meta.requiresBackofficeAuth && !isSessionValid) {
    // Rediriger vers /admin seulement si on n'est pas déjà sur une route frontoffice
    if (!to.path.startsWith('/elements') && !to.path.startsWith('/create-ticket')) {
      next('/admin')
    } else {
      next() // Autoriser l'accès aux routes frontoffice sans auth
    }
  } else {
    next() // Sinon autoriser l'accès
  }
})

export default router