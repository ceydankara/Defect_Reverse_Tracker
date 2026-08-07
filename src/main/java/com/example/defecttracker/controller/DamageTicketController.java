package com.example.defecttracker.controller;

import com.example.defecttracker.dto.CreateTicketRequestDto;
import com.example.defecttracker.entity.DamageTicket;
import com.example.defecttracker.repository.DamageTicketRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
@CrossOrigin(origins = "*") // CORS izni (Frontend'in bağlanması için şart)
public class DamageTicketController {

    private final DamageTicketRepository ticketRepository;

    @PostMapping
    public ResponseEntity<DamageTicket> createTicket(@RequestBody CreateTicketRequestDto request) {
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String randomCode = String.format("%04d", (int)(Math.random() * 10000));
        String ticketNumber = "TKT-" + dateStr + "-" + randomCode;

        DamageTicket ticket = DamageTicket.builder()
                .ticketNumber(ticketNumber)
                .reporterName(request.getReporterName())
                .department(request.getDepartment())
                .batchId(request.getBatchId())
                .detectedLocation(request.getDetectedLocation())
                .defectType(request.getDefectType())
                .extraNotes(request.getExtraNotes())
                .build();

        DamageTicket savedTicket = ticketRepository.save(ticket);
        return ResponseEntity.ok(savedTicket);
    }
}