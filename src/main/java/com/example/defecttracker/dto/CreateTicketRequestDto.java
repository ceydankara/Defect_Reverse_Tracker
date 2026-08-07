package com.example.defecttracker.dto;

import lombok.Data;

@Data
public class CreateTicketRequestDto {
    private String reporterName;
    private String department;
    private String batchId;
    private String detectedLocation;
    private String defectType;
    private String extraNotes;
}