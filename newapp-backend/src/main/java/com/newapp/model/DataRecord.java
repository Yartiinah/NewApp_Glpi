// Package des modèles de données
package com.newapp.model;

// Modèle représentant un enregistrement de données importées
public class DataRecord {
    private Long id; // Identifiant unique
    private String source; // Nom du fichier importé
    private String content; // Données JSON brutes
    private String createdAt; // Date de création

    // Constructeur vide (requis par JPA)
    public DataRecord() {}

    // Constructeur avec source et contenu
    public DataRecord(String source, String content) {
        this.source = source;
        this.content = content;
    }

    // Getters et setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
