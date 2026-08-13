package com.example.defecttracker.service;

import com.example.defecttracker.entity.Coil;
import com.example.defecttracker.repository.CoilRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CoilIdResolver {

    private final CoilRepository coilRepository;

    public Optional<String> resolve(String rawId) {
        if (rawId == null || rawId.isBlank()) {
            return Optional.empty();
        }

        String trimmed = rawId.trim();

        if (coilRepository.existsById(trimmed)) {
            return Optional.of(trimmed);
        }

        Optional<Coil> exactIgnoreCase = coilRepository.findFirstByCoilIdIgnoreCase(trimmed);
        if (exactIgnoreCase.isPresent()) {
            return Optional.of(exactIgnoreCase.get().getCoilId());
        }

        if (trimmed.matches("\\d+")) {
            Optional<Coil> bySuffix = coilRepository.findFirstByCoilIdEndingWithIgnoreCase("-" + trimmed);
            if (bySuffix.isPresent()) {
                return Optional.of(bySuffix.get().getCoilId());
            }
            bySuffix = coilRepository.findFirstByCoilIdEndingWithIgnoreCase(trimmed);
            if (bySuffix.isPresent()) {
                return Optional.of(bySuffix.get().getCoilId());
            }
        }

        return coilRepository.findFirstByCoilIdContainingIgnoreCase(trimmed)
                .map(Coil::getCoilId);
    }
}
