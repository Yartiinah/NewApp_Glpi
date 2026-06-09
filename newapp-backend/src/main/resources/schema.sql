-- Création de la table principale si elle n'existe pas déjà
CREATE TABLE IF NOT EXISTS data_records (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    source    TEXT    NOT NULL,           -- nom du fichier importé
    content   TEXT    NOT NULL,           -- données JSON brutes
    created_at TEXT   DEFAULT (datetime('now'))
);
