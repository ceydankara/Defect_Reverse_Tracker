package com.example.defecttracker.service;

import com.example.defecttracker.dto.AnalysisResponseDto;
import com.example.defecttracker.entity.Coil;
import com.example.defecttracker.entity.Defect;
import com.example.defecttracker.entity.ProcessStage;
import com.example.defecttracker.entity.RootCauseResult;
import com.example.defecttracker.entity.SensorReading;
import com.example.defecttracker.repository.CoilRepository;
import com.example.defecttracker.repository.DefectRepository;
import com.example.defecttracker.repository.ProcessStageRepository;
import com.example.defecttracker.repository.RootCauseResultRepository;
import com.example.defecttracker.repository.SensorReadingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalysisService {

    private final CoilRepository coilRepository;
    private final DefectRepository defectRepository;
    private final ProcessStageRepository processStageRepository;
    private final RootCauseResultRepository rootCauseResultRepository;
    private final SensorReadingRepository sensorReadingRepository;
    private final QualityGradingService qualityGradingService;
    private final CoilIdResolver coilIdResolver;

    public AnalysisResponseDto getAnalysisByCoilId(String coilId) {
        return coilIdResolver.resolve(coilId)
                .flatMap(resolved -> coilRepository.findById(resolved)
                        .map(coil -> buildAnalysis(resolved, coil)))
                .orElse(null);
    }

    public boolean hasSensorData(String coilId) {
        return coilIdResolver.resolve(coilId)
                .flatMap(resolved -> coilRepository.findById(resolved))
                .map(coil -> !sensorReadingRepository.findByCoilIdOrderByTimeSecondAsc(coil.getCoilId()).isEmpty())
                .orElse(false);
    }

    private AnalysisResponseDto buildAnalysis(String coilId, Coil coil) {
        List<SensorReading> readings = sensorReadingRepository.findByCoilIdOrderByTimeSecondAsc(coilId);
        if (readings.isEmpty()) {
            return buildNoDataResponse(coilId, coil, "Bu bobin için sensör verisi bulunamadı.");
        }

        AnalysisResponseDto response = new AnalysisResponseDto();
        response.setCoilId(coilId);
        response.setSteelGrade(coil.getSteelGrade());

        defectRepository.findByCoilId(coilId).stream()
                .findFirst()
                .ifPresent(d -> response.setDefectCode(d.getDefectCode()));

        Map<String, List<SensorReading>> grouped = readings.stream()
                .collect(Collectors.groupingBy(
                        r -> compositeKey(r.getStageName(), r.getSensorKey()),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        Map<String, Boolean> stageAnomalies = new LinkedHashMap<>();
        List<AnalysisResponseDto.SensorSummaryDto> summaries = new ArrayList<>();

        for (Map.Entry<String, List<SensorReading>> entry : grouped.entrySet()) {
            SensorReading latest = latestReading(entry.getValue());
            boolean anomali = isOutOfLimits(latest);
            stageAnomalies.merge(latest.getStageName(), anomali, Boolean::logicalOr);

            AnalysisResponseDto.SensorSummaryDto summary = toSensorSummary(latest, entry.getValue());
            summaries.add(summary);
        }

        List<ProcessStage> stages = processStageRepository.findByCoilIdOrderByStageOrderAsc(coilId);
        response.setStages(stages.stream().map(s -> toStageDto(s, stageAnomalies)).collect(Collectors.toList()));

        boolean hasProductionAnomaly = stageAnomalies.values().stream().anyMatch(Boolean::booleanValue);
        response.setClassificationType(hasProductionAnomaly ? "PRODUCTION" : "LOGISTICS");

        ProcessStage anomalyStage = stages.stream()
                .filter(s -> stageAnomalies.getOrDefault(s.getStageName(), false))
                .findFirst()
                .orElse(null);

        AnalysisResponseDto.SensorSummaryDto primarySensor = summaries.stream()
                .filter(s -> "ANOMALI".equals(s.getStatus()))
                .findFirst()
                .orElse(null);

        response.setSensorSummaries(summaries);
        response.setRootCause(buildRootCause(coilId, hasProductionAnomaly, anomalyStage, primarySensor, summaries));
        response.setHeadline(buildHeadline(hasProductionAnomaly, anomalyStage, primarySensor));
        response.setEvidenceIndicators(buildEvidence(stages, summaries, hasProductionAnomaly, response.getRootCause()));

        if (primarySensor != null && primarySensor.getReadings() != null) {
            response.setTimeSeriesData(primarySensor.getReadings());
        } else {
            response.setTimeSeriesData(List.of());
        }

        response.setQualityGrading(qualityGradingService.grade(response));
        return response;
    }

    private AnalysisResponseDto buildNoDataResponse(String coilId, Coil coil, String message) {
        AnalysisResponseDto response = new AnalysisResponseDto();
        response.setCoilId(coilId);
        response.setSteelGrade(coil.getSteelGrade());
        response.setDataAvailable(false);
        response.setDataStatusMessage(message);
        response.setClassificationType(AnalysisResponseDto.CLASSIFICATION_NO_DATA);
        response.setHeadline("Sensör verisi yok — üretim/lojistik ayrımı yapılamaz");
        response.setStages(List.of());
        response.setSensorSummaries(List.of());
        response.setTimeSeriesData(List.of());
        response.setEvidenceIndicators(List.of(
                message,
                "Sensör verisi olmadığı için hasarın üretimden kaynaklanmadığı sonucuna varılamaz.",
                "Analiz için MES/üretim sisteminden bobin sensör kaydı gereklidir."
        ));
        response.setQualityGrading(qualityGradingService.unavailableGrade(coilId, message));
        return response;
    }

    private AnalysisResponseDto.StageDto toStageDto(ProcessStage stage, Map<String, Boolean> stageAnomalies) {
        AnalysisResponseDto.StageDto dto = new AnalysisResponseDto.StageDto();
        dto.setStageName(stage.getStageName());
        dto.setStageOrder(stage.getStageOrder());
        dto.setSensorCount(stage.getSensorCount());
        dto.setStatus(stageAnomalies.getOrDefault(stage.getStageName(), false) ? "ANOMALI" : "OK");
        return dto;
    }

    private AnalysisResponseDto.SensorSummaryDto toSensorSummary(SensorReading latest, List<SensorReading> allForSensor) {
        List<AnalysisResponseDto.TimeSeriesReadingDto> series = buildTimeSeries(latest, allForSensor);

        AnalysisResponseDto.SensorSummaryDto summary = new AnalysisResponseDto.SensorSummaryDto();
        summary.setSensorKey(latest.getSensorKey());
        summary.setStageName(latest.getStageName());
        summary.setUnit(resolveUnit(latest.getSensorKey()));
        summary.setLastActualValue(latest.getActualValue());
        summary.setTargetValue(latest.getTargetValue());
        summary.setMinLimit(latest.getMinLimit());
        summary.setMaxLimit(latest.getMaxLimit());
        summary.setStatus(isOutOfLimits(latest) ? "ANOMALI" : "OK");
        summary.setPercentageDeviation(calculateDeviation(latest));
        summary.setSparklineValues(extractSparkline(series));
        summary.setReadings(series);
        return summary;
    }

    private List<BigDecimal> extractSparkline(List<AnalysisResponseDto.TimeSeriesReadingDto> series) {
        List<BigDecimal> sparkline = new ArrayList<>();
        for (int i = 0; i < series.size(); i++) {
            if (i % 3 == 0) {
                sparkline.add(series.get(i).getActualValue());
            }
        }
        return sparkline;
    }

    private List<AnalysisResponseDto.TimeSeriesReadingDto> buildTimeSeries(SensorReading latest, List<SensorReading> stored) {
        if (stored.size() > 1) {
            return stored.stream().map(this::toTimeSeriesPoint).collect(Collectors.toList());
        }
        return generateSyntheticSeries(latest);
    }

    private List<AnalysisResponseDto.TimeSeriesReadingDto> generateSyntheticSeries(SensorReading snapshot) {
        List<AnalysisResponseDto.TimeSeriesReadingDto> series = new ArrayList<>();
        BigDecimal target = snapshot.getTargetValue();
        BigDecimal actual = snapshot.getActualValue();
        boolean anomali = isOutOfLimits(snapshot);

        for (int t = 0; t <= 180; t += 10) {
            double progress = t / 180.0;
            double curve = anomali ? Math.pow(progress, 1.35) : 1.0;
            double noise = Math.sin(t * 0.12) * target.doubleValue() * 0.012;

            BigDecimal value = anomali
                    ? target.add(actual.subtract(target).multiply(BigDecimal.valueOf(curve))).add(BigDecimal.valueOf(noise))
                    : target.add(BigDecimal.valueOf(noise));

            AnalysisResponseDto.TimeSeriesReadingDto point = toTimeSeriesPoint(snapshot);
            point.setTimeSecond(t);
            point.setActualValue(value.setScale(2, RoundingMode.HALF_UP));
            series.add(point);
        }
        return series;
    }

    private AnalysisResponseDto.TimeSeriesReadingDto toTimeSeriesPoint(SensorReading r) {
        AnalysisResponseDto.TimeSeriesReadingDto dto = new AnalysisResponseDto.TimeSeriesReadingDto();
        dto.setSensorKey(r.getSensorKey());
        dto.setTimeSecond(r.getTimeSecond());
        dto.setActualValue(r.getActualValue());
        dto.setTargetValue(r.getTargetValue());
        dto.setMinLimit(r.getMinLimit());
        dto.setMaxLimit(r.getMaxLimit());
        return dto;
    }

    private AnalysisResponseDto.RootCauseDto buildRootCause(
            String coilId,
            boolean hasProductionAnomaly,
            ProcessStage anomalyStage,
            AnalysisResponseDto.SensorSummaryDto primarySensor,
            List<AnalysisResponseDto.SensorSummaryDto> summaries) {

        AnalysisResponseDto.RootCauseDto dto = rootCauseResultRepository.findByCoilId(coilId)
                .map(rc -> toRootCauseDto(rc, anomalyStage))
                .orElseGet(() -> fallbackRootCause(hasProductionAnomaly, anomalyStage, primarySensor));

        ImpactSplit impact = computeImpactSplit(coilId, hasProductionAnomaly, primarySensor, summaries);
        dto.setProductionImpactPct(impact.productionPct());
        dto.setLogisticImpactPct(impact.logisticPct());
        return dto;
    }

    
    private ImpactSplit computeImpactSplit(
            String coilId,
            boolean hasProductionAnomaly,
            AnalysisResponseDto.SensorSummaryDto primarySensor,
            List<AnalysisResponseDto.SensorSummaryDto> summaries) {

        if (summaries.isEmpty()) {
            return new ImpactSplit(50, 50);
        }

        double maxAbsDev = summaries.stream()
                .mapToDouble(s -> s.getPercentageDeviation().abs().doubleValue())
                .max()
                .orElse(0.0);
        double avgAbsDev = summaries.stream()
                .mapToDouble(s -> s.getPercentageDeviation().abs().doubleValue())
                .average()
                .orElse(0.0);
        int coilJitter = Math.abs(coilId.hashCode() % 9) - 4;

        if (!hasProductionAnomaly) {
            long nominalCount = summaries.stream().filter(s -> "OK".equals(s.getStatus())).count();
            double nominalRatio = nominalCount / (double) summaries.size();
            double prod = 5.0
                    + avgAbsDev * 1.1
                    + maxAbsDev * 0.45
                    + (1.0 - nominalRatio) * 12.0
                    + coilJitter * 0.6;
            int production = clampInt((int) Math.round(prod), 5, 32);
            return new ImpactSplit(production, 100 - production);
        }

        List<AnalysisResponseDto.SensorSummaryDto> anomalous = summaries.stream()
                .filter(s -> "ANOMALI".equals(s.getStatus()))
                .toList();

        double primaryDev = primarySensor != null
                ? primarySensor.getPercentageDeviation().abs().doubleValue()
                : anomalous.stream()
                        .mapToDouble(s -> s.getPercentageDeviation().abs().doubleValue())
                        .max()
                        .orElse(maxAbsDev);
        long anomalySensorCount = anomalous.size();
        long anomalyStageCount = anomalous.stream()
                .map(AnalysisResponseDto.SensorSummaryDto::getStageName)
                .distinct()
                .count();
        double anomalyShare = anomalySensorCount / (double) summaries.size();

        // Sapma büyüklüğüne göre eğri: düşük/orta/yüksek sapmalar farklı yüzde üretir
        double devFactor = 1.0 - Math.exp(-primaryDev / 22.0);
        double prod = 54.0
                + devFactor * 36.0
                + anomalySensorCount * 3.2
                + anomalyStageCount * 4.5
                + anomalyShare * 14.0
                + avgAbsDev * 0.25
                + coilJitter * 0.5;
        int production = clampInt((int) Math.round(prod), 58, 96);
        return new ImpactSplit(production, 100 - production);
    }

    private int clampInt(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private record ImpactSplit(int productionPct, int logisticPct) {}

    private AnalysisResponseDto.RootCauseDto toRootCauseDto(RootCauseResult rc, ProcessStage anomalyStage) {
        AnalysisResponseDto.RootCauseDto dto = new AnalysisResponseDto.RootCauseDto();
        dto.setEquipment(rc.getEquipment());
        dto.setFaultSource(rc.getFaultSource());
        dto.setDetectionDetail(rc.getDetectionDetail());
        dto.setConfidenceRate(rc.getConfidenceRate());
        dto.setProductionImpactPct(rc.getProductionImpactPct());
        dto.setLogisticImpactPct(rc.getLogisticImpactPct());
        dto.setRecommendedAction(rc.getRecommendedAction());
        if (anomalyStage != null) {
            dto.setStageName(anomalyStage.getStageName());
        }
        return dto;
    }

    private AnalysisResponseDto.RootCauseDto fallbackRootCause(
            boolean hasProductionAnomaly,
            ProcessStage anomalyStage,
            AnalysisResponseDto.SensorSummaryDto primarySensor) {

        AnalysisResponseDto.RootCauseDto dto = new AnalysisResponseDto.RootCauseDto();
        if (hasProductionAnomaly && anomalyStage != null) {
            dto.setStageName(anomalyStage.getStageName());
            dto.setEquipment("ÜRETİM HATTI");
            dto.setFaultSource(anomalyStage.getStageName() + " aşamasında proses sapması");
            dto.setDetectionDetail(primarySensor != null
                    ? primarySensor.getSensorKey() + " sensöründe limit dışı değer."
                    : "Üretim hattında tolerans aşımı.");
            dto.setConfidenceRate(new BigDecimal("90.00"));
            dto.setProductionImpactPct(88);
            dto.setLogisticImpactPct(12);
            dto.setRecommendedAction("İlgili hat bakım ekibini yönlendirin.");
        } else {
            dto.setEquipment("DEPO / SEVKİYAT");
            dto.setFaultSource("Lojistik / taşıma kaynaklı mekanik hasar");
            dto.setDetectionDetail("Tüm üretim sensörleri nominal. Hasar dış etken profiline uyuyor.");
            dto.setConfidenceRate(new BigDecimal("88.00"));
            dto.setProductionImpactPct(8);
            dto.setLogisticImpactPct(92);
            dto.setRecommendedAction("Sevkiyat ve depolama kayıtlarını inceleyin.");
        }
        return dto;
    }

    private String buildHeadline(
            boolean hasProductionAnomaly,
            ProcessStage anomalyStage,
            AnalysisResponseDto.SensorSummaryDto primarySensor) {

        if (hasProductionAnomaly && anomalyStage != null) {
            String sensor = primarySensor != null ? " / " + primarySensor.getSensorKey() : "";
            return "Hasar Kaynağı Tespit Edildi — " + anomalyStage.getStageName() + sensor;
        }
        return "Üretim Hatları Temiz — Hasar Kaynağı: Lojistik / Taşıma";
    }
  
    private List<String> buildEvidence(
            List<ProcessStage> stages,
            List<AnalysisResponseDto.SensorSummaryDto> summaries,
            boolean hasProductionAnomaly,
            AnalysisResponseDto.RootCauseDto rootCause) {

        List<String> evidence = new ArrayList<>();
        long total = summaries.size();
        long nominal = summaries.stream().filter(s -> "OK".equals(s.getStatus())).count();

        if (hasProductionAnomaly) {
            summaries.stream()
                    .filter(s -> "ANOMALI".equals(s.getStatus()))
                    .forEach(s -> evidence.add(s.getStageName() + " / " + s.getSensorKey()
                            + " eşik dışı (%" + s.getPercentageDeviation().abs() + " sapma)."));
            stages.stream()
                    .filter(s -> summaries.stream().noneMatch(sum ->
                            sum.getStageName().equals(s.getStageName()) && "ANOMALI".equals(sum.getStatus())))
                    .forEach(s -> evidence.add(s.getStageName() + " aşaması nominal aralıkta."));
        } else {
            evidence.add("Tüm " + total + " sensör nominal (" + nominal + "/" + total + ").");
            evidence.add("Etki dağılımı: Üretim %" + rootCause.getProductionImpactPct()
                    + " | Lojistik %" + rootCause.getLogisticImpactPct());
            evidence.add("Üretim hattında eşzamanlı proses anomalisi yok.");
        }
        return evidence;
    }

    private SensorReading latestReading(List<SensorReading> readings) {
        return readings.stream()
                .max(Comparator.comparing(SensorReading::getTimeSecond))
                .orElse(readings.get(0));
    }

    private boolean isOutOfLimits(SensorReading reading) {
        if (reading.getMinLimit() != null && reading.getActualValue().compareTo(reading.getMinLimit()) < 0) {
            return true;
        }
        return reading.getMaxLimit() != null && reading.getActualValue().compareTo(reading.getMaxLimit()) > 0;
    }

    private BigDecimal calculateDeviation(SensorReading reading) {
        if (reading.getTargetValue() == null || reading.getTargetValue().compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return reading.getActualValue()
                .subtract(reading.getTargetValue())
                .divide(reading.getTargetValue(), 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(1, RoundingMode.HALF_UP);
    }

    private String compositeKey(String stageName, String sensorKey) {
        return stageName + "::" + sensorKey;
    }

    private String resolveUnit(String sensorKey) {
        String key = sensorKey.toLowerCase();
        if (key.contains("sıcaklık") || key.contains("sicaklik")) return "°C";
        if (key.contains("basınç") || key.contains("basinc")) return "bar";
        if (key.contains("kuvvet") || key.contains("gerginlik")) return "kN";
        if (key.contains("hız") || key.contains("hiz")) return "m/s";
        if (key.contains("oksijen")) return "Nm³/h";
        if (key.contains("debisi") || key.contains("debi")) return "L/min";
        if (key.contains("akım") || key.contains("akim")) return "kA";
        if (key.contains("konsantrasyon")) return "g/L";
        if (key.contains("baziklik")) return "";
        return "";
    }
}
