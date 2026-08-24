package com.example.defecttracker.controller;

import com.example.defecttracker.dto.ConfirmGradeRequestDto;
import com.example.defecttracker.dto.ConfirmGradeResponseDto;
import com.example.defecttracker.dto.QualityGradingDto;
import com.example.defecttracker.entity.User;
import com.example.defecttracker.service.AnalysisService;
import com.example.defecttracker.service.QualityGradingService;
import com.example.defecttracker.util.UserDisplayNames;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/quality")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class QualityController {

    private final QualityGradingService qualityGradingService;
    private final AnalysisService analysisService;

    @GetMapping("/grade/{coilId}")
    public ResponseEntity<QualityGradingDto> getGrade(@PathVariable String coilId) {
        var analysis = analysisService.getAnalysisByCoilId(coilId);
        if (analysis == null) {
            return ResponseEntity.notFound().build();
        }
        if (!analysis.isDataAvailable()) {
            return ResponseEntity.ok(analysis.getQualityGrading());
        }
        return ResponseEntity.ok(qualityGradingService.grade(analysis));
    }

    @PostMapping("/decisions")
    public ResponseEntity<ConfirmGradeResponseDto> confirmGrade(
            @RequestBody ConfirmGradeRequestDto request,
            HttpServletRequest httpRequest) {
        User user = (User) httpRequest.getAttribute("currentUser");
        if (request.getInspectorName() == null || request.getInspectorName().isBlank()) {
            request.setInspectorName(UserDisplayNames.formatInspector(user));
        }
        try {
            return ResponseEntity.ok(qualityGradingService.confirmDecision(request));
        } catch (IllegalStateException ex) {
            return ResponseEntity.badRequest().build();
        }
    }
}
