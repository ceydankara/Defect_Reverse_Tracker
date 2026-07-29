package com.example.defecttracker.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;

@Entity
@Table(name = "root_cause_results")
@Getter @Setter
public class RootCauseResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "result_id")
    private Long resultId;

    @Column(name = "coil_id")
    private String coilId;

    private String equipment;

    @Column(name = "fault_source")
    private String faultSource;

    @Column(name = "detection_detail")
    private String detectionDetail;

    @Column(name = "confidence_rate")
    private BigDecimal confidenceRate;

    @Column(name = "production_impact_pct")
    private Integer productionImpactPct;

    @Column(name = "logistic_impact_pct")
    private Integer logisticImpactPct;

    @Column(name = "recommended_action")
    private String recommendedAction;
}