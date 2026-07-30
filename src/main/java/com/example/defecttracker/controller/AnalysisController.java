package com.example.defecttracker.controller;

import com.example.defecttracker.dto.AnalysisResponseDto;
import com.example.defecttracker.service.AnalysisService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/analysis")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AnalysisController {

    private final AnalysisService analysisService;

    @GetMapping("/{coilId}")
    public ResponseEntity<AnalysisResponseDto> getCoilAnalysis(@PathVariable String coilId) {
        AnalysisResponseDto result = analysisService.analyzeCoil(coilId);
        return ResponseEntity.ok(result);
    }
}