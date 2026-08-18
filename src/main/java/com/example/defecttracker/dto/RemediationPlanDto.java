package com.example.defecttracker.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class RemediationPlanDto {
    private String dominantSource;
    private String dominantLabel;
    private List<String> workflowSteps;
    private List<RemediationOptionDto> options;
    /** Telafi seçimine ek olarak CAPA açılabilir (üretim / lojistik) */
    private boolean capaOptional;
    private String capaLabel;
    private boolean capaDefaultOpen;
}
