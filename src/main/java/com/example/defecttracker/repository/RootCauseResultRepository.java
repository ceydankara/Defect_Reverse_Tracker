package com.example.defecttracker.repository;

import com.example.defecttracker.entity.RootCauseResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RootCauseResultRepository extends JpaRepository<RootCauseResult, Long> {
    Optional<RootCauseResult> findByCoil_CoilId(String coilId);
}