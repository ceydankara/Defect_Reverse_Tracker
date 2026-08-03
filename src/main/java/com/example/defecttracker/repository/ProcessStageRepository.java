package com.example.defecttracker.repository;

import com.example.defecttracker.entity.ProcessStage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProcessStageRepository extends JpaRepository<ProcessStage, Long> {
    List<ProcessStage> findByCoil_CoilIdOrderByStageOrderAsc(String coilId);}
