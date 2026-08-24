package com.example.defecttracker.service;

import com.example.defecttracker.dto.AnalysisResponseDto;
import com.example.defecttracker.dto.ConfirmGradeRequestDto;
import com.example.defecttracker.dto.ConfirmGradeResponseDto;
import com.example.defecttracker.dto.QualityGradingDto;
import com.example.defecttracker.entity.DamageTicket;
import com.example.defecttracker.entity.QualityGradeRecord;
import com.example.defecttracker.repository.DamageTicketRepository;
import com.example.defecttracker.repository.QualityGradeRecordRepository;
import com.example.defecttracker.repository.CoilRepository;
import com.example.defecttracker.repository.SensorReadingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class QualityGradingService {

    public static final String CUSTOMER = "CUSTOMER";
    public static final String SECOND_QUALITY = "SECOND_QUALITY";
    public static final String SCRAP = "SCRAP";

    private static final Set<String> SCRAP_DEFECTS = Set.of("DEF_POROSITY", "DEF_CRACK");
    private static final Set<String> SECOND_DEFECTS = Set.of(
            "DEF_IMPACT", "DEF_EDGE", "DEF_ACID_STAIN", "DEF_THICKNESS", "DEF_SCRATCH"
    );

    private final QualityGradeRecordRepository gradeRecordRepository;
    private final DamageTicketRepository ticketRepository;
    private final CoilIdResolver coilIdResolver;
    private final CoilRepository coilRepository;
    private final SensorReadingRepository sensorReadingRepository;

    public QualityGradingDto grade(AnalysisResponseDto analysis) {
        if (analysis == null || !analysis.isDataAvailable()) {
            return unavailableGrade(
                    analysis != null ? analysis.getCoilId() : "",
                    analysis != null && analysis.getDataStatusMessage() != null
                            ? analysis.getDataStatusMessage()
                            : "Sensör verisi bulunamadı.");
        }
        if (analysis.getSensorSummaries() == null || analysis.getSensorSummaries().isEmpty()) {
            return unavailableGrade(analysis.getCoilId(), "Bu bobin için sensör verisi bulunamadı.");
        }

        int anomalyCount = countAnomalies(analysis);
        double maxDeviation = maxDeviationPct(analysis);
        boolean production = "PRODUCTION".equals(analysis.getClassificationType());
        boolean logistics = "LOGISTICS".equals(analysis.getClassificationType());
        String defectCode = analysis.getDefectCode() != null ? analysis.getDefectCode() : "";
        int anomalyStages = countAnomalyStages(analysis);

        int scrapScore = 0;
        int secondScore = 0;
        int customerScore = 0;
        List<String> criteria = new ArrayList<>();

        if (SCRAP_DEFECTS.contains(defectCode)) {
            scrapScore += 45;
            criteria.add("Kusur kodu (" + defectCode + ") yapısal / geri dönüşümsüz hasar sınıfında.");
        }
        if (anomalyStages >= 2) {
            scrapScore += 35;
            criteria.add("Birden fazla üretim aşamasında eşzamanlı anomali (" + anomalyStages + " aşama).");
        }
        if (maxDeviation >= 30) {
            scrapScore += 30;
            criteria.add(String.format("Maksimum sensör sapması %%%.1f — kritik tolerans aşımı.", maxDeviation));
        } else if (maxDeviation >= 18) {
            secondScore += 25;
            criteria.add(String.format("Sensör sapması %%%.1f — sınırlı düzeltme ile telafi edilebilir.", maxDeviation));
        }
        if (production && anomalyCount > 0) {
            scrapScore += 15;
            secondScore += 20;
            criteria.add("Üretim kaynaklı proses anomalisi tespit edildi.");
        }
        if (logistics) {
            secondScore += 40;
            customerScore += 15;
            criteria.add("Üretim sensörleri nominal — hasar lojistik / dış etken profiline uyuyor.");
        }
        if (SECOND_DEFECTS.contains(defectCode)) {
            secondScore += 25;
            criteria.add("Kusur tipi ikinci kalite satış veya yeniden işleme ile uyumlu.");
        }
        if (anomalyCount == 0 && logistics) {
            secondScore += 20;
            criteria.add("Fabrika içi proses sapması yok — müşteri spesifikasyonu dışı estetik hasar.");
        }
        if (anomalyCount == 0 && !logistics && defectCode.isBlank()) {
            customerScore += 60;
            criteria.add("Anomali ve kayıtlı kusur bulunamadı — birincil kalite seviyesi.");
        }

        BigDecimal confidence = analysis.getRootCause() != null && analysis.getRootCause().getConfidenceRate() != null
                ? analysis.getRootCause().getConfidenceRate()
                : BigDecimal.valueOf(75);

        if (confidence.doubleValue() >= 90) {
            scrapScore += 5;
            secondScore += 5;
        } else if (confidence.doubleValue() < 75) {
            customerScore += 5;
            criteria.add("Analiz güven oranı düşük — manuel kalite onayı önerilir.");
        }

        customerScore = Math.max(customerScore, 5);
        secondScore = Math.max(secondScore, 10);
        scrapScore = Math.max(scrapScore, 5);

        int total = customerScore + secondScore + scrapScore;
        int customerPct = pct(customerScore, total);
        int secondPct = pct(secondScore, total);
        int scrapPct = pct(scrapScore, total);

        String recommended = pickGrade(customerPct, secondPct, scrapPct, defectCode, production, maxDeviation);

        QualityGradingDto dto = new QualityGradingDto();
        dto.setRecommendedGrade(recommended);
        dto.setRecommendedGradeLabel(labelFor(recommended));
        dto.setHeadline(buildHeadline(recommended, analysis.getCoilId()));
        dto.setConfidence(confidence);
        dto.setCustomerScore(customerPct);
        dto.setSecondQualityScore(secondPct);
        dto.setScrapScore(scrapPct);
        dto.setRequiresManualReview(confidence.doubleValue() < 80 || Math.abs(customerPct - secondPct) < 12);
        dto.setDispositionAction(dispositionFor(recommended));
        dto.setCriteria(criteria.isEmpty() ? List.of("Standart kalite değerlendirme kuralları uygulandı.") : criteria);
        dto.setGradeLabels(gradeLabelMap());
        return dto;
    }

    public QualityGradingDto unavailableGrade(String coilId, String message) {
        QualityGradingDto dto = new QualityGradingDto();
        dto.setDataAvailable(false);
        dto.setHeadline((coilId != null && !coilId.isBlank() ? coilId + " — " : "")
                + "Sensör verisi yok, otomatik kalite önerisi yapılamaz");
        dto.setRequiresManualReview(true);
        dto.setCustomerScore(0);
        dto.setSecondQualityScore(0);
        dto.setScrapScore(0);
        dto.setDispositionAction("MES sensör verisi gelene kadar otomatik kalite kararı verilemez.");
        dto.setCriteria(List.of(
                message,
                "Sensör verisi olmadan hurda / ikinci kalite / müşteri sevkiyatı önerisi üretilmez.",
                "Kalite mühendisi manuel inceleme yapmalı veya bobin kaydının sisteme aktarılmasını beklemelidir."
        ));
        dto.setGradeLabels(gradeLabelMap());
        return dto;
    }

    public ConfirmGradeResponseDto confirmDecision(ConfirmGradeRequestDto request) {
        String coilId = request.getCoilId().trim();

        if (!hasSensorData(coilId)) {
            throw new IllegalStateException(
                    "Sensör verisi olmadan kalite kararı verilemez. Bobin kaydının MES'ten aktarılması gerekir.");
        }
        String recommended = request.getRecommendedGrade() != null
                ? request.getRecommendedGrade()
                : request.getFinalGrade();

        if (gradeRecordRepository.findTopByCoilIdIgnoreCaseOrderByCreatedAtDesc(coilId).isPresent()) {
            long relatedCount = ticketRepository.countByBatchIdIgnoreCase(coilId);
            QualityGradeRecord existing = gradeRecordRepository
                    .findTopByCoilIdIgnoreCaseOrderByCreatedAtDesc(coilId).orElseThrow();
            return ConfirmGradeResponseDto.builder()
                    .id(existing.getId())
                    .coilId(coilId)
                    .finalGrade(existing.getFinalGrade())
                    .finalGradeLabel(labelFor(existing.getFinalGrade()))
                    .resolvedTicketCount((int) relatedCount)
                    .build();
        }

        QualityGradeRecord record = new QualityGradeRecord();
        record.setCoilId(coilId);
        record.setTicketNumber(request.getTicketNumber());
        record.setRecommendedGrade(recommended);
        record.setFinalGrade(request.getFinalGrade());
        record.setInspectorName(request.getInspectorName());
        record.setNotes(request.getNotes());
        QualityGradeRecord saved = gradeRecordRepository.save(record);

        int resolvedCount = (int) ticketRepository.countByBatchIdIgnoreCase(coilId);

        return ConfirmGradeResponseDto.builder()
                .id(saved.getId())
                .coilId(coilId)
                .finalGrade(saved.getFinalGrade())
                .finalGradeLabel(labelFor(saved.getFinalGrade()))
                .resolvedTicketCount(resolvedCount)
                .build();
    }

    private String pickGrade(int customerPct, int secondPct, int scrapPct, String defectCode,
                               boolean production, double maxDeviation) {
        if (SCRAP_DEFECTS.contains(defectCode) || scrapPct >= 55 || (production && maxDeviation >= 35)) {
            return SCRAP;
        }
        if (customerPct >= 55 && scrapPct < 20 && !production) {
            return CUSTOMER;
        }
        if (secondPct >= scrapPct || defectCode.startsWith("DEF_")) {
            return SECOND_QUALITY;
        }
        return scrapPct > secondPct ? SCRAP : SECOND_QUALITY;
    }

    private String buildHeadline(String grade, String coilId) {
        return switch (grade) {
            case CUSTOMER -> coilId + " — Müşteri sevkiyatına uygun (Birincil Kalite)";
            case SCRAP -> coilId + " — Hurda ayrıştırması önerilir";
            default -> coilId + " — İkinci kalite satış / yeniden işleme önerilir";
        };
    }

    private String dispositionFor(String grade) {
        return switch (grade) {
            case CUSTOMER -> "Sevkiyat planına alın, kalite sertifikası düzenleyin.";
            case SCRAP -> "Hurda sahasına yönlendirin, eritme/hurda kaydı açın.";
            default -> "İkinci kalite stok alanına ayırın, iskontolu satış veya yeniden işleme değerlendirin.";
        };
    }

    private String labelFor(String grade) {
        return gradeLabelMap().getOrDefault(grade, grade);
    }

    private Map<String, String> gradeLabelMap() {
        Map<String, String> map = new LinkedHashMap<>();
        map.put(CUSTOMER, "Müşteri Sevkiyatı (Birincil Kalite)");
        map.put(SECOND_QUALITY, "İkinci Kalite");
        map.put(SCRAP, "Hurda");
        return map;
    }

    private int countAnomalies(AnalysisResponseDto analysis) {
        if (analysis.getSensorSummaries() == null) return 0;
        return (int) analysis.getSensorSummaries().stream()
                .filter(s -> "ANOMALI".equals(s.getStatus()))
                .count();
    }

    private int countAnomalyStages(AnalysisResponseDto analysis) {
        if (analysis.getStages() == null) return 0;
        return (int) analysis.getStages().stream()
                .filter(s -> "ANOMALI".equals(s.getStatus()))
                .count();
    }

    private double maxDeviationPct(AnalysisResponseDto analysis) {
        if (analysis.getSensorSummaries() == null) return 0;
        return analysis.getSensorSummaries().stream()
                .filter(s -> s.getPercentageDeviation() != null)
                .mapToDouble(s -> Math.abs(s.getPercentageDeviation().doubleValue()))
                .max()
                .orElse(0);
    }

    private int pct(int part, int total) {
        if (total == 0) return 0;
        return BigDecimal.valueOf(part * 100.0 / total)
                .setScale(0, RoundingMode.HALF_UP)
                .intValue();
    }

    private boolean hasSensorData(String coilId) {
        return coilIdResolver.resolve(coilId)
                .flatMap(resolved -> coilRepository.findById(resolved))
                .map(coil -> !sensorReadingRepository.findByCoilIdOrderByTimeSecondAsc(coil.getCoilId()).isEmpty())
                .orElse(false);
    }
}
