package com.example.defecttracker.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class FieldCaseItemDto {
    private String ticketNumber;
    private String batchId;
    private String defectType;
    private String customerCompany;
    private String reporterName;
    private String contactPhone;
    private String extraNotes;
    private String caseStatus;
    private String caseStatusLabel;
    private String gradeStatus;
    private String finalGradeLabel;
    private LocalDateTime createdAt;
    private String commercialAction;
    private String commercialActionLabel;
    private String capaReference;
    private String resolutionNotes;
}
