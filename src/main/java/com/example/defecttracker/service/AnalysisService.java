package com.example.defecttracker.service;

import com.example.defecttracker.dto.AnalysisResponseDto;
import com.example.defecttracker.entity.Coil;
import com.example.defecttracker.entity.Defect;
import com.example.defecttracker.entity.ProcessStage;
import com.example.defecttracker.entity.RootCauseResult;
import com.example.defecttracker.entity.SensorReading;
import com.example.defecttracker.repository.*;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AnalysisService {

    @Autowired private CoilRepository coilRepository;
    @Autowired private DefectRepository defectRepository;
    @Autowired private ProcessStageRepository processStageRepository;
    @Autowired private RootCauseResultRepository rootCauseResultRepository;
    @Autowired private SensorReadingRepository sensorReadingRepository;

    public AnalysisResponseDto getAnalysisByCoilId(String coilId) {
        Optional<Coil> coilOpt = coilRepository.findById(coilId);
        if (coilOpt.isEmpty()) {
            return null;
        }

        AnalysisResponseDto response = new AnalysisResponseDto();
        response.setCoilId(coilId);

        // 1. Kusur Bilgisi
        List<Defect> defects = defectRepository.findByCoilId(coilId);
        if (!defects.isEmpty()) {
            response.setDefectCode(defects.get(0).getDefectCode());
        }

        // 2. Sensör Verilerini Çek
        List<SensorReading> readings = sensorReadingRepository.findByCoil_CoilIdOrderByTimeSecondAsc(coilId);

        // 3. Dinamik Anomali ve Tolerans Hesabı
        Map<String, Boolean> stageAnomalies = new HashMap<>();
        boolean isAnyProductionAnomaly = false;

        List<AnalysisResponseDto.TimeSeriesReadingDto> timeSeries = new ArrayList<>();
        Map<String, SensorReading> latestReadingsMap = new LinkedHashMap<>();

        for (SensorReading r : readings) {
            // Zaman serisi DTO eşleme
            AnalysisResponseDto.TimeSeriesReadingDto ts = new AnalysisResponseDto.TimeSeriesReadingDto();
            ts.setSensorKey(r.getSensorKey());
            ts.setTimeSecond(r.getTimeSecond());
            ts.setActualValue(r.getActualValue());
            ts.setTargetValue(r.getTargetValue());
            ts.setMinLimit(r.getMinLimit());
            ts.setMaxLimit(r.getMaxLimit());
            timeSeries.add(ts);

            // Tolerans Kontrolü (min_limit ve max_limit dışına çıkılmış mı?)
            boolean isOutOfBounds = false;
            if (r.getMinLimit() != null && r.getActualValue().compareTo(r.getMinLimit()) < 0) isOutOfBounds = true;
            if (r.getMaxLimit() != null && r.getActualValue().compareTo(r.getMaxLimit()) > 0) isOutOfBounds = true;

            if (isOutOfBounds) {
                stageAnomalies.put(r.getStageName(), true);
                isAnyProductionAnomaly = true;
            }

            latestReadingsMap.put(r.getSensorKey(), r);
        }
        response.setTimeSeriesData(timeSeries);

        // 4. Aşama Durumlarını Güncelle ve DTO'ya Yaz
        List<ProcessStage> stages = processStageRepository.findByCoil_CoilIdOrderByStageOrderAsc(coilId);
        List<AnalysisResponseDto.StageDto> stageDtos = stages.stream().map(s -> {
            AnalysisResponseDto.StageDto dto = new AnalysisResponseDto.StageDto();
            dto.setStageName(s.getStageName());
            dto.setStageOrder(s.getStageOrder());

            // Eğer sensörlerden herhangi biri bu aşamada anomali verdiyse ANOMALI yap
            boolean hasAnomaly = stageAnomalies.getOrDefault(s.getStageName(), false);
            dto.setStatus(hasAnomaly ? "ANOMALI" : "OK");
            dto.setSensorCount(s.getSensorCount());
            return dto;
        }).collect(Collectors.toList());
        response.setStages(stageDtos);

        // 5. Kök Neden (Root Cause) Mantığı (Üretim mi / Lojistik mi?)
        Optional<RootCauseResult> rcOpt = rootCauseResultRepository.findByCoil_CoilId(coilId);
        AnalysisResponseDto.RootCauseDto rcDto = new AnalysisResponseDto.RootCauseDto();

        if (rcOpt.isPresent()) {
            RootCauseResult rc = rcOpt.get();
            rcDto.setEquipment(rc.getEquipment());
            rcDto.setFaultSource(rc.getFaultSource());
            rcDto.setDetectionDetail(rc.getDetectionDetail());
            rcDto.setConfidenceRate(rc.getConfidenceRate());
            rcDto.setProductionImpactPct(rc.getProductionImpactPct());
            rcDto.setLogisticImpactPct(rc.getLogisticImpactPct());
            rcDto.setRecommendedAction(rc.getRecommendedAction());
        } else {
            // Veritabanında manuel kök neden yoksa Otomatik Mantık Çalıştır:
            if (!isAnyProductionAnomaly) {
                // HİÇBİR ANOMALİ YOKSA -> LOJİSTİK KAYNAKLI
                rcDto.setEquipment("DEPO / SEVKİYAT");
                rcDto.setFaultSource("Depolama / İstif kaynaklı ezilme/hasar");
                rcDto.setDetectionDetail("Tüm üretim hattı sensörleri nominal aralıkta. Hasar profili kademeli dış darbe yüküyle uyumlu.");
                rcDto.setConfidenceRate(new BigDecimal("88.00"));
                rcDto.setProductionImpactPct(0);
                rcDto.setLogisticImpactPct(100);
                rcDto.setRecommendedAction("Depo istifleme düzenini ve forklift operasyonu kayıtlarını gözden geçirin.");
            } else {
                // ÜRETİM HATTINDA SAPMA VARSA -> ÜRETİM KAYNAKLI
                rcDto.setEquipment("ÜRETİM HATTI HATA NOKTASI");
                rcDto.setFaultSource("Sensör limit aşımı ve proses tolerans sapması");
                rcDto.setDetectionDetail("Üretim aşamalarındaki sensörlerde tolerans sınırları dışında sapma tespit edildi.");
                rcDto.setConfidenceRate(new BigDecimal("92.50"));
                rcDto.setProductionImpactPct(90);
                rcDto.setLogisticImpactPct(10);
                rcDto.setRecommendedAction("İlgili üretim hattı ekipmanlarını ve sensör kalibrasyonlarını denetleyin.");
            }
        }
        response.setRootCause(rcDto);

        // 6. Sensör Özet Kartları
        List<AnalysisResponseDto.SensorSummaryDto> summaries = latestReadingsMap.values().stream().map(r -> {
            AnalysisResponseDto.SensorSummaryDto summary = new AnalysisResponseDto.SensorSummaryDto();
            summary.setSensorKey(r.getSensorKey());
            summary.setStageName(r.getStageName());
            summary.setLastActualValue(r.getActualValue());
            summary.setTargetValue(r.getTargetValue());
            summary.setMinLimit(r.getMinLimit());
            summary.setMaxLimit(r.getMaxLimit());

            boolean isAnomali = (r.getMinLimit() != null && r.getActualValue().compareTo(r.getMinLimit()) < 0) ||
                    (r.getMaxLimit() != null && r.getActualValue().compareTo(r.getMaxLimit()) > 0);
            summary.setStatus(isAnomali ? "ANOMALI" : "OK");

            if (r.getTargetValue() != null && r.getTargetValue().compareTo(BigDecimal.ZERO) != 0) {
                BigDecimal diff = r.getActualValue().subtract(r.getTargetValue());
                BigDecimal deviation = diff.divide(r.getTargetValue(), 4, RoundingMode.HALF_UP).multiply(new BigDecimal(100));
                summary.setPercentageDeviation(deviation.setScale(1, RoundingMode.HALF_UP));
            }
            return summary;
        }).collect(Collectors.toList());

        response.setSensorSummaries(summaries);

        return response;
    }
}