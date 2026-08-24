package com.example.defecttracker.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Bilinen bobin ID'sini çözer. Sistemde kayıt yoksa otomatik bobin/sensör oluşturmaz.
 */
@Service
@RequiredArgsConstructor
public class CoilProvisioningService {

    private final CoilIdResolver coilIdResolver;

    public Optional<String> resolveKnownCoilId(String batchId) {
        if (batchId == null || batchId.isBlank()) {
            return Optional.empty();
        }
        return coilIdResolver.resolve(batchId.trim());
    }
}
