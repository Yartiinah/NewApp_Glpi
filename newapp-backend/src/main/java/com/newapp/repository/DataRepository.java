package com.newapp.repository;

import com.newapp.model.DataRecord;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class DataRepository {

    private final JdbcTemplate jdbc;

    public DataRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private final RowMapper<DataRecord> rowMapper = (rs, rowNum) -> {
        DataRecord record = new DataRecord();
        record.setId(rs.getLong("id"));
        record.setSource(rs.getString("source"));
        record.setContent(rs.getString("content"));
        record.setCreatedAt(rs.getString("created_at"));
        return record;
    };

    // Lire tous les enregistrements
    public List<DataRecord> findAll() {
        return jdbc.query("SELECT * FROM data_records ORDER BY id DESC", rowMapper);
    }

    // Lire par type (source)
    public List<DataRecord> findBySource(String source) {
        return jdbc.query("SELECT * FROM data_records WHERE source = ? ORDER BY id DESC", rowMapper, source);
    }

    // Insérer un enregistrement
    public int insert(DataRecord record) {
        return jdbc.update(
            "INSERT INTO data_records (source, content) VALUES (?, ?)",
            record.getSource(), record.getContent()
        );
    }

    // Supprimer tous les enregistrements
    public int deleteAll() {
        int count = count();
        jdbc.update("DELETE FROM data_records");
        jdbc.update("DELETE FROM sqlite_sequence WHERE name='data_records'");
        return count;
    }

    // Supprimer par type (source)
    public int deleteBySource(String source) {
        return jdbc.update("DELETE FROM data_records WHERE source = ?", source);
    }

    // Compter tous les enregistrements
    public int count() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM data_records", Integer.class);
    }
}