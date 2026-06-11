package com.newapp.controller;

import com.newapp.model.KanbanConfig;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/kanban-config")
public class KanbanConfigController {

    private final JdbcTemplate jdbc;

    public KanbanConfigController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private final RowMapper<KanbanConfig> rowMapper = (rs, rowNum) -> {
        KanbanConfig cfg = new KanbanConfig();
        cfg.setId(rs.getLong("id"));
        cfg.setKey(rs.getString("key"));
        cfg.setValue(rs.getString("value"));
        cfg.setUpdatedAt(rs.getString("updated_at"));
        return cfg;
    };

    /** GET /api/kanban-config  → retourne toute la config */
    @GetMapping
    public ResponseEntity<List<KanbanConfig>> getAll() {
        List<KanbanConfig> list = jdbc.query(
            "SELECT * FROM kanban_config ORDER BY id", rowMapper);
        return ResponseEntity.ok(list);
    }

    /** PUT /api/kanban-config/{key}  → met à jour une valeur */
    @PutMapping("/{key}")
    public ResponseEntity<?> update(@PathVariable String key,
                                    @RequestBody Map<String, String> body) {
        String value = body.get("value");
        if (value == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Champ 'value' manquant"));
        }
        jdbc.update(
            "INSERT INTO kanban_config (key, value, updated_at) VALUES (?, ?, datetime('now')) " +
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
            key, value);
        return ResponseEntity.ok(Map.of("key", key, "value", value, "updated", true));
    }

    /** PUT /api/kanban-config  → met à jour plusieurs clés en une fois */
    @PutMapping
    public ResponseEntity<?> updateBulk(@RequestBody List<Map<String, String>> updates) {
        int total = 0;
        for (Map<String, String> entry : updates) {
            String key   = entry.get("key");
            String value = entry.get("value");
            if (key != null && value != null) {
                total += jdbc.update(
                    "INSERT INTO kanban_config (key, value, updated_at) VALUES (?, ?, datetime('now')) " +
                    "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
                    key, value);
            }
        }
        return ResponseEntity.ok(Map.of("updated", total));
    }
}