package com.example.defecttracker.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
public class QualityGradingDto {
    /** false when sensör verisi yok — otomatik kalite önerisi ve onay kapalı */
    private boolean dataAvailable = true;
    private String recommendedGrade;
    private String recommendedGradeLabel;
    private String headline;
    private BigDecimal confidence;
    private Integer customerScore;
    private Integer secondQualityScore;
    private Integer scrapScore;
    private boolean requiresManualReview;
    private String dispositionAction;
    private List<String> criteria;
    private Map<String, String> gradeLabels;
}
