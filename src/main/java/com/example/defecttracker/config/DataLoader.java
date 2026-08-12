package com.example.defecttracker.config;

import com.example.defecttracker.entity.Coil;
import com.example.defecttracker.entity.Defect;
import com.example.defecttracker.entity.ProcessStage;
import com.example.defecttracker.entity.RootCauseResult;
import com.example.defecttracker.entity.SensorReading;
import com.example.defecttracker.entity.User;
import com.example.defecttracker.repository.CoilRepository;
import com.example.defecttracker.repository.DefectRepository;
import com.example.defecttracker.repository.ProcessStageRepository;
import com.example.defecttracker.repository.RootCauseResultRepository;
import com.example.defecttracker.repository.SensorReadingRepository;
import com.example.defecttracker.repository.UserRepository;
import com.example.defecttracker.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

@Component
@RequiredArgsConstructor
public class DataLoader implements CommandLineRunner {

    private final CoilRepository coilRepository;
    private final DefectRepository defectRepository;
    private final ProcessStageRepository processStageRepository;
    private final RootCauseResultRepository rootCauseResultRepository;
    private final SensorReadingRepository sensorReadingRepository;
    private final UserRepository userRepository;
    private final AuthService authService;

    @Override
    public void run(String... args) {
        seedUsers();
        if (coilRepository.count() > 0) {
            return;
        }
        seedCoil9041();
        seedCoil9050();
        seedCoil9042();
        seedCoil9043();
        seedCoil9044();
    }

    private void seedUsers() {
        upsertUser("admin", "admin123", "Sistem Yöneticisi", "ADMIN");
        upsertUser("kalite", "kalite123", "Kalite Kontrol Uzmanı", "QUALITY");
        upsertUser("bakim", "bakim123", "Bakım Operatörü", "MAINTENANCE");
    }

    private void upsertUser(String username, String password, String fullName, String role) {
        User user = userRepository.findByUsername(username).orElseGet(User::new);
        user.setUsername(username);
        user.setPasswordHash(authService.hashPassword(password));
        user.setFullName(fullName);
        user.setRole(role);
        user.setActive(true);
        userRepository.save(user);
    }

    private void saveUser(String username, String password, String fullName, String role) {
        upsertUser(username, password, fullName, role);
    }

    private void seedCoil9041() {
        seedCoil("BOBIN-2026-9041", "S355MC", "DEF_EDGE",
                new String[]{"OK", "ANOMALI", "OK", "OK"},
                "DESCALER_NOZZLE_02", "Nozul tıkanıklığı veya valf sızıntısı",
                "Descaler basıncı 180 Bar hedefine karşı 142.5 Bar ölçüldü (%20.8 sapma).",
                86.4, 91, 6, "Bakım ekibini hatta yönlendirin ve CAPA formu açın.",
                readings -> {
                    List<SensorReading> list = nominal16(readings);
                    overrideStage(list, readings, "Sıcak Haddehane", List.of(
                            s(readings, "Sıcak Haddehane", "Descaler Basıncı", 142.50, 180.00, 153.00, 207.00),
                            s(readings, "Sıcak Haddehane", "Şerit Sıcaklığı", 916.40, 918.00, 826.20, 1009.80),
                            s(readings, "Sıcak Haddehane", "Merdane Kuvveti", 27.72, 27.86, 22.29, 33.43),
                            s(readings, "Sıcak Haddehane", "Haddehane Hızı", 12.62, 12.61, 10.72, 14.50)
                    ));
                    return list;
                });
    }

    private void seedCoil9050() {
        seedCoil("BOBIN-2026-9050", "HX380LAD", "DEF_IMPACT",
                new String[]{"OK", "OK", "OK", "OK"},
                "—", "Mekanik darbe — Lojistik / Taşıma kaynaklı",
                "Tüm üretim sensörleri nominal. Hasar dış etken profiline uyuyor.",
                88.0, 8, 92, "Sevkiyat ve depolama kayıtlarını inceleyin.",
                readings -> nominal16(readings));
    }

    private void seedCoil9042() {
        seedCoil("BOBIN-2026-9042", "S235JR", "DEF_ACID_STAIN",
                new String[]{"OK", "OK", "ANOMALI", "OK"},
                "PICKLING_TANK_02", "Banyo sıcaklığı düşüklüğü ve asit konsantrasyon sapması",
                "Banyo sıcaklığı 72 °C hedefine karşı 58.2 °C ölçüldü (%19.1 sapma).",
                92.1, 95, 3, "Asitleme tankı ısıtıcı eşanjörünü kontrol edin.",
                readings -> {
                    List<SensorReading> list = nominal16(readings);
                    overrideStage(list, readings, "Asitleme", List.of(
                            s(readings, "Asitleme", "Asit Konsantrasyonu", 125.10, 160.00, 131.20, 188.80),
                            s(readings, "Asitleme", "Banyo Sıcaklığı", 58.20, 72.00, 62.60, 81.40),
                            s(readings, "Asitleme", "Soğutma Debisi", 418.00, 420.00, 357.00, 483.00),
                            s(readings, "Asitleme", "Şerit Geçiş Hızı", 94.80, 95.00, 77.90, 112.10)
                    ));
                    return list;
                });
    }

    private void seedCoil9043() {
        seedCoil("BOBIN-2026-9043", "DC01", "DEF_THICKNESS",
                new String[]{"OK", "OK", "OK", "ANOMALI"},
                "TANDEM_ROLL_STAND_03", "Merdane hidrolik baskı silindirinde aşırı kuvvet kaybı",
                "Merdane kuvveti 9.0 kN hedefine karşı 12.45 kN ölçüldü (%38.3 sapma).",
                89.7, 88, 8, "Tandem 3. stant hidrolik sistemini denetleyin.",
                readings -> {
                    List<SensorReading> list = nominal16(readings);
                    overrideStage(list, readings, "Soğuk Haddehane", List.of(
                            s(readings, "Soğuk Haddehane", "Merdane Kuvveti", 12.45, 9.00, 7.20, 10.80),
                            s(readings, "Soğuk Haddehane", "Şerit Gerginliği", 10.20, 14.00, 11.50, 16.50),
                            s(readings, "Soğuk Haddehane", "Rulman Sıcaklığı", 64.10, 55.00, 47.90, 62.10),
                            s(readings, "Soğuk Haddehane", "Emülsiyon Debisi", 278.50, 280.00, 229.60, 330.40)
                    ));
                    return list;
                });
    }

    private void seedCoil9044() {
        seedCoil("BOBIN-2026-9044", "DX54D", "DEF_POROSITY",
                new String[]{"ANOMALI", "OK", "OK", "OK"},
                "OXYGEN_LANCE_01", "Oksijen üfleme lansında aşırı akış",
                "Oksijen debisi 3200 Nm³/h hedefine karşı 3810.5 Nm³/h ölçüldü (%19.0 sapma).",
                94.5, 96, 2, "Oksijen lans debi kontrol vanasını temizleyin.",
                readings -> {
                    List<SensorReading> list = nominal16(readings);
                    overrideStage(list, readings, "Çelikhane", List.of(
                            s(readings, "Çelikhane", "Fırın Sıcaklığı", 1148.00, 1150.00, 1035.00, 1265.00),
                            s(readings, "Çelikhane", "Oksijen Üfleme Debisi", 3810.50, 3200.00, 2720.00, 3680.00),
                            s(readings, "Çelikhane", "Ergitme Akımı", 48.05, 48.00, 42.20, 53.80),
                            s(readings, "Çelikhane", "Cüruf Bazikliği", 2.15, 2.80, 2.30, 3.30)
                    ));
                    return list;
                });
    }

    private void seedCoil(
            String coilId,
            String grade,
            String defectCode,
            String[] stageStatuses,
            String equipment,
            String fault,
            String detail,
            double confidence,
            int prod,
            int log,
            String action,
            Function<String, List<SensorReading>> sensorFactory) {

        saveCoil(coilId, grade);
        saveDefect(coilId, defectCode);
        saveStages(coilId, stageStatuses);
        saveRootCause(coilId, equipment, fault, detail, confidence, prod, log, action);
        sensorReadingRepository.saveAll(sensorFactory.apply(coilId));
    }

    private List<SensorReading> nominal16(String coilId) {
        List<SensorReading> list = new ArrayList<>();
        list.add(s(coilId, "Çelikhane", "Fırın Sıcaklığı", 1150.00, 1150.00, 1035.00, 1265.00));
        list.add(s(coilId, "Çelikhane", "Oksijen Üfleme Debisi", 3200.00, 3200.00, 2720.00, 3680.00));
        list.add(s(coilId, "Çelikhane", "Ergitme Akımı", 48.00, 48.00, 42.20, 53.80));
        list.add(s(coilId, "Çelikhane", "Cüruf Bazikliği", 2.80, 2.80, 2.30, 3.30));
        list.add(s(coilId, "Sıcak Haddehane", "Descaler Basıncı", 180.00, 180.00, 153.00, 207.00));
        list.add(s(coilId, "Sıcak Haddehane", "Şerit Sıcaklığı", 918.00, 918.00, 826.20, 1009.80));
        list.add(s(coilId, "Sıcak Haddehane", "Merdane Kuvveti", 27.86, 27.86, 22.29, 33.43));
        list.add(s(coilId, "Sıcak Haddehane", "Haddehane Hızı", 12.61, 12.61, 10.72, 14.50));
        list.add(s(coilId, "Asitleme", "Asit Konsantrasyonu", 160.00, 160.00, 131.20, 188.80));
        list.add(s(coilId, "Asitleme", "Banyo Sıcaklığı", 72.00, 72.00, 62.60, 81.40));
        list.add(s(coilId, "Asitleme", "Soğutma Debisi", 420.00, 420.00, 357.00, 483.00));
        list.add(s(coilId, "Asitleme", "Şerit Geçiş Hızı", 95.00, 95.00, 77.90, 112.10));
        list.add(s(coilId, "Soğuk Haddehane", "Merdane Kuvveti", 9.00, 9.00, 7.20, 10.80));
        list.add(s(coilId, "Soğuk Haddehane", "Şerit Gerginliği", 14.00, 14.00, 11.50, 16.50));
        list.add(s(coilId, "Soğuk Haddehane", "Rulman Sıcaklığı", 55.00, 55.00, 47.90, 62.10));
        list.add(s(coilId, "Soğuk Haddehane", "Emülsiyon Debisi", 280.00, 280.00, 229.60, 330.40));
        return list;
    }

    private void overrideStage(List<SensorReading> list, String coilId, String stage, List<SensorReading> replacements) {
        list.removeIf(r -> stage.equals(r.getStageName()));
        list.addAll(replacements);
    }

    private void saveCoil(String coilId, String grade) {
        Coil coil = new Coil();
        coil.setCoilId(coilId);
        coil.setSteelGrade(grade);
        coil.setCreatedAt(LocalDateTime.now());
        coilRepository.save(coil);
    }

    private void saveDefect(String coilId, String code) {
        Defect defect = new Defect();
        defect.setCoilId(coilId);
        defect.setDefectCode(code);
        defect.setStatus("COMPLETED");
        defectRepository.save(defect);
    }

    private void saveStages(String coilId, String[] statuses) {
        String[] names = {"Çelikhane", "Sıcak Haddehane", "Asitleme", "Soğuk Haddehane"};
        for (int i = 0; i < names.length; i++) {
            ProcessStage stage = new ProcessStage();
            stage.setCoilId(coilId);
            stage.setStageName(names[i]);
            stage.setStageOrder(i + 1);
            stage.setStatus(statuses[i]);
            stage.setSensorCount(4);
            processStageRepository.save(stage);
        }
    }

    private void saveRootCause(String coilId, String equipment, String fault, String detail,
                               double confidence, int prod, int log, String action) {
        RootCauseResult rc = new RootCauseResult();
        rc.setCoilId(coilId);
        rc.setEquipment(equipment);
        rc.setFaultSource(fault);
        rc.setDetectionDetail(detail);
        rc.setConfidenceRate(BigDecimal.valueOf(confidence));
        rc.setProductionImpactPct(prod);
        rc.setLogisticImpactPct(log);
        rc.setRecommendedAction(action);
        rootCauseResultRepository.save(rc);
    }

    private SensorReading s(String coilId, String stage, String key,
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
}
