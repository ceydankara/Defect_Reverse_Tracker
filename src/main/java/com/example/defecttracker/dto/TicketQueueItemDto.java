package com.example.defecttracker.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class TicketQueueItemDto {
    private String ticketNumber;
    private String batchId;
    private String defectType;
    private String department;
    private String reporterName;
    private String detectedLocation;
    private String extraNotes;
    private LocalDateTime createdAt;
    private String gradeStatus;
    private String finalGrade;
    private String finalGradeLabel;
    private String recommendedGrade;
    private String recommendedGradeLabel;
    private String inspectorName;
    private int relatedTicketCount;
    private List<RelatedTicketDto> relatedTickets;
}
