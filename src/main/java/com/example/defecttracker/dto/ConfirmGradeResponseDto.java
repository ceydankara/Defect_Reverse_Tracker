package com.example.defecttracker.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ConfirmGradeResponseDto {
    private Long id;
    private String coilId;
    private String finalGrade;
    private String finalGradeLabel;
    private int resolvedTicketCount;
}
