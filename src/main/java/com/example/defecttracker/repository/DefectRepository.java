package com.example.defecttracker.repository;

import com.example.defecttracker.entity.Defect;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DefectRepository extends JpaRepository<Defect, Long> {

    @Query("SELECT d FROM Defect d WHERE d.coilId = :coilId")
    List<Defect> findByCoilId(@Param("coilId") String coilId);

    @Query("SELECT d.defectCode, COUNT(d) FROM Defect d GROUP BY d.defectCode")
    List<Object[]> countByDefectCode();

    @Query("SELECT c.steelGrade, COUNT(d) FROM Defect d, Coil c WHERE d.coilId = c.coilId GROUP BY c.steelGrade")
    List<Object[]> countBySteelGrade();
}
