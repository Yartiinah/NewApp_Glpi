// Package principal de l'application
package com.newapp;

// Importation Spring Boot pour démarrer l'application
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

// Annotation principale Spring Boot
@SpringBootApplication
public class NewAppApplication {
    // Point d'entrée principal de l'application
    public static void main(String[] args) {
        // Démarre l'application Spring Boot
        SpringApplication.run(NewAppApplication.class, args);
    }
}
