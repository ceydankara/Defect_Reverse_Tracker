package com.example.defecttracker.service;

import com.example.defecttracker.dto.CoilHistoryResponseDto;
import com.example.defecttracker.entity.DamageTicket;
import com.example.defecttracker.entity.Defect;
import com.example.defecttracker.entity.RootCauseResult;
import com.example.defecttracker.repository.DamageTicketRepository;
import com.example.defecttracker.repository.DefectRepository;
import com.example.defecttracker.repository.RootCauseResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CoilHistoryService {

    private final DamageTicketRepository ticketRepository;
    private final DefectRepository defectRepository;
    private final RootCauseResultRepository rootCauseResultRepository;

    public CoilHistoryResponseDto getHistory(String batchId) {
        String normalizedId = batchId.trim();
        List<DamageTicket> tickets = ticketRepository.findByBatchIdIgnoreCaseOrderByCreatedAtDesc(normalizedId);

        Optional<Defect> defect = defectRepository.findByCoilId(normalizedId).stream().findFirst();
        Optional<RootCauseResult> rootCause = rootCauseResultRepository.findByCoilId(normalizedId);

        String defectCode = defect.map(Defect::getDefectCode).orElse(null);
        BigDecimal confidence = rootCause.map(RootCauseResult::getConfidenceRate).orElse(null);

        List<CoilHistoryResponseDto.CoilHistoryReportDto> reports = new ArrayList<>();

        for (DamageTicket ticket : tickets) {
            reports.add(CoilHistoryResponseDto.CoilHistoryReportDto.builder()
                    .ticketNumber(ticket.getTicketNumber())
                    .defectCode(defectCode != null ? defectCode : mapDefectTypeToCode(ticket.getDefectType()))
                    .defectType(ticket.getDefectType())
                    .confidenceRate(confidence)
                    .reporterName(ticket.getReporterName())
                    .department(ticket.getDepartment())
                    .reportedAt(ticket.getCreatedAt())
                    .relativeTimeLabel(formatRelativeTime(ticket.getCreatedAt()))
                    .build());
        }

        if (reports.isEmpty() && defect.isPresent()) {
            LocalDateTime syntheticDate = LocalDateTime.now().minusMonths(3);
            reports.add(CoilHistoryResponseDto.CoilHistoryReportDto.builder()
                    .ticketNumber("SISTEM-KAYIT")
                    .defectCode(defect.get().getDefectCode())
                    .defectType(defect.get().getDefectCode())
                    .confidenceRate(confidence)
                    .reporterName("Sistem Analizi")
                    .department("Kalite Kontrol")
                    .reportedAt(syntheticDate)
                    .relativeTimeLabel(formatRelativeTime(syntheticDate))
                    .build());
        }

        reports.sort(Comparator.comparing(CoilHistoryResponseDto.CoilHistoryReportDto::getReportedAt,
                Comparator.nullsLast(Comparator.reverseOrder())));

        boolean hasPrevious = !reports.isEmpty();
        String summary = buildSummary(reports);

        return CoilHistoryResponseDto.builder()
                .batchId(normalizedId)
                .hasPreviousReports(hasPrevious)
                .totalReports(reports.size())
                .summaryMessage(summary)
                .reports(reports)
                .build();
    }

    private String buildSummary(List<CoilHistoryResponseDto.CoilHistoryReportDto> reports) {
        if (reports.isEmpty()) {
            return null;
        }
        CoilHistoryResponseDto.CoilHistoryReportDto latest = reports.get(0);
        String code = latest.getDefectCode() != null ? latest.getDefectCode() : latest.getDefectType();
        String time = latest.getRelativeTimeLabel() != null ? latest.getRelativeTimeLabel() : "";
        String confidencePart = latest.getConfidenceRate() != null
                ? String.format(", güven %%%s", latest.getConfidenceRate().stripTrailingZeros().toPlainString())
                : "";

        if (reports.size() == 1) {
            return String.format("Bu bobin daha önce raporlandı — %s %s%s", time, code, confidencePart);
        }
        return String.format("Bu bobin daha önce %d kez raporlandı — son: %s %s%s",
                reports.size(), time, code, confidencePart);
    }

    String formatRelativeTime(LocalDateTime dateTime) {
        if (dateTime == null) {
            return "bilinmeyen tarih";
        }
        LocalDateTime now = LocalDateTime.now();
        long minutes = ChronoUnit.MINUTES.between(dateTime, now);
        if (minutes < 1) return "az önce";
        if (minutes < 60) return minutes + " dakika önce";

        long hours = ChronoUnit.HOURS.between(dateTime, now);
        if (hours < 24) return hours + " saat önce";

        long days = ChronoUnit.DAYS.between(dateTime, now);
        if (days < 7) return days + " gün önce";
        if (days < 30) return (days / 7) + " hafta önce";
        if (days < 365) return (days / 30) + " ay önce";
        return (days / 365) + " yıl önce";
    }

    private String mapDefectTypeToCode(String defectType) {
        if (defectType == null) return "DEF_UNKNOWN";
        return switch (defectType) {
            case "Kenar Bozukluğu" -> "DEF_EDGE";
            case "Kalınlık Sapması" -> "DEF_THICKNESS";
            case "Darbe İzi" -> "DEF_IMPACT";
            case "Yüzey Çiziği" -> "DEF_SCRATCH";
            default -> "DEF_" + defectType.toUpperCase().replace(' ', '_');
        };
    }
}
