package com.example.defecttracker.repository;
import com.example.defecttracker.entity.Defect;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface DefectRepository extends JpaRepository<Defect, Long> {
    Optional<Defect> findByCoilId(String coilId);
}