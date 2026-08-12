package com.example.defecttracker.controller;

import com.example.defecttracker.dto.AnalysisResponseDto;
import com.example.defecttracker.service.AnalysisService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/analysis")
@CrossOrigin(origins = "*")
public class AnalysisController {

    @Autowired
    private AnalysisService analysisService;

    @GetMapping("/{coilId}")
    public ResponseEntity<AnalysisResponseDto> getAnalysis(@PathVariable String coilId) {
        AnalysisResponseDto response = analysisService.getAnalysisByCoilId(coilId);
        if (response == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(response);
    }
}