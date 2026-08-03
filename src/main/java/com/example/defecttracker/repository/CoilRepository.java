package com.example.defecttracker.repository;

import com.example.defecttracker.entity.Coil;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CoilRepository extends JpaRepository<Coil, String> {
}