package com.example.defecttracker.dto;

import lombok.Data;

@Data
public class FieldCaseResolutionRequestDto {
    private String commercialAction;
    private String capaReference;
    private String resolutionNotes;
    private Boolean markResolved;
}
