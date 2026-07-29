package com.example.defecttracker.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "process_stages")
@Getter @Setter
public class ProcessStage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "stage_id")
    private Long stageId;

    @Column(name = "coil_id")
    private String coilId;

    @Column(name = "stage_name")
    private String stageName;

    @Column(name = "stage_order")
    private Integer stageOrder;

    private String status;

    @Column(name = "sensor_count")
    private Integer sensorCount;
}