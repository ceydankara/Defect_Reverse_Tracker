package com.example.defecttracker.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class CoilHistoryResponseDto {
    private String batchId;
    private boolean hasPreviousReports;
    private int totalReports;
    private String summaryMessage;
    private List<CoilHistoryReportDto> reports;

    @Data
    @Builder
    public static class CoilHistoryReportDto {
        private String ticketNumber;
        private String defectCode;
        private String defectType;
        private BigDecimal confidenceRate;
        private String reporterName;
        private String department;
        private LocalDateTime reportedAt;
        private String relativeTimeLabel;
    }
}
