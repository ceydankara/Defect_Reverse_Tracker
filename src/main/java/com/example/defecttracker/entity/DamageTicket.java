package com.example.defecttracker.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "damage_tickets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DamageTicket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_number", nullable = false, unique = true)
    private String ticketNumber;

    @Column(name = "reporter_name", nullable = false)
    private String reporterName;

    @Column(name = "department", nullable = false)
    private String department;

    @Column(name = "batch_id", nullable = false)
    private String batchId;

    @Column(name = "detected_location", nullable = false)
    private String detectedLocation;

    @Column(name = "defect_type", nullable = false)
    private String defectType;

    @Column(name = "extra_notes", columnDefinition = "TEXT")
    private String extraNotes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}