package com.example.defecttracker.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RemediationOptionDto {
    private String code;
    private String label;
    private String description;
    private boolean recommended;
}
