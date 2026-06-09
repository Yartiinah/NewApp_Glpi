package com.newapp.service;

import com.newapp.repository.DataRepository;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ResetService {

    private final DataRepository dataRepository;

    public ResetService(DataRepository dataRepository) {
        this.dataRepository = dataRepository;
    }

    // Vide toute la table SQLite
    public Map<String, Object> resetAll() {
        int deleted = dataRepository.deleteAll();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("message", "Base de données réinitialisée avec succès");
        result.put("rowsDeleted", deleted);
        return result;
    }

    // Vide uniquement les types sélectionnés
    public Map<String, Object> resetByTypes(List<String> types) {
        int totalDeleted = 0;
        for (String type : types) {
            totalDeleted += dataRepository.deleteBySource(type);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("message", types.size() + " type(s) réinitialisé(s)");
        result.put("types", types);
        result.put("rowsDeleted", totalDeleted);
        return result;
    }
}