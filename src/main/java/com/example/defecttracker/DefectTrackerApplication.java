package com.example.defecttracker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.Locale;

@SpringBootApplication
public class DefectTrackerApplication {

    public static void main(String[] args) {
        // Gemini function schema uses type STRING; Turkish locale turns it into STRİNG.
        Locale.setDefault(Locale.ENGLISH);
        SpringApplication.run(DefectTrackerApplication.class, args);
    }

}
