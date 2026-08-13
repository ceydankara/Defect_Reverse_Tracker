package com.example.defecttracker.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class CoilHistoryDto {
    private String coilId;
    private boolean previouslyReported;
    private long reportCount;
    private String summaryMessage;
    private List<PreviousReportDto> previousReports;

    @Data
    public static class PreviousReportDto {
        private String ticketNumber;
        private String defectType;
        private String department;
        private String reporterName;
        private String detectedLocation;
        private LocalDateTime createdAt;
    }
}
