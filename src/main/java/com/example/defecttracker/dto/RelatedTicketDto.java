package com.example.defecttracker.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class RelatedTicketDto {
    private String ticketNumber;
    private String defectType;
    private String department;
    private String reporterName;
    private LocalDateTime createdAt;
}
