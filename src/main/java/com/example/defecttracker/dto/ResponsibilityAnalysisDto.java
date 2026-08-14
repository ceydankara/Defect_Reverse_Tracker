package com.example.defecttracker.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ResponsibilityAnalysisDto {
    private Integer productionPct;
    private Integer logisticsPct;
    private Integer customerPct;
    private String summary;
    private String recommendedAction;
    private List<String> indicators;
    private String dominantSource;
    private RemediationPlanDto remediationPlan;
}
