package com.example.defecttracker.repository;

import com.example.defecttracker.entity.SensorReading;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SensorReadingRepository extends JpaRepository<SensorReading, Long> {

    @Query("SELECT s FROM SensorReading s WHERE s.coilId = :coilId ORDER BY s.timeSecond ASC")
    List<SensorReading> findByCoil_CoilIdOrderByTimeSecondAsc(@Param("coilId") String coilId);
}