package com.example.defecttracker.repository;

import com.example.defecttracker.entity.ProcessStage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProcessStageRepository extends JpaRepository<ProcessStage, Long> {

    @Query("SELECT p FROM ProcessStage p WHERE p.coilId = :coilId ORDER BY p.stageOrder ASC")
    List<ProcessStage> findByCoil_CoilIdOrderByStageOrderAsc(@Param("coilId") String coilId);
}