package com.example.defecttracker.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "coils")
@Getter @Setter
public class Coil {
    @Id
    @Column(name = "coil_id")
    private String coilId;

    @Column(name = "steel_grade", nullable = false)
    private String steelGrade;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}