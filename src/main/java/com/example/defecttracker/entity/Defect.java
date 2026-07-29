package com.example.defecttracker.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "defects")
@Getter @Setter
public class Defect {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "defect_id")
    private Long defectId;

    @Column(name = "coil_id")
    private String coilId;

    @Column(name = "defect_code")
    private String defectCode;

    private String status;
}