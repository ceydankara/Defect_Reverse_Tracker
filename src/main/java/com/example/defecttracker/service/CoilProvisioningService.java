package com.example.defecttracker.service;

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
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CoilProvisioningService {

    private final CoilRepository coilRepository;
    private final DefectRepository defectRepository;
    private final ProcessStageRepository processStageRepository;
    private final RootCauseResultRepository rootCauseResultRepository;
    private final SensorReadingRepository sensorReadingRepository;
    private final CoilIdResolver coilIdResolver;

    @Transactional
    public String ensureCoilForTicket(String batchId, String defectType) {
        if (batchId == null || batchId.isBlank()) {
            return batchId;
        }

        Optional<String> resolved = coilIdResolver.resolve(batchId);
        if (resolved.isPresent()) {
            return resolved.get();
        }

        String coilId = batchId.trim();
        if (coilRepository.existsById(coilId)) {
            return coilId;
        }

        String defectCode = mapDefectType(defectType);
        provisionLogisticsCoil(coilId, defectCode);
        return coilId;
    }

    private void provisionLogisticsCoil(String coilId, String defectCode) {
        Coil coil = new Coil();
        coil.setCoilId(coilId);
        coil.setSteelGrade("DX51D");
        coil.setCreatedAt(LocalDateTime.now());
        coilRepository.save(coil);

        Defect defect = new Defect();
        defect.setCoilId(coilId);
        defect.setDefectCode(defectCode);
        defect.setStatus("COMPLETED");
        defectRepository.save(defect);

        String[] stages = {"Çelikhane", "Sıcak Haddehane", "Asitleme", "Soğuk Haddehane"};
        for (int i = 0; i < stages.length; i++) {
            ProcessStage stage = new ProcessStage();
            stage.setCoilId(coilId);
            stage.setStageName(stages[i]);
            stage.setStageOrder(i + 1);
            stage.setStatus("OK");
            stage.setSensorCount(4);
            processStageRepository.save(stage);
        }

        RootCauseResult rc = new RootCauseResult();
        rc.setCoilId(coilId);
        rc.setEquipment("DEPO / SEVKİYAT");
        rc.setFaultSource("Lojistik / taşıma kaynaklı mekanik hasar");
        rc.setDetectionDetail("Tüm üretim sensörleri nominal. Hasar dış etken profiline uyuyor.");
        rc.setConfidenceRate(BigDecimal.valueOf(85.0));
        rc.setProductionImpactPct(10);
        rc.setLogisticImpactPct(90);
        rc.setRecommendedAction("Sevkiyat ve depolama kayıtlarını inceleyin.");
        rootCauseResultRepository.save(rc);

        sensorReadingRepository.saveAll(buildNominalSensors(coilId));
    }

    private List<SensorReading> buildNominalSensors(String coilId) {
        List<SensorReading> list = new ArrayList<>();
        list.add(sensor(coilId, "Çelikhane", "Fırın Sıcaklığı", 1150, 1150, 1035, 1265));
        list.add(sensor(coilId, "Çelikhane", "Oksijen Üfleme Debisi", 3200, 3200, 2720, 3680));
        list.add(sensor(coilId, "Çelikhane", "Ergitme Akımı", 48, 48, 42.2, 53.8));
        list.add(sensor(coilId, "Çelikhane", "Cüruf Bazikliği", 2.8, 2.8, 2.3, 3.3));
        list.add(sensor(coilId, "Sıcak Haddehane", "Descaler Basıncı", 180, 180, 153, 207));
        list.add(sensor(coilId, "Sıcak Haddehane", "Şerit Sıcaklığı", 918, 918, 826.2, 1009.8));
        list.add(sensor(coilId, "Sıcak Haddehane", "Merdane Kuvveti", 27.86, 27.86, 22.29, 33.43));
        list.add(sensor(coilId, "Sıcak Haddehane", "Haddehane Hızı", 12.61, 12.61, 10.72, 14.5));
        list.add(sensor(coilId, "Asitleme", "Asit Konsantrasyonu", 160, 160, 131.2, 188.8));
        list.add(sensor(coilId, "Asitleme", "Banyo Sıcaklığı", 72, 72, 62.6, 81.4));
        list.add(sensor(coilId, "Asitleme", "Soğutma Debisi", 420, 420, 357, 483));
        list.add(sensor(coilId, "Asitleme", "Şerit Geçiş Hızı", 95, 95, 77.9, 112.1));
        list.add(sensor(coilId, "Soğuk Haddehane", "Merdane Kuvveti", 9, 9, 7.2, 10.8));
        list.add(sensor(coilId, "Soğuk Haddehane", "Şerit Gerginliği", 14, 14, 11.5, 16.5));
        list.add(sensor(coilId, "Soğuk Haddehane", "Rulman Sıcaklığı", 55, 55, 47.9, 62.1));
        list.add(sensor(coilId, "Soğuk Haddehane", "Emülsiyon Debisi", 280, 280, 229.6, 330.4));
        return list;
    }

    private SensorReading sensor(String coilId, String stage, String key,
                                 double actual, double target, double min, double max) {
        SensorReading r = new SensorReading();
        r.setCoilId(coilId);
        r.setStageName(stage);
        r.setSensorKey(key);
        r.setTimeSecond(180);
        r.setActualValue(BigDecimal.valueOf(actual));
        r.setTargetValue(BigDecimal.valueOf(target));
        r.setMinLimit(BigDecimal.valueOf(min));
        r.setMaxLimit(BigDecimal.valueOf(max));
        return r;
    }

    private String mapDefectType(String defectType) {
        if (defectType == null || defectType.isBlank()) {
            return "DEF_UNKNOWN";
        }
        return switch (defectType) {
            case "Kenar Bozukluğu" -> "DEF_EDGE";
            case "Kalınlık Sapması" -> "DEF_THICKNESS";
            case "Darbe İzi" -> "DEF_IMPACT";
            case "Yüzey Çiziği" -> "DEF_SCRATCH";
            case "İstif / Baskı Hasarı" -> "DEF_IMPACT";
            case "Tufal / Pullanma" -> "DEF_EDGE";
            case "Çatlak" -> "DEF_CRACK";
            default -> "DEF_" + defectType.toUpperCase().replace(' ', '_').replace('/', '_');
        };
    }
}
