package com.example.defecttracker.controller;

import com.example.defecttracker.dto.FieldCaseDetailDto;
import com.example.defecttracker.dto.FieldCaseItemDto;
import com.example.defecttracker.dto.FieldCaseResolutionRequestDto;
import com.example.defecttracker.dto.UpdateFieldCaseStatusDto;
import com.example.defecttracker.service.FieldCaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/field-cases")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class FieldCaseController {

    private final FieldCaseService fieldCaseService;

    @GetMapping
    public List<FieldCaseItemDto> listCases(@RequestParam(defaultValue = "all") String status) {
        return fieldCaseService.listCases(status);
    }

    @GetMapping("/{ticketNumber}")
    public ResponseEntity<FieldCaseDetailDto> getDetail(@PathVariable String ticketNumber) {
        return fieldCaseService.getDetail(ticketNumber)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{ticketNumber}/status")
    public ResponseEntity<FieldCaseItemDto> updateStatus(
            @PathVariable String ticketNumber,
            @RequestBody UpdateFieldCaseStatusDto body) {
        return fieldCaseService.updateStatus(ticketNumber, body.getCaseStatus())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{ticketNumber}/resolution")
    public ResponseEntity<FieldCaseDetailDto> applyResolution(
            @PathVariable String ticketNumber,
            @RequestBody FieldCaseResolutionRequestDto body) {
        return fieldCaseService.applyResolution(ticketNumber, body)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.badRequest().build());
    }
}
