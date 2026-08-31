package com.example.defecttracker.config;

import com.example.defecttracker.chat.AssistantChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class AssistantStatusLogger implements ApplicationRunner {

    private final AssistantChatService assistantChatService;

    @Override
    public void run(ApplicationArguments args) {
        if (assistantChatService.isAvailable()) {
            log.info("Kalite asistanı hazır (Gemini + domain araçları). POST /api/chat");
        } else {
            log.warn("Kalite asistanı kapalı: Gemini anahtarı yok. "
                    + "application-local.properties içine spring.ai.google.genai.api-key ekleyin.");
        }
    }
}
