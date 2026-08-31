package com.example.defecttracker.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.util.Map;

/**
 * Anahtar yoksa Gemini auto-config kapanır; uygulama asistan olmadan da ayağa kalkar.
 */
public class GeminiChatEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        if (!hasUsableKey(environment)) {
            environment.getPropertySources().addFirst(
                    new MapPropertySource("disable-gemini-without-key", Map.of("spring.ai.model.chat", "none")));
        }
    }

    private boolean hasUsableKey(ConfigurableEnvironment environment) {
        String key = firstNonBlank(
                environment.getProperty("spring.ai.google.genai.api-key"),
                environment.getProperty("GOOGLE_API_KEY"),
                environment.getProperty("GEMINI_API_KEY"));
        return key != null
                && !key.isBlank()
                && !key.contains("BURAYA")
                && !key.equalsIgnoreCase("your-key");
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
