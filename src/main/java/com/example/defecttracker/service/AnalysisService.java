package com.example.defecttracker.service;

import com.example.defecttracker.dto.AnalysisResponseDto;
import com.example.defecttracker.entity.*;
import com.example.defecttracker.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalysisService {

    private final DefectRepository defectRepository;
    private final ProcessStageRepository processStageRepository;
    private final RootCauseResultRepository rootCauseResultRepository;
    private final SensorReadingRepository sensorReadingRepository;

    public AnalysisResponseDto analyzeCoil(String coilId) {
        AnalysisResponseDto response = new AnalysisResponseDto();
        response.setCoilId(coilId);

        // 1. Kusur Kodunu Al
        defectRepository.findByCoilId(coilId)
                .ifPresent(d -> response.setDefectCode(d.getDefectCode()));

        // 2. Üretim Hattı Aşamalarını Al
        List<ProcessStage> stages = processStageRepository.findByCoilIdOrderByStageOrderAsc(coilId);
        response.setStages(stages.stream().map(s -> {
            AnalysisResponseDto.StageDto dto = new AnalysisResponseDto.StageDto();
            dto.setStageName(s.getStageName());
            dto.setStageOrder(s.getStageOrder());
            dto.setStatus(s.getStatus());
            dto.setSensorCount(s.getSensorCount());
            return dto;
        }).collect(Collectors.toList()));

        // 3. Kök Neden Analiz Bilgisini Al
        rootCauseResultRepository.findByCoilId(coilId).ifPresent(rc -> {
            AnalysisResponseDto.RootCauseDto rcDto = new AnalysisResponseDto.RootCauseDto();
            rcDto.setEquipment(rc.getEquipment());
            rcDto.setFaultSource(rc.getFaultSource());
            rcDto.setDetectionDetail(rc.getDetectionDetail());
            rcDto.setConfidenceRate(rc.getConfidenceRate());
            rcDto.setProductionImpactPct(rc.getProductionImpactPct());
            rcDto.setLogisticImpactPct(rc.getLogisticImpactPct());
            rcDto.setRecommendedAction(rc.getRecommendedAction());
            response.setRootCause(rcDto);
        });

        // 4. Anomali Olan Aşamayı Bul ve Sensör Verilerini Çek
        String anomalyStageName = stages.stream()
                .filter(s -> "ANOMALI".equalsIgnoreCase(s.getStatus()))
                .map(ProcessStage::getStageName)
                .findFirst()
                .orElse(stages.isEmpty() ? "" : stages.get(0).getStageName());

        List<SensorReading> readings = sensorReadingRepository.findByCoilIdAndStageName(coilId, anomalyStageName);

        // Grafik için Zaman Serisini Doldur
        response.setTimeSeriesData(readings.stream().map(r -> {
            AnalysisResponseDto.TimeSeriesReadingDto ts = new AnalysisResponseDto.TimeSeriesReadingDto();
            ts.setSensorKey(r.getSensorKey());
            ts.setTimeSecond(r.getTimeSecond());
            ts.setActualValue(r.getActualValue());
            ts.setTargetValue(r.getTargetValue());
            ts.setMinLimit(r.getMinLimit());
            ts.setMaxLimit(r.getMaxLimit());
            return ts;
        }).collect(Collectors.toList()));

        // 4 Kart İçin Sensör Özetlerini Oluştur
        var groupedBySensor = readings.stream()
                .collect(Collectors.groupingBy(SensorReading::getSensorKey));

        List<AnalysisResponseDto.SensorSummaryDto> summaries = groupedBySensor.entrySet().stream().map(entry -> {
            SensorReading latest = entry.getValue().stream()
                    .max((a, b) -> a.getTimeSecond().compareTo(b.getTimeSecond()))
                    .orElse(entry.getValue().get(0));

            AnalysisResponseDto.SensorSummaryDto card = new AnalysisResponseDto.SensorSummaryDto();
            card.setSensorKey(latest.getSensorKey());
            card.setLastActualValue(latest.getActualValue());
            card.setTargetValue(latest.getTargetValue());
            card.setMinLimit(latest.getMinLimit());
            card.setMaxLimit(latest.getMaxLimit());

            if (latest.getTargetValue() != null && latest.getTargetValue().doubleValue() != 0) {
                BigDecimal dev = latest.getActualValue().subtract(latest.getTargetValue())
                        .divide(latest.getTargetValue(), 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100));
                card.setPercentageDeviation(dev.setScale(1, RoundingMode.HALF_UP));
            }

            boolean isOut = (latest.getMinLimit() != null && latest.getActualValue().compareTo(latest.getMinLimit()) < 0) ||
                    (latest.getMaxLimit() != null && latest.getActualValue().compareTo(latest.getMaxLimit()) > 0);

            card.setStatus(isOut ? "ANOMALI" : "OK");

            return card;
        }).collect(Collectors.toList());

        response.setSensorSummaries(summaries);

        return response;
    }
}