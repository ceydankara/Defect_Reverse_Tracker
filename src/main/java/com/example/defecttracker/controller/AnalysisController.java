package com.example.defecttracker.controller;

import com.example.defecttracker.config.RolePermissions;
import com.example.defecttracker.dto.AnalysisResponseDto;
import com.example.defecttracker.entity.User;
import com.example.defecttracker.service.AnalysisService;
import jakarta.servlet.http.HttpServletRequest;
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
    public ResponseEntity<AnalysisResponseDto> getAnalysis(
            @PathVariable String coilId,
            HttpServletRequest request) {
        AnalysisResponseDto response = analysisService.getAnalysisByCoilId(coilId);
        if (response == null) {
            return ResponseEntity.notFound().build();
        }

        User user = (User) request.getAttribute("currentUser");
        if (!RolePermissions.canGradeQuality(user)) {
            response.setQualityGrading(null);
        }

        return ResponseEntity.ok(response);
    }
}
