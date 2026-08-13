package com.example.defecttracker.repository;

import com.example.defecttracker.entity.QualityGradeRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface QualityGradeRecordRepository extends JpaRepository<QualityGradeRecord, Long> {
    List<QualityGradeRecord> findByCoilIdOrderByCreatedAtDesc(String coilId);

    Optional<QualityGradeRecord> findTopByCoilIdOrderByCreatedAtDesc(String coilId);

    Optional<QualityGradeRecord> findTopByCoilIdIgnoreCaseOrderByCreatedAtDesc(String coilId);

    Optional<QualityGradeRecord> findTopByTicketNumberOrderByCreatedAtDesc(String ticketNumber);
}
