package com.example.defecttracker.chat;

public class AssistantUnavailableException extends RuntimeException {

    public AssistantUnavailableException() {
        super("Kalite asistanı kapalı. Gemini API anahtarı tanımlı değil. "
                + "application-local.properties dosyasına spring.ai.google.genai.api-key ekleyin.");
    }
}
