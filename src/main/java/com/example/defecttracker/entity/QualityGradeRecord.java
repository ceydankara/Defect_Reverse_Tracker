package com.example.defecttracker.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "quality_grade_records")
@Getter
@Setter
public class QualityGradeRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "coil_id", nullable = false)
    private String coilId;

    @Column(name = "ticket_number")
    private String ticketNumber;

    @Column(name = "recommended_grade", nullable = false)
    private String recommendedGrade;

    @Column(name = "final_grade", nullable = false)
    private String finalGrade;

    @Column(name = "inspector_name")
    private String inspectorName;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
