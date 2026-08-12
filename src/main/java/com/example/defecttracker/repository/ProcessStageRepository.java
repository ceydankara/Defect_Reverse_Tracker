package com.example.defecttracker.repository;

import com.example.defecttracker.entity.ProcessStage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProcessStageRepository extends JpaRepository<ProcessStage, Long> {
    List<ProcessStage> findByCoilIdOrderByStageOrderAsc(String coilId);

    @Query("SELECT p.stageName, COUNT(p) FROM ProcessStage p WHERE p.status = 'ANOMALI' GROUP BY p.stageName")
    List<Object[]> countAnomaliesByStage();

    @Query("SELECT DISTINCT p.coilId FROM ProcessStage p WHERE p.status = 'ANOMALI'")
    List<String> findDistinctCoilIdsWithAnomaly();
}
