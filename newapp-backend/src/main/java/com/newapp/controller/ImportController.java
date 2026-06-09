// Package des contrôleurs API
package com.newapp.controller;

// Importation du service d'importation
import com.newapp.service.ImportService;
// Importation des annotations Spring Web
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

// Importation des collections Java
import java.util.List;
import java.util.Map;

// Annotation REST: crée des endpoints API
@RestController
// Préfixe de base pour toutes les routes
@RequestMapping("/api")
public class ImportController {

    // Service pour importer les données
    private final ImportService importService;

    // Injection de dépendance par constructeur
    public ImportController(ImportService importService) {
        this.importService = importService;
    }

    /**
     * POST /api/import
     * Import depuis un fichier CSV ou JSON uploadé
     */
    @PostMapping("/import")
    public ResponseEntity<Map<String, Object>> importFile(
            @RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "message", "Fichier vide"));
            }
            Map<String, Object> result = importService.importFile(file);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "Erreur : " + e.getMessage()));
        }
    }

    /**
     * POST /api/import/glpi
     * Reçoit une liste JSON depuis GLPI et l'insère dans SQLite
     * Body : { "source": "Ticket", "data": [...] }
     */
    @PostMapping("/import/glpi")
    public ResponseEntity<Map<String, Object>> importFromGlpi(
            @RequestBody Map<String, Object> body) {
        try {
            String source = (String) body.getOrDefault("source", "GLPI");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> data = (List<Map<String, Object>>) body.get("data");

            if (data == null || data.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "message", "Aucune donnée reçue"));
            }

            Map<String, Object> result = importService.importFromGlpi(source, data);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "Erreur : " + e.getMessage()));
        }
    }
}