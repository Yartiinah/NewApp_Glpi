// Données mock pour le mode hors ligne (fallback si GLPI inaccessible)

// Vérifie si le mode mock est activé
export function isMockActive() {
  return localStorage.getItem('glpi_mock_mode') === 'true'
}

// Initialise les données mock dans le localStorage
export function initMockDb() {
  // Tickets mockés
  if (!localStorage.getItem('glpi_mock_tickets')) {
    localStorage.setItem('glpi_mock_tickets', JSON.stringify([
      { id: 1, name: "Problème d'accès au VPN", content: "Impossible de se connecter depuis ce matin avec l'erreur TLS handshake error.", status: 1, priority: 4, date_creation: "2026-06-05 10:00:00" },
      { id: 2, name: "Demande d'écran supplémentaire", content: "Pour le bureau de la comptabilité (besoin d'un affichage double).", status: 2, priority: 2, date_creation: "2026-06-04 15:30:00" },
      { id: 3, name: "Mise à jour Windows bloquée", content: "L'ordinateur redémarre en boucle après la dernière mise à jour de sécurité.", status: 4, priority: 3, date_creation: "2026-06-03 09:15:00" },
      { id: 4, name: "Changement de souris sans fil", content: "Le bouton de clic gauche ne répond plus correctement.", status: 5, priority: 1, date_creation: "2026-06-02 11:20:00" }
    ]))
  }
  // Ordinateurs mockés avec tous les champs
  if (!localStorage.getItem('glpi_mock_computers')) {
    localStorage.setItem('glpi_mock_computers', JSON.stringify([
      { 
        id: 101, 
        name: "PC_COMPTA_01", 
        states_id: "Actif",
        states_id_name: "Actif",
        locations_id: "Bureau 102",
        locations_id_name: "Bureau 102",
        manufacturers_id: "Dell",
        manufacturers_id_name: "Dell",
        computermodels_id: "Latitude 5420",
        computermodels_id_name: "Latitude 5420",
        serial: "SN-DELL-8839",
        otherserial: "INV-001",
        computertypes_id: "Laptop",
        computertypes_id_name: "Portable",
        operatingsystems_id: "Windows 11",
        operatingsystems_id_name: "Windows 11",
        users_id: "j.dupont",
        users_id_name: "Jean Dupont",
        groups_id: "Comptabilité",
        groups_id_name: "Comptabilité"
      },
      { 
        id: 102, 
        name: "PC_DIR_02", 
        states_id: "Actif",
        states_id_name: "Actif",
        locations_id: "Bureau 201",
        locations_id_name: "Bureau 201",
        manufacturers_id: "Apple",
        manufacturers_id_name: "Apple",
        computermodels_id: "MacBook Pro M2",
        computermodels_id_name: "MacBook Pro M2",
        serial: "SN-APPL-1102",
        otherserial: "INV-002",
        computertypes_id: "Laptop",
        computertypes_id_name: "Portable",
        operatingsystems_id: "macOS",
        operatingsystems_id_name: "macOS Sonoma",
        users_id: "admin",
        users_id_name: "GLPI Admin",
        groups_id: "Direction",
        groups_id_name: "Direction"
      }
    ]))
  }
  // Moniteurs mockés avec tous les champs
  if (!localStorage.getItem('glpi_mock_monitors')) {
    localStorage.setItem('glpi_mock_monitors', JSON.stringify([
      { 
        id: 201, 
        name: "ECRAN_COMPTA_01", 
        states_id: "Actif",
        states_id_name: "Actif",
        locations_id: "Bureau 102",
        locations_id_name: "Bureau 102",
        manufacturers_id: "Dell",
        manufacturers_id_name: "Dell",
        monitormodels_id: "P2422H",
        monitormodels_id_name: "P2422H",
        serial: "SN-MON-9988",
        otherserial: "INV-003",
        size: "24 pouces",
        users_id: "j.dupont",
        users_id_name: "Jean Dupont",
        groups_id: "Comptabilité",
        groups_id_name: "Comptabilité"
      }
    ]))
  }
  // Utilisateurs mockés
  if (!localStorage.getItem('glpi_mock_users')) {
    localStorage.setItem('glpi_mock_users', JSON.stringify([
      { id: 1, name: "admin", realname: "GLPI Admin" },
      { id: 2, name: "j.dupont", realname: "Jean Dupont" }
    ]))
  }
  // Coûts de tickets mockés (avec champs CSV)
  if (!localStorage.getItem('glpi_mock_ticket_costs')) {
    localStorage.setItem('glpi_mock_ticket_costs', JSON.stringify({
      1: [
        { id: 10, name: "Coût Initial", duration: 0, cost_time: 0, cost_fixed: 109 },
        { id: 11, name: "Coût Temps", duration: 600, cost_time: 8.7, cost_fixed: 50 }
      ]
    }))
  }
  // Liens ticket-équipement mockés
  if (!localStorage.getItem('glpi_mock_ticket_items')) {
    localStorage.setItem('glpi_mock_ticket_items', JSON.stringify({
      2: [{ id: 301, itemtype: "Computer", items_id: 101 }]
    }))
  }
}

// Récupère des données mock depuis localStorage
export function getMockData(key) {
  initMockDb()
  return JSON.parse(localStorage.getItem(`glpi_mock_${key}`))
}

// Sauvegarde des données mock dans localStorage
export function setMockData(key, data) {
  localStorage.setItem(`glpi_mock_${key}`, JSON.stringify(data))
}

// Initialisation au chargement
if (typeof window !== 'undefined') {
  initMockDb()
}
