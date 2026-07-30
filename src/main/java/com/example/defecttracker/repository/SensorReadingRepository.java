package com.example.defecttracker.repository;

import com.example.defecttracker.entity.SensorReading;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SensorReadingRepository extends JpaRepository<SensorReading, Long> {
    List<SensorReading> findByCoilIdAndStageName(String coilId, String stageName);
}