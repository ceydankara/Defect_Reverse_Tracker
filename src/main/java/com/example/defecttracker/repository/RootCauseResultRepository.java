package com.example.defecttracker.repository;

import com.example.defecttracker.entity.RootCauseResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RootCauseResultRepository extends JpaRepository<RootCauseResult, Long> {

    @Query("SELECT r FROM RootCauseResult r WHERE r.coilId = :coilId")
    Optional<RootCauseResult> findByCoil_CoilId(@Param("coilId") String coilId);
}