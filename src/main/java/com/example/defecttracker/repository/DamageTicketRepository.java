package com.example.defecttracker.repository;

import com.example.defecttracker.entity.DamageTicket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DamageTicketRepository extends JpaRepository<DamageTicket, Long> {
    Optional<DamageTicket> findByTicketNumber(String ticketNumber);
    List<DamageTicket> findByBatchId(String batchId);

    List<DamageTicket> findByBatchIdIgnoreCaseOrderByCreatedAtDesc(String batchId);

    long countByBatchIdIgnoreCase(String batchId);

    List<DamageTicket> findTop5ByOrderByCreatedAtDesc();

    List<DamageTicket> findAllByOrderByCreatedAtDesc();
}