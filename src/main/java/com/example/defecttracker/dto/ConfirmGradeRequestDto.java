package com.example.defecttracker.dto;

import lombok.Data;

@Data
public class ConfirmGradeRequestDto {
    private String coilId;
    private String finalGrade;
    private String recommendedGrade;
    private String inspectorName;
    private String notes;
    private String ticketNumber;
}
