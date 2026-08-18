package com.example.defecttracker.dto;

import lombok.Data;

@Data
public class FieldCaseResolutionRequestDto {
    private String commercialAction;
    /** Telafi (kredi/red vb.) ile birlikte CAPA kaydı açılsın mı */
    private Boolean openCapa;
    private String capaReference;
    private String resolutionNotes;
    private Boolean markResolved;
}
