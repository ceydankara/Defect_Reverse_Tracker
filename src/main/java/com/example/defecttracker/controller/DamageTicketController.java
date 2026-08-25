package com.example.defecttracker.controller;

import com.example.defecttracker.config.RolePermissions;
import com.example.defecttracker.dto.CoilHistoryDto;
import com.example.defecttracker.dto.CoilHistoryResponseDto;
import com.example.defecttracker.dto.CreateTicketRequestDto;
import com.example.defecttracker.dto.TicketQueueDetailDto;
import com.example.defecttracker.dto.TicketQueueItemDto;
import com.example.defecttracker.entity.DamageTicket;
import com.example.defecttracker.entity.User;
import com.example.defecttracker.repository.DamageTicketRepository;
import com.example.defecttracker.service.CoilHistoryService;
import com.example.defecttracker.service.FieldCaseService;
import com.example.defecttracker.service.TicketQueueService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DamageTicketController {

    private final DamageTicketRepository ticketRepository;
    private final CoilHistoryService coilHistoryService;
    private final TicketQueueService ticketQueueService;
    private final FieldCaseService fieldCaseService;

    @GetMapping("/queue")
    public ResponseEntity<List<TicketQueueItemDto>> listQueue(
            @RequestParam(defaultValue = "all") String status) {
        return ResponseEntity.ok(ticketQueueService.listQueue(status));
    }

    @GetMapping("/queue/{ticketNumber}")
    public ResponseEntity<TicketQueueDetailDto> getQueueDetail(@PathVariable String ticketNumber) {
        return ticketQueueService.getDetail(ticketNumber)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<DamageTicket> createTicket(
            @RequestBody CreateTicketRequestDto request,
            HttpServletRequest httpRequest) {
        User user = (User) httpRequest.getAttribute("currentUser");
        boolean fieldCase = FieldCaseService.FIELD_LOCATION.equals(request.getDetectedLocation());
        if (fieldCase && !RolePermissions.canManageFieldCases(user)) {
            return ResponseEntity.status(403).build();
        }
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String randomCode = String.format("%04d", (int) (Math.random() * 10000));
        String ticketNumber = "TKT-" + dateStr + "-" + randomCode;

        DamageTicket ticket = DamageTicket.builder()
                .ticketNumber(ticketNumber)
                .reporterName(request.getReporterName())
                .department(request.getDepartment())
                .batchId(request.getBatchId())
                .detectedLocation(request.getDetectedLocation())
                .defectType(request.getDefectType())
                .extraNotes(request.getExtraNotes())
                .customerCompany(request.getCustomerCompany())
                .contactPhone(request.getContactPhone())
                .build();

        fieldCaseService.initializeFieldCase(ticket);

        DamageTicket saved = ticketRepository.save(ticket);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/history/{coilId}")
    public ResponseEntity<CoilHistoryDto> getCoilHistory(@PathVariable String coilId) {
        CoilHistoryResponseDto src = coilHistoryService.getHistory(coilId);

        CoilHistoryDto history = new CoilHistoryDto();
        history.setCoilId(src.getBatchId());
        history.setPreviouslyReported(src.isHasPreviousReports());
        history.setReportCount(src.getTotalReports());
        history.setSummaryMessage(src.getSummaryMessage());
        history.setPreviousReports(src.getReports().stream().map(r -> {
            CoilHistoryDto.PreviousReportDto dto = new CoilHistoryDto.PreviousReportDto();
            dto.setTicketNumber(r.getTicketNumber());
            dto.setDefectType(r.getDefectType());
            dto.setDepartment(r.getDepartment());
            dto.setReporterName(r.getReporterName());
            dto.setCreatedAt(r.getReportedAt());
            return dto;
        }).toList());

        return ResponseEntity.ok(history);
    }
}
