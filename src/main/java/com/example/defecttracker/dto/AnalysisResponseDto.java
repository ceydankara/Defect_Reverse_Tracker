package com.example.defecttracker.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class AnalysisResponseDto {
    private String coilId;
    private String defectCode;

    private List<StageDto> stages;
    private RootCauseDto rootCause;
    private List<SensorSummaryDto> sensorSummaries;
    private List<TimeSeriesReadingDto> timeSeriesData;

    @Data
    public static class StageDto {
        private String stageName;
        private Integer stageOrder;
        private String status;
        private Integer sensorCount;
    }

    @Data
    public static class RootCauseDto {
        private String equipment;
        private String faultSource;
        private String detectionDetail;
        private BigDecimal confidenceRate;
        private Integer productionImpactPct;
        private Integer logisticImpactPct;
        private String recommendedAction;
    }

    @Data
    public static class SensorSummaryDto {
        private String sensorKey;
        private BigDecimal lastActualValue;
        private BigDecimal targetValue;
        private BigDecimal minLimit;
        private BigDecimal maxLimit;
        private String status;
        private BigDecimal percentageDeviation;
    }

    @Data
    public static class TimeSeriesReadingDto {
        private String sensorKey;
        private Integer timeSecond;
        private BigDecimal actualValue;
        private BigDecimal targetValue;
        private BigDecimal minLimit;
        private BigDecimal maxLimit;
    }
}