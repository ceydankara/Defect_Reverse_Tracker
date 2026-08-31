package com.example.defecttracker.controller;

import com.example.defecttracker.chat.AssistantChatService;
import com.example.defecttracker.chat.AssistantUnavailableException;
import com.example.defecttracker.dto.ChatRequestDto;
import com.example.defecttracker.dto.ChatResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class AssistantChatController {

    private final AssistantChatService assistantChatService;

    @GetMapping("/status")
    public Map<String, Object> status() {
        boolean available = assistantChatService.isAvailable();
        return Map.of(
                "available", available,
                "message", available
                        ? "Kalite asistanı hazır."
                        : "Kalite asistanı kapalı. Gemini API anahtarı tanımlı değil.");
    }

    @PostMapping
    public ResponseEntity<?> chat(@RequestBody(required = false) ChatRequestDto request) {
        try {
            ChatResponseDto reply = assistantChatService.reply(request);
            return ResponseEntity.ok(reply);
        } catch (AssistantUnavailableException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", ex.getMessage(), "available", false));
        } catch (Exception ex) {
            log.warn("Kalite asistanı isteği başarısız: {}", ex.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of(
                            "message", "Asistan şu an yanıt veremedi. Biraz sonra tekrar deneyin.",
                            "available", true));
        }
    }
}
