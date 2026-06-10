// src/services/backoffice/kanbanConfig.service.js
import axios from 'axios'

const API = '/api/kanban-config'

/**
 * Récupère toute la configuration Kanban depuis le backend SQLite.
 * Retourne un objet plat { key: value }
 */
export async function getKanbanConfig() {
  const res = await axios.get(API)
  const map = {}
  for (const item of res.data) {
    map[item.key] = item.value
  }
  return map
}

/**
 * Met à jour plusieurs clés en une seule requête.
 * @param {Array<{key, value}>} updates
 */
export async function saveKanbanConfig(updates) {
  const res = await axios.put(API, updates)
  return res.data
}