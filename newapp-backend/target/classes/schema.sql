-- Création de la table principale si elle n'existe pas déjà
CREATE TABLE IF NOT EXISTS data_records (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    source    TEXT    NOT NULL,           -- nom du fichier importé
    content   TEXT    NOT NULL,           -- données JSON brutes
    created_at TEXT   DEFAULT (datetime('now'))
);

-- Création de la table de configuration Kanban
CREATE TABLE IF NOT EXISTS kanban_config (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    key       TEXT    NOT NULL UNIQUE,    -- clé de configuration (ex: column_nouveau_color)
    value     TEXT    NOT NULL,           -- valeur de configuration
    updated_at TEXT   DEFAULT (datetime('now'))
);

-- Insertion des valeurs par défaut pour la configuration Kanban
INSERT OR IGNORE INTO kanban_config (key, value) VALUES 
    ('column_nouveau_color', '#e0f2fe'),
    ('column_inprogress_color', '#fef3c7'),
    ('column_termine_color', '#dcfce7'),
    ('column_nouveau_name_fr', 'Nouveau'),
    ('column_inprogress_name_fr', 'In progress'),
    ('column_termine_name_fr', 'Terminé'),
    ('column_nouveau_name_mg', 'vaovao'),
    ('column_inprogress_name_mg', 'efa manao'),
    ('column_termine_name_mg', 'vita');
