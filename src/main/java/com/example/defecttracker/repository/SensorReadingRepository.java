package com.example.defecttracker.repository;

import com.example.defecttracker.entity.SensorReading;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SensorReadingRepository extends JpaRepository<SensorReading, Long> {
    List<SensorReading> findByCoil_CoilIdOrderByTimeSecondAsc(String coilId);
}