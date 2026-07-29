package com.example.defecttracker.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;

@Entity
@Table(name = "sensor_readings")
@Getter @Setter
public class SensorReading {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "reading_id")
    private Long readingId;

    @Column(name = "coil_id")
    private String coilId;

    @Column(name = "stage_name")
    private String stageName;

    @Column(name = "sensor_key")
    private String sensorKey;

    @Column(name = "time_second")
    private Integer timeSecond;

    @Column(name = "actual_value")
    private BigDecimal actualValue;

    @Column(name = "target_value")
    private BigDecimal targetValue;

    @Column(name = "min_limit")
    private BigDecimal minLimit;

    @Column(name = "max_limit")
    private BigDecimal maxLimit;
}