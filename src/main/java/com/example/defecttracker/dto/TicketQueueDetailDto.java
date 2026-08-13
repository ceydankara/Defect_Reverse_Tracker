package com.example.defecttracker.dto;

import lombok.Builder;
import lombok.Data;
@Data
@Builder
public class TicketQueueDetailDto {
    private TicketQueueItemDto ticket;
    private QualityGradingDto qualityGrading;
    private String analysisHeadline;
    private AnalysisResponseDto analysis;
}
