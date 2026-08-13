package com.example.defecttracker.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class DashboardStatsDto {
    private long totalCoils;
    private long totalDefects;
    private long totalTickets;
    private long productionAnomalyCount;
    private long logisticsCaseCount;
    private long pendingQualityCount;
    private long decidedQualityCount;

    private List<CountItem> anomaliesByStage;
    private List<CountItem> defectsByCode;
    private List<CountItem> defectsBySteelGrade;
    private List<CountItem> qualityByGrade;
    private List<RecentTicketDto> recentTickets;

    @Data
    public static class CountItem {
        private String label;
        private long count;

        public CountItem(String label, long count) {
            this.label = label;
            this.count = count;
        }
    }

    @Data
    public static class RecentTicketDto {
        private String ticketNumber;
        private String batchId;
        private String defectType;
        private String department;
        private String reporterName;
        private LocalDateTime createdAt;
    }
}
