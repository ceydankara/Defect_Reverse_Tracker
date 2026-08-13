package com.example.defecttracker.controller;

import com.example.defecttracker.dto.ConfirmGradeRequestDto;
import com.example.defecttracker.dto.ConfirmGradeResponseDto;
import com.example.defecttracker.dto.QualityGradingDto;
import com.example.defecttracker.service.AnalysisService;
import com.example.defecttracker.service.QualityGradingService;
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
        return ResponseEntity.ok(qualityGradingService.grade(analysis));
    }

    @PostMapping("/decisions")
    public ResponseEntity<ConfirmGradeResponseDto> confirmGrade(@RequestBody ConfirmGradeRequestDto request) {
        return ResponseEntity.ok(qualityGradingService.confirmDecision(request));
    }
}
