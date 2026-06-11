package com.newapp.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Paths;

@Component
public class DatabaseInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabaseInitializer.class);

    private final JdbcTemplate jdbc;

    @Value("${spring.datasource.url}")
    private String datasourceUrl;

    public DatabaseInitializer(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        // Créer le dossier data s'il n'existe pas
        try {
            String url = datasourceUrl;
            if (url.startsWith("jdbc:sqlite:")) {
                String dbPath = url.substring("jdbc:sqlite:".length());
                File dbFile = new File(dbPath);
                File parentDir = dbFile.getParentFile();
                if (parentDir != null && !parentDir.exists()) {
                    boolean created = parentDir.mkdirs();
                    if (created) {
                        log.info("📁 Dossier créé : {}", parentDir.getAbsolutePath());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Impossible de créer le dossier data: {}", e.getMessage());
        }

        boolean needsInit = false;
        try {
            Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='kanban_config'",
                Integer.class);
            needsInit = (count == null || count == 0);
        } catch (Exception e) {
            needsInit = true;
        }

        if (needsInit) {
            log.info("🗄️ Première initialisation de la base SQLite...");
            createSchema();
            log.info("✅ Schéma créé avec succès.");
        } else {
            log.info("✅ Base SQLite existante détectée — aucune réinitialisation.");
        }
    }

    private void createSchema() {
        // Création des tables
        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS data_records (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                source     TEXT    NOT NULL,
                content    TEXT    NOT NULL,
                created_at TEXT    DEFAULT (datetime('now'))
            )
        """);

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS kanban_config (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                key        TEXT    NOT NULL UNIQUE,
                value      TEXT    NOT NULL,
                updated_at TEXT    DEFAULT (datetime('now'))
            )
        """);

        // INSERT OR IGNORE pour toutes les clés de configuration
        jdbc.execute("""
            INSERT OR IGNORE INTO kanban_config (key, value) VALUES
                -- Couleurs
                ('column_nouveau_color',     '#e0f2fe'),
                ('column_inprogress_color',  '#fef3c7'),
                ('column_termine_color',     '#dcfce7'),
                -- Français
                ('column_nouveau_name_fr',   'Nouveau'),
                ('column_inprogress_name_fr','En cours (attribué)'),
                ('column_termine_name_fr',   'Terminé'),
                -- Malagasy
                ('column_nouveau_name_mg',   'Vaovao'),
                ('column_inprogress_name_mg','Efa manao'),
                ('column_termine_name_mg',   'Vita'),
                -- English
                ('column_nouveau_name_en',   'New'),
                ('column_inprogress_name_en','In progress (assigned)'),
                ('column_termine_name_en',   'Closed'),
                -- Langue par défaut
                ('kanban_language',          'fr')
        """);

        log.info("📋 Configuration Kanban initialisée avec couleurs et libellés (fr/en/mg).");
    }
}