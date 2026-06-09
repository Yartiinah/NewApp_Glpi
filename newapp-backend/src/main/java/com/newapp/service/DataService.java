// Package des services métier
package com.newapp.service;

// Importation du modèle de données
import com.newapp.model.DataRecord;
// Importation du repository pour accéder à la base
import com.newapp.repository.DataRepository;
// Annotation Spring pour marquer comme service
import org.springframework.stereotype.Service;

// Importation des collections Java
import java.util.List;

// Annotation Service: composant métier Spring
@Service
public class DataService {

    // Repository pour accéder aux données SQLite
    private final DataRepository dataRepository;

    // Injection de dépendance par constructeur
    public DataService(DataRepository dataRepository) {
        this.dataRepository = dataRepository;
    }

    // Retourne tous les enregistrements SQLite
    public List<DataRecord> getAll() {
        return dataRepository.findAll();
    }

    // Retourne le nombre total d'enregistrements
    public int getCount() {
        return dataRepository.count();
    }
}
