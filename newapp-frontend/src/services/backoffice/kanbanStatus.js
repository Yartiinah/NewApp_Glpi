// Définition partagée des statuts Kanban et de leurs libellés par langue.
// Utilisé par la page de configuration (backoffice) et le tableau Kanban (frontoffice).

// Langues disponibles pour l'affichage des colonnes
export const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'mg', label: 'Malagasy' }
]

// Colonnes du tableau Kanban (mappées sur les statuts GLPI)
//  - status : id du statut GLPI (1 = Nouveau, 2 = En cours, 6 = Clos)
//  - colorKey : clé de couleur stockée en base
export const KANBAN_COLUMNS = [
  { id: 'nouveau',    status: 1, colorKey: 'column_nouveau_color',    defaultColor: '#e0f2fe' },
  { id: 'inprogress', status: 2, colorKey: 'column_inprogress_color', defaultColor: '#fef3c7' },
  { id: 'termine',    status: 6, colorKey: 'column_termine_color',    defaultColor: '#dcfce7' }
]

// Libellés prédéfinis par langue (clé = id du statut GLPI)
export const STATUS_LABELS = {
  fr: { 1: 'Nouveau', 2: 'En cours (attribué)', 6: 'Clos' },
  en: { 1: 'New',     2: 'In progress (assigned)', 6: 'Closed' },
  mg: { 1: 'Vaovao',  2: 'Efa manao',          6: 'Vita' }
}

// Clé de configuration pour la langue choisie
export const LANGUAGE_KEY = 'kanban_language'
export const DEFAULT_LANGUAGE = 'fr'

// Retourne le libellé d'un statut dans la langue demandée (fallback fr)
export function statusLabel(status, lang) {
  const dict = STATUS_LABELS[lang] || STATUS_LABELS[DEFAULT_LANGUAGE]
  return dict[status] || STATUS_LABELS[DEFAULT_LANGUAGE][status] || ''
}
