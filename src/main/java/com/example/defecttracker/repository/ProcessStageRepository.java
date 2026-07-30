package com.example.defecttracker.repository;

import com.example.defecttracker.entity.ProcessStage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProcessStageRepository extends JpaRepository<ProcessStage, Long> {
    List<ProcessStage> findByCoilIdOrderByStageOrderAsc(String coilId);
}