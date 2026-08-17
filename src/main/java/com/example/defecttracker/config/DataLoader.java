package com.example.defecttracker.config;

import com.example.defecttracker.entity.Coil;
import com.example.defecttracker.entity.DamageTicket;
import com.example.defecttracker.entity.Defect;
import com.example.defecttracker.entity.ProcessStage;
import com.example.defecttracker.entity.QualityGradeRecord;
import com.example.defecttracker.entity.RootCauseResult;
import com.example.defecttracker.entity.SensorReading;
import com.example.defecttracker.entity.User;
import com.example.defecttracker.repository.CoilRepository;
import com.example.defecttracker.repository.DamageTicketRepository;
import com.example.defecttracker.repository.DefectRepository;
import com.example.defecttracker.repository.ProcessStageRepository;
import com.example.defecttracker.repository.QualityGradeRecordRepository;
import com.example.defecttracker.repository.RootCauseResultRepository;
import com.example.defecttracker.repository.SensorReadingRepository;
import com.example.defecttracker.repository.UserRepository;
import com.example.defecttracker.service.AuthService;
import com.example.defecttracker.service.FieldCaseService;
import com.example.defecttracker.service.QualityGradingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataLoader implements CommandLineRunner {

    private final CoilRepository coilRepository;
    private final DefectRepository defectRepository;
    private final ProcessStageRepository processStageRepository;
    private final RootCauseResultRepository rootCauseResultRepository;
    private final SensorReadingRepository sensorReadingRepository;
    private final UserRepository userRepository;
    private final DamageTicketRepository ticketRepository;
    private final QualityGradeRecordRepository gradeRecordRepository;
    private final AuthService authService;
    private final FieldCaseService fieldCaseService;

    @Value("${app.seed.reset:true}")
    private boolean seedReset;

    @Override
    @Transactional
    public void run(String... args) {
        seedUsers();

        if (seedReset) {
            log.info("Demo veritabanı sıfırlanıyor ve yeniden oluşturuluyor...");
            clearDemoData();
            seedDemoDataset();
            log.info("Demo veri seti yüklendi.");
        } else if (coilRepository.count() == 0) {
            seedDemoDataset();
        }

        fieldCaseService.backfillPreShipmentGradesForAllFieldCases();
        refreshLegacyInspectorNames();
    }

    /** Eski demo kayıtlarındaki genel unvanları kişi adlarıyla günceller */
    private void refreshLegacyInspectorNames() {
        Map<String, String> byCoil = Map.of(
                "BOBIN-2026-9070", "Kalite Uzmanı Ceyda Ankara",
                "BOBIN-2026-9050", "Kalite Uzmanı Ayşe Korkmaz",
                "BOBIN-2026-9060", "Kalite Uzmanı Ayşe Korkmaz",
                "BOBIN-2026-9080", "Kalite Müdürü Mehmet Yılmaz",
                "BOBIN-2026-9090", "Kalite Uzmanı Ceyda Ankara"
        );
        byCoil.forEach((coilId, inspector) ->
                gradeRecordRepository.findTopByCoilIdIgnoreCaseOrderByCreatedAtDesc(coilId)
                        .ifPresent(record -> {
                            record.setInspectorName(inspector);
                            gradeRecordRepository.save(record);
                        }));
        gradeRecordRepository.findAll().stream()
                .filter(r -> "Kalite Kontrol Uzmanı".equals(r.getInspectorName()))
                .forEach(r -> {
                    r.setInspectorName("Kalite Uzmanı Ayşe Korkmaz");
                    gradeRecordRepository.save(r);
                });
    }

    private void clearDemoData() {
        gradeRecordRepository.deleteAllInBatch();
        ticketRepository.deleteAllInBatch();
        sensorReadingRepository.deleteAllInBatch();
        rootCauseResultRepository.deleteAllInBatch();
        processStageRepository.deleteAllInBatch();
        defectRepository.deleteAllInBatch();
        coilRepository.deleteAllInBatch();
    }

    private void seedDemoDataset() {
        seedCoil9041();
        seedCoil9042();
        seedCoil9043();
        seedCoil9044();
        seedCoil9050();
        seedCoil9060();
        seedCoil9070();
        seedCoil9080();
        seedCoil9090();
        seedShippedCoilQualityGrades();
        seedInternalTickets();
        seedFieldCases();
        seedQualityDecisions();
    }

    private void seedUsers() {
        upsertUser("admin", "admin123", "Mehmet Yılmaz", "Kalite Müdürü", "ADMIN");
        upsertUser("ceyda", "ceyda123", "Ceyda Ankara", "Kalite Uzmanı", "QUALITY");
        upsertUser("kalite", "kalite123", "Ayşe Korkmaz", "Kalite Uzmanı", "QUALITY");
        upsertUser("bakim", "bakim123", "Ali Demir", "Bakım Operatörü", "MAINTENANCE");
        upsertUser("satis", "satis123", "Deniz Arslan", "Satış Temsilcisi", "SALES");
    }

    private void upsertUser(String username, String password, String fullName, String jobTitle, String role) {
        User user = userRepository.findByUsername(username).orElseGet(User::new);
        user.setUsername(username);
        user.setPasswordHash(authService.hashPassword(password));
        user.setFullName(fullName);
        user.setJobTitle(jobTitle);
        user.setRole(role);
        user.setActive(true);
        userRepository.save(user);
    }

    // ── Bobinler (üretim anomalileri) ─────────────────────────────────────

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

    // ── Bobinler (lojistik profili) ───────────────────────────────────────

    private void seedCoil9050() {
        seedCoil("BOBIN-2026-9050", "HX380LAD", "DEF_IMPACT",
                new String[]{"OK", "OK", "OK", "OK"},
                "—", "Mekanik darbe — Lojistik / Taşıma kaynaklı",
                "Tüm üretim sensörleri nominal. Hasar dış etken profiline uyuyor.",
                88.0, 8, 92, "Sevkiyat ve depolama kayıtlarını inceleyin.",
                this::nominal16);
    }

    private void seedCoil9060() {
        seedCoil("BOBIN-2026-9060", "DX51D", "DEF_SCRATCH",
                new String[]{"OK", "OK", "OK", "OK"},
                "—", "Yüzey çiziği — Taşıma / istifleme kaynaklı",
                "Üretim sensörleri nominal aralıkta. Hasar lojistik profiline uyuyor.",
                87.5, 10, 88, "Sevkiyat ambalajı ve istifleme prosedürünü gözden geçirin.",
                this::nominal16);
    }

    private void seedCoil9070() {
        seedCoil("BOBIN-2026-9070", "S420MC", "DEF_CRACK",
                new String[]{"OK", "ANOMALI", "OK", "OK"},
                "HOT_MILL_STAND_02", "Sıcak hadde merdane ısı dengesizliği",
                "Şerit sıcaklığı 918 °C hedefine karşı 872.3 °C ölçüldü (%5.0 sapma) — çatlak riski.",
                93.8, 93, 5, "Merdane soğutma devresini kontrol edin, bobini hurdaya ayırın.",
                readings -> {
                    List<SensorReading> list = nominal16(readings);
                    overrideStage(list, readings, "Sıcak Haddehane", List.of(
                            s(readings, "Sıcak Haddehane", "Descaler Basıncı", 179.20, 180.00, 153.00, 207.00),
                            s(readings, "Sıcak Haddehane", "Şerit Sıcaklığı", 872.30, 918.00, 826.20, 1009.80),
                            s(readings, "Sıcak Haddehane", "Merdane Kuvveti", 28.95, 27.86, 22.29, 33.43),
                            s(readings, "Sıcak Haddehane", "Haddehane Hızı", 11.80, 12.61, 10.72, 14.50)
                    ));
                    return list;
                });
    }

    /** Fabrikada kaçırılmış üretim kusuru — sevk edilmiş, yalnızca saha dosyasında. */
    private void seedCoil9080() {
        seedCoil("BOBIN-2026-9080", "S355MC", "DEF_EDGE",
                new String[]{"OK", "ANOMALI", "OK", "OK"},
                "DESCALER_NOZZLE_02", "Nozul tıkanıklığı — fabrika KK sırasında atlanmış",
                "Descaler basıncı 180 Bar hedefine karşı 141.0 Bar ölçüldü (%21.7 sapma). Sevkiyat öncesi tespit edilmemiş.",
                85.0, 90, 7, "Müşteri şikâyeti sonrası geriye dönük CAPA açın.",
                readings -> {
                    List<SensorReading> list = nominal16(readings);
                    overrideStage(list, readings, "Sıcak Haddehane", List.of(
                            s(readings, "Sıcak Haddehane", "Descaler Basıncı", 141.00, 180.00, 153.00, 207.00),
                            s(readings, "Sıcak Haddehane", "Şerit Sıcaklığı", 914.80, 918.00, 826.20, 1009.80),
                            s(readings, "Sıcak Haddehane", "Merdane Kuvveti", 27.55, 27.86, 22.29, 33.43),
                            s(readings, "Sıcak Haddehane", "Haddehane Hızı", 12.58, 12.61, 10.72, 14.50)
                    ));
                    return list;
                });
    }

    /** Üretim temiz — müşteri sahası / istifleme şikâyeti. */
    private void seedCoil9090() {
        seedCoil("BOBIN-2026-9090", "DX51D", "DEF_SCRATCH",
                new String[]{"OK", "OK", "OK", "OK"},
                "—", "Müşteri depolama / istifleme — fabrika ve lojistik profili temiz",
                "Tüm üretim sensörleri nominal. Hasar müşteri sahası kullanım koşullarına uyuyor.",
                82.0, 8, 12, "Garanti kapsamı dışı değerlendirin; teknik rapor sunun.",
                this::nominal16);
    }

    // ── Fabrika içi hasar talepleri (kalite kuyruğu — sevk edilmemiş bobinler) ──

    private void seedInternalTickets() {
        seedInternalTicket("TKT-2026-041", "BOBIN-2026-9041",
                "Ali Vural", "Bakım-Onarım", "Üretim Hattı",
                "Kenar Bozukluğu",
                "Sıcak hadde çıkışında kenar tufalı tespit edildi, descaler basıncı düşük görünüyor.",
                LocalDateTime.now().minusDays(3));

        seedInternalTicket("TKT-2026-042", "BOBIN-2026-9042",
                "Zeynep Arslan", "Kalite Kontrol", "Üretim Hattı",
                "Yüzey Çiziği",
                "Asitleme sonrası yüzeyde leke ve renk farkı — banyo sıcaklığı şüpheli.",
                LocalDateTime.now().minusDays(4));

        seedInternalTicket("TKT-2026-043", "BOBIN-2026-9043",
                "Can Öztürk", "Üretim Planlama", "Üretim Hattı",
                "Kalınlık Sapması",
                "Soğuk hadde tandem 3. stantta kalınlık sapması, hidrolik basınç alarmı yok.",
                LocalDateTime.now().minusDays(2));

        seedInternalTicket("TKT-2026-044", "BOBIN-2026-9044",
                "Emre Şahin", "Kalite Kontrol", "Üretim Hattı",
                "Kenar Bozukluğu",
                "Çelikhane sonrası gözenek benzeri yüzey kusuru — oksijen lans debisi yüksek. Sevkiyat durduruldu.",
                LocalDateTime.now().minusDays(6));

        seedInternalTicket("TKT-2026-070", "BOBIN-2026-9070",
                "Murat Güneş", "Kalite Kontrol", "Üretim Hattı",
                "Çatlak",
                "Sıcak hadde sonrası yüzey çatlağı — acil durdurma yapıldı, bobin karantinada.",
                LocalDateTime.now().minusDays(8));
    }

    // ── Müşteri / saha dosyaları (yalnızca sevk edilmiş bobinler) ─────────

    private void seedFieldCases() {
        seedFieldCase("TKT-FIELD-015", "BOBIN-2026-9050", "Tosyalı Holding",
                "Ahmet Yılmaz", "+90 262 555 0101",
                "Darbe İzi", FieldCaseService.STATUS_OPEN,
                null, null, null,
                "Fabrikadan birincil kalite sertifikasıyla sevk edildi. Taşıma sırasında kenar ezilmesi oluşmuş.",
                LocalDateTime.now().minusDays(2));

        seedFieldCase("TKT-FIELD-060", "BOBIN-2026-9060", "Çolakoğlu Metalurji",
                "Selin Demir", "+90 262 555 0303",
                "Yüzey Çiziği", FieldCaseService.STATUS_RESOLVED,
                FieldCaseService.ACTION_REPLACEMENT,
                "Müşteriye yeni bobin sevk edildi. Ambalaj prosedürü revize edildi.",
                null,
                "Sevk sonrası ambalaj açılışında yüzey çiziği — lojistik kaynaklı kabul edildi.",
                LocalDateTime.now().minusDays(12));

        seedFieldCase("TKT-FIELD-080", "BOBIN-2026-9080", "Atlas Metal Sanayi",
                "Mehmet Kaya", "+90 372 555 0202",
                "Kenar Bozukluğu", FieldCaseService.STATUS_IN_REVIEW,
                null, null, null,
                "Fabrika KK'dan geçip sevk edilmişti; müşteri depoda kenar tufalı fark etti. Geriye dönük üretim analizi isteniyor.",
                LocalDateTime.now().minusDays(5));

        seedFieldCase("TKT-FIELD-090", "BOBIN-2026-9090", "Kocaer Çelik",
                "Burak Aydın", "+90 216 555 0404",
                "İstif / Baskı Hasarı", FieldCaseService.STATUS_RESOLVED,
                FieldCaseService.ACTION_REJECT,
                "Sensör profili temiz; hasar müşteri istifleme kaynaklı — garanti dışı.",
                null,
                "Müşteri sahasında yanlış istifleme sonucu baskı hasarı bildirimi.",
                LocalDateTime.now().minusDays(9));
    }

    // ── Kalite kararları (yalnızca fabrika kuyruğu — sevk öncesi) ────────

    private void seedQualityDecisions() {
        seedQualityGrade("BOBIN-2026-9070", "TKT-2026-070",
                QualityGradingService.SCRAP, QualityGradingService.SCRAP,
                "Kalite Uzmanı Ceyda Ankara",
                "Sıcak hadde çatlak — sevkiyat öncesi hurda ayrıştırması onaylandı.",
                LocalDateTime.now().minusDays(7));
    }

    /** Müşteriye sevk edilmiş bobinler — sevk öncesi birincil kalite onayı (zorunlu). */
    private void seedShippedCoilQualityGrades() {
        seedQualityGrade("BOBIN-2026-9050", null,
                QualityGradingService.CUSTOMER, QualityGradingService.CUSTOMER,
                "Kalite Uzmanı Ayşe Korkmaz",
                "Sevk öncesi birincil kalite onayı — sertifika düzenlendi.",
                LocalDateTime.now().minusDays(18));
        seedQualityGrade("BOBIN-2026-9060", null,
                QualityGradingService.CUSTOMER, QualityGradingService.CUSTOMER,
                "Kalite Uzmanı Ayşe Korkmaz",
                "Sevk öncesi birincil kalite onayı.",
                LocalDateTime.now().minusDays(20));
        seedQualityGrade("BOBIN-2026-9080", null,
                QualityGradingService.CUSTOMER, QualityGradingService.CUSTOMER,
                "Kalite Müdürü Mehmet Yılmaz",
                "Sevk öncesi birinci kalite onayı — sonradan müşteri şikâyeti ile çelişiyor (KK kaçırıldı).",
                LocalDateTime.now().minusDays(22));
        seedQualityGrade("BOBIN-2026-9090", null,
                QualityGradingService.CUSTOMER, QualityGradingService.CUSTOMER,
                "Kalite Uzmanı Ceyda Ankara",
                "Sevk öncesi birincil kalite onayı.",
                LocalDateTime.now().minusDays(16));
    }

    // ── Yardımcı metotlar ─────────────────────────────────────────────────

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
        coil.setCreatedAt(LocalDateTime.now().minusDays(14));
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

    private void seedInternalTicket(String ticketNumber, String batchId, String reporter,
                                    String department, String location, String defectType,
                                    String notes, LocalDateTime createdAt) {
        DamageTicket ticket = DamageTicket.builder()
                .ticketNumber(ticketNumber)
                .reporterName(reporter)
                .department(department)
                .batchId(batchId)
                .detectedLocation(location)
                .defectType(defectType)
                .extraNotes(notes)
                .createdAt(createdAt)
                .build();
        ticketRepository.save(ticket);
    }

    private void seedFieldCase(String ticketNumber, String batchId, String customer,
                               String contact, String phone, String defectType, String caseStatus,
                               String commercialAction, String resolutionNotes, String capaReference,
                               String notes, LocalDateTime createdAt) {
        DamageTicket ticket = DamageTicket.builder()
                .ticketNumber(ticketNumber)
                .reporterName(contact)
                .department("Satış / Müşteri İlişkileri")
                .batchId(batchId)
                .detectedLocation(FieldCaseService.FIELD_LOCATION)
                .defectType(defectType)
                .extraNotes(notes)
                .customerCompany(customer)
                .contactPhone(phone)
                .caseStatus(caseStatus)
                .commercialAction(commercialAction)
                .resolutionNotes(resolutionNotes)
                .capaReference(capaReference)
                .createdAt(createdAt)
                .build();
        ticketRepository.save(ticket);
    }

    private void seedQualityGrade(String coilId, String ticketNumber, String recommended,
                                  String finalGrade, String inspector, String notes,
                                  LocalDateTime createdAt) {
        QualityGradeRecord record = new QualityGradeRecord();
        record.setCoilId(coilId);
        record.setTicketNumber(ticketNumber);
        record.setRecommendedGrade(recommended);
        record.setFinalGrade(finalGrade);
        record.setInspectorName(inspector);
        record.setNotes(notes);
        record.setCreatedAt(createdAt);
        gradeRecordRepository.save(record);
    }
}
