// Package des modèles de données
package com.newapp.model;

// Modèle représentant une configuration Kanban
public class KanbanConfig {
    private Long id; // Identifiant unique
    private String key; // Clé de configuration
    private String value; // Valeur de configuration
    private String updatedAt; // Date de mise à jour

    // Constructeur vide (requis par JPA)
    public KanbanConfig() {}

    // Constructeur avec clé et valeur
    public KanbanConfig(String key, String value) {
        this.key = key;
        this.value = value;
    }

    // Getters et setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }

    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
}
