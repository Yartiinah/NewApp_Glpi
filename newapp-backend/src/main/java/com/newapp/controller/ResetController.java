// Package des contrôleurs API
package com.newapp.controller;

// Importation du service de réinitialisation
import com.newapp.service.ResetService;
// Importation des annotations Spring Web
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

// Importation des collections Java
import java.util.List;
import java.util.Map;

// Annotation REST: crée des endpoints API
@RestController
// Préfixe de base pour toutes les routes
@RequestMapping("/api")
public class ResetController {

    // Service pour réinitialiser les données
    private final ResetService resetService;

    // Injection de dépendance par constructeur
    public ResetController(ResetService resetService) {
        this.resetService = resetService;
    }

    /**
     * DELETE /api/reset
     * Vide toute la table SQLite
     */
    @DeleteMapping("/reset")
    public ResponseEntity<Map<String, Object>> resetAll() {
        try {
            return ResponseEntity.ok(resetService.resetAll());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * DELETE /api/reset/types
     * Vide uniquement les types sélectionnés
     * Body : { "types": ["Ticket", "Computer", ...] }
     */
    @DeleteMapping("/reset/types")
    public ResponseEntity<Map<String, Object>> resetByTypes(
            @RequestBody Map<String, Object> body) {
        try {
            @SuppressWarnings("unchecked")
            List<String> types = (List<String>) body.get("types");
            if (types == null || types.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "message", "Aucun type spécifié"));
            }
            return ResponseEntity.ok(resetService.resetByTypes(types));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }
}