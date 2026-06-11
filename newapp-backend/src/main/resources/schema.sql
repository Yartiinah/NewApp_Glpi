-- ==============================================================
-- ATTENTION : ce fichier n'est PAS exécuté automatiquement.
-- L'initialisation est gérée par DatabaseInitializer.java
-- qui crée le schéma UNE SEULE FOIS si la base n'existe pas.
--
-- spring.sql.init.mode=never dans application.properties
-- ==============================================================

-- Création de la table principale
CREATE TABLE IF NOT EXISTS data_records (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    source     TEXT    NOT NULL,
    content    TEXT    NOT NULL,
    created_at TEXT    DEFAULT (datetime('now'))
);

-- Création de la table de configuration Kanban
CREATE TABLE IF NOT EXISTS kanban_config (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    key        TEXT    NOT NULL UNIQUE,
    value      TEXT    NOT NULL,
    updated_at TEXT    DEFAULT (datetime('now'))
);

-- Valeurs par défaut (INSERT OR IGNORE = ne réinitialise pas les valeurs déjà sauvegardées)
INSERT OR IGNORE INTO kanban_config (key, value) VALUES
    ('column_nouveau_color',    '#e0f2fe'),
    ('column_inprogress_color', '#fef3c7'),
    ('column_termine_color',    '#dcfce7'),
    ('kanban_language',         'fr');