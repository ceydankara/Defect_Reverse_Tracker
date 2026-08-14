package com.example.defecttracker.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class FieldCaseDetailDto {
    private FieldCaseItemDto ticket;
    private AnalysisResponseDto analysis;
    private String analysisHeadline;
    private ResponsibilityAnalysisDto responsibility;
    private String priorQualityDecision;
    private String coilHistorySummary;
    private int priorReportCount;
    private List<String> relatedTicketNumbers;
}
