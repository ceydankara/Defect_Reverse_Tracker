package com.example.defecttracker.repository;

import com.example.defecttracker.entity.Coil;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CoilRepository extends JpaRepository<Coil, String> {

    java.util.Optional<Coil> findFirstByCoilIdIgnoreCase(String coilId);

    java.util.Optional<Coil> findFirstByCoilIdEndingWithIgnoreCase(String suffix);

    java.util.Optional<Coil> findFirstByCoilIdContainingIgnoreCase(String part);
}