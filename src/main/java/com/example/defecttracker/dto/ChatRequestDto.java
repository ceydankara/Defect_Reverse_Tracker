package com.example.defecttracker.dto;

import java.util.List;

public record ChatRequestDto(String message, List<ChatTurnDto> history) {
}
