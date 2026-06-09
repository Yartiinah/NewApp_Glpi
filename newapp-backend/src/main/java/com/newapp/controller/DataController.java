// Package des contrôleurs API
package com.newapp.controller;

// Importation du modèle de données
import com.newapp.model.DataRecord;
// Importation du service de gestion des données
import com.newapp.service.DataService;
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
public class DataController {

    // Service pour accéder aux données
    private final DataService dataService;

    // Injection de dépendance par constructeur
    public DataController(DataService dataService) {
        this.dataService = dataService;
    }

    /**
     * GET /api/data
     * Retourne tous les enregistrements SQLite en JSON
     */
    @GetMapping("/data")
    public ResponseEntity<List<DataRecord>> getAllData() {
        return ResponseEntity.ok(dataService.getAll());
    }

    /**
     * GET /api/data/count
     * Retourne le nombre total d'enregistrements
     */
    @GetMapping("/data/count")
    public ResponseEntity<Map<String, Object>> getCount() {
        return ResponseEntity.ok(Map.of("count", dataService.getCount()));
    }
}
