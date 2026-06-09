package com.newapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newapp.model.DataRecord;
import com.newapp.repository.DataRepository;
import com.opencsv.CSVReader;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class ImportService {

    private final DataRepository dataRepository;
    private final ObjectMapper objectMapper;

    public ImportService(DataRepository dataRepository, ObjectMapper objectMapper) {
        this.dataRepository = dataRepository;
        this.objectMapper = objectMapper;
    }

    // Import depuis fichier CSV ou JSON uploadé
    public Map<String, Object> importFile(MultipartFile file) throws Exception {
        String filename = file.getOriginalFilename() != null
                ? file.getOriginalFilename().toLowerCase() : "";

        List<Map<String, Object>> rows;
        if (filename.endsWith(".csv")) {
            rows = parseCsv(file);
        } else if (filename.endsWith(".json")) {
            rows = parseJson(file);
        } else {
            throw new IllegalArgumentException("Format non supporté. Utilisez .csv ou .json");
        }

        int inserted = 0;
        for (Map<String, Object> row : rows) {
            String json = objectMapper.writeValueAsString(row);
            dataRepository.insert(new DataRecord(file.getOriginalFilename(), json));
            inserted++;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("filename", file.getOriginalFilename());
        result.put("rowsImported", inserted);
        result.put("format", filename.endsWith(".csv") ? "CSV" : "JSON");
        return result;
    }

    // Import depuis GLPI via API — reçoit une liste d'objets JSON
    public Map<String, Object> importFromGlpi(String source, List<Map<String, Object>> data) throws Exception {
        int inserted = 0;
        for (Map<String, Object> item : data) {
            String json = objectMapper.writeValueAsString(item);
            dataRepository.insert(new DataRecord(source, json));
            inserted++;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("source", source);
        result.put("rowsImported", inserted);
        return result;
    }

    private List<Map<String, Object>> parseCsv(MultipartFile file) throws Exception {
        List<Map<String, Object>> rows = new ArrayList<>();
        try (CSVReader reader = new CSVReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String[] headers = reader.readNext();
            if (headers == null) return rows;
            String[] line;
            while ((line = reader.readNext()) != null) {
                Map<String, Object> row = new LinkedHashMap<>();
                for (int i = 0; i < headers.length; i++) {
                    row.put(headers[i].trim(), i < line.length ? line[i].trim() : "");
                }
                rows.add(row);
            }
        }
        return rows;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseJson(MultipartFile file) throws Exception {
        Object parsed = objectMapper.readValue(file.getInputStream(), Object.class);
        if (parsed instanceof List) return (List<Map<String, Object>>) parsed;
        if (parsed instanceof Map) return List.of((Map<String, Object>) parsed);
        throw new IllegalArgumentException("JSON invalide");
    }
}