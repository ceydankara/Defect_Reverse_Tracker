package com.example.defecttracker.repository;

import com.example.defecttracker.entity.RootCauseResult;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface RootCauseResultRepository extends JpaRepository<RootCauseResult, Long> {
    Optional<RootCauseResult> findByCoilId(String coilId);
}