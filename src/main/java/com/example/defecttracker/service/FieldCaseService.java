package com.example.defecttracker.service;

import com.example.defecttracker.dto.AnalysisResponseDto;
import com.example.defecttracker.dto.FieldCaseDetailDto;
import com.example.defecttracker.dto.FieldCaseItemDto;
import com.example.defecttracker.dto.FieldCaseResolutionRequestDto;
import com.example.defecttracker.dto.RemediationOptionDto;
import com.example.defecttracker.dto.RemediationPlanDto;
import com.example.defecttracker.dto.ResponsibilityAnalysisDto;
import com.example.defecttracker.entity.DamageTicket;
import com.example.defecttracker.entity.QualityGradeRecord;
import com.example.defecttracker.repository.DamageTicketRepository;
import com.example.defecttracker.repository.QualityGradeRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class FieldCaseService {

    public static final String FIELD_LOCATION = "Müşteri / Saha";
    public static final String STATUS_OPEN = "OPEN";
    public static final String STATUS_IN_REVIEW = "IN_REVIEW";
    public static final String STATUS_RESOLVED = "RESOLVED";

    public static final String ACTION_CREDIT = "CREDIT";
    public static final String ACTION_REPLACEMENT = "REPLACEMENT";
    public static final String ACTION_DISCOUNT = "DISCOUNT";
    public static final String ACTION_REJECT = "REJECT_CLAIM";
    public static final String ACTION_CAPA = "CAPA";

    public static final String SOURCE_PRODUCTION = "PRODUCTION";
    public static final String SOURCE_LOGISTICS = "LOGISTICS";
    public static final String SOURCE_CUSTOMER = "CUSTOMER";

    private static final Map<String, String> STATUS_LABELS = Map.of(
            STATUS_OPEN, "Yeni Bildirim",
            STATUS_IN_REVIEW, "İnceleniyor",
            STATUS_RESOLVED, "Sonuçlandı"
    );

    private static final Map<String, String> GRADE_LABELS = Map.of(
            QualityGradingService.CUSTOMER, "Müşteri Sevkiyatı (Birincil)",
            QualityGradingService.SECOND_QUALITY, "İkinci Kalite",
            QualityGradingService.SCRAP, "Hurda"
    );

    private static final Map<String, String> ACTION_LABELS = Map.of(
            ACTION_CREDIT, "Kredi Notu",
            ACTION_REPLACEMENT, "Yeni Bobin Sevkiyatı",
            ACTION_DISCOUNT, "İskontolu Kabul",
            ACTION_REJECT, "Talebi Reddet",
            ACTION_CAPA, "İç CAPA Kaydı"
    );

    private final DamageTicketRepository ticketRepository;
    private final AnalysisService analysisService;
    private final CoilProvisioningService coilProvisioningService;
    private final CoilHistoryService coilHistoryService;
    private final QualityGradeRecordRepository gradeRecordRepository;
    private final CoilIdResolver coilIdResolver;

    @Transactional
    public List<FieldCaseItemDto> listCases(String status) {
        String normalized = status == null ? "all" : status.trim().toLowerCase(Locale.ROOT);
        return ticketRepository.findByDetectedLocationOrderByCreatedAtDesc(FIELD_LOCATION).stream()
                .map(this::toItemDto)
                .filter(item -> matchesStatus(item, normalized))
                .sorted(Comparator.comparing(FieldCaseItemDto::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    @Transactional
    public Optional<FieldCaseDetailDto> getDetail(String ticketNumber) {
        return ticketRepository.findByTicketNumber(ticketNumber)
                .filter(t -> FIELD_LOCATION.equals(t.getDetectedLocation()))
                .map(this::buildDetail);
    }

    @Transactional
    public Optional<FieldCaseItemDto> updateStatus(String ticketNumber, String caseStatus) {
        if (!STATUS_LABELS.containsKey(caseStatus)) {
            return Optional.empty();
        }
        return ticketRepository.findByTicketNumber(ticketNumber)
                .filter(t -> FIELD_LOCATION.equals(t.getDetectedLocation()))
                .map(ticket -> {
                    ticket.setCaseStatus(caseStatus);
                    return toItemDto(ticketRepository.save(ticket));
                });
    }

    @Transactional
    public Optional<FieldCaseDetailDto> applyResolution(String ticketNumber, FieldCaseResolutionRequestDto request) {
        if (request.getCommercialAction() == null || !ACTION_LABELS.containsKey(request.getCommercialAction())) {
            return Optional.empty();
        }
        return ticketRepository.findByTicketNumber(ticketNumber)
                .filter(t -> FIELD_LOCATION.equals(t.getDetectedLocation()))
                .map(ticket -> {
                    ticket.setCommercialAction(request.getCommercialAction());
                    if (request.getResolutionNotes() != null) {
                        ticket.setResolutionNotes(request.getResolutionNotes());
                    }
                    if (ACTION_CAPA.equals(request.getCommercialAction())) {
                        ticket.setCapaReference(resolveCapaReference(ticket, request.getCapaReference()));
                    } else if (request.getCapaReference() != null && !request.getCapaReference().isBlank()) {
                        ticket.setCapaReference(request.getCapaReference().trim());
                    }
                    if (Boolean.TRUE.equals(request.getMarkResolved())) {
                        ticket.setCaseStatus(STATUS_RESOLVED);
                    } else if (!STATUS_RESOLVED.equals(ticket.getCaseStatus())) {
                        ticket.setCaseStatus(STATUS_IN_REVIEW);
                    }
                    ticketRepository.save(ticket);
                    return buildDetail(ticket);
                });
    }

    @Transactional
    public void initializeFieldCase(DamageTicket ticket) {
        if (FIELD_LOCATION.equals(ticket.getDetectedLocation()) && ticket.getCaseStatus() == null) {
            ticket.setCaseStatus(STATUS_OPEN);
        }
        if (isFieldCase(ticket)) {
            ensurePreShipmentCustomerGrade(ticket.getBatchId());
        }
    }

    @Transactional
    public void backfillPreShipmentGradesForAllFieldCases() {
        ticketRepository.findByDetectedLocationOrderByCreatedAtDesc(FIELD_LOCATION).stream()
                .map(DamageTicket::getBatchId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .forEach(this::ensurePreShipmentCustomerGrade);
    }

    public static boolean isFieldCase(DamageTicket ticket) {
        return ticket != null && FIELD_LOCATION.equals(ticket.getDetectedLocation());
    }

    private FieldCaseDetailDto buildDetail(DamageTicket ticket) {
        String resolvedCoilId = coilProvisioningService.ensureCoilForTicket(
                ticket.getBatchId(), ticket.getDefectType());
        AnalysisResponseDto analysis = analysisService.getAnalysisByCoilId(resolvedCoilId);

        Optional<QualityGradeRecord> priorGrade = resolvePriorQualityGrade(resolvedCoilId, ticket.getBatchId());

        var history = coilHistoryService.getHistory(ticket.getBatchId());
        List<DamageTicket> related = ticketRepository.findByBatchIdIgnoreCaseOrderByCreatedAtDesc(ticket.getBatchId());

        return FieldCaseDetailDto.builder()
                .ticket(toItemDto(ticket))
                .analysis(analysis)
                .analysisHeadline(analysis != null ? analysis.getHeadline() : null)
                .responsibility(computeResponsibility(analysis, ticket, priorGrade, history.getTotalReports()))
                .priorQualityDecision(priorGrade.map(g -> GRADE_LABELS.getOrDefault(g.getFinalGrade(), g.getFinalGrade()))
                        .orElse(GRADE_LABELS.get(QualityGradingService.CUSTOMER)))
                .coilHistorySummary(history.getSummaryMessage())
                .priorReportCount(history.getTotalReports())
                .relatedTicketNumbers(related.stream().map(DamageTicket::getTicketNumber).toList())
                .build();
    }

    private ResponsibilityAnalysisDto computeResponsibility(
            AnalysisResponseDto analysis,
            DamageTicket ticket,
            Optional<QualityGradeRecord> priorGrade,
            int priorReportCount) {

        boolean production = analysis != null && "PRODUCTION".equals(analysis.getClassificationType());
        int prodBase = analysis != null && analysis.getRootCause() != null
                ? safeInt(analysis.getRootCause().getProductionImpactPct()) : 0;
        int logBase = analysis != null && analysis.getRootCause() != null
                ? safeInt(analysis.getRootCause().getLogisticImpactPct()) : 50;

        double prod = production ? prodBase * 0.72 : prodBase * 0.35;
        double log = logBase * 0.72;
        double customer = 100.0 - prod - log;

        customer += 18;
        if (!production) {
            customer += 14;
        }
        if (priorReportCount > 1) {
            customer -= 10;
        }
        if (priorGrade.isPresent() && QualityGradingService.CUSTOMER.equals(priorGrade.get().getFinalGrade())) {
            customer -= 6;
            log += 4;
        }

        int[] normalized = normalizeThreeWay(prod, log, customer);

        List<String> indicators = new ArrayList<>();
        indicators.add("Tespit yeri: müşteri sahası — fabrika dışı bildirim.");
        if (production) {
            indicators.add("Üretim sensörlerinde proses anomalisi mevcut.");
        } else {
            indicators.add("Üretim sensörleri nominal — hasar lojistik veya saha kullanım profiline uyuyor.");
        }
        if (priorReportCount > 1) {
            indicators.add("Bu bobin daha önce " + priorReportCount + " kez raporlandı.");
        }
        if (priorGrade.isPresent()) {
            indicators.add("Mevcut kalite kararı: " + GRADE_LABELS.getOrDefault(
                    priorGrade.get().getFinalGrade(), priorGrade.get().getFinalGrade()));
        }
        if (ticket.getExtraNotes() != null && !ticket.getExtraNotes().isBlank()) {
            indicators.add("Müşteri beyanı kayıtlı.");
        }

        String summary = buildSummary(normalized[0], normalized[1], normalized[2]);
        String action = recommendAction(normalized[0], normalized[1], normalized[2], production);
        String dominant = resolveDominantSource(normalized[0], normalized[1], normalized[2]);
        RemediationPlanDto plan = buildRemediationPlan(dominant, production, normalized);

        return ResponsibilityAnalysisDto.builder()
                .productionPct(normalized[0])
                .logisticsPct(normalized[1])
                .customerPct(normalized[2])
                .summary(summary)
                .recommendedAction(action)
                .indicators(indicators)
                .dominantSource(dominant)
                .remediationPlan(plan)
                .build();
    }

    private String resolveDominantSource(int prod, int log, int cust) {
        if (prod >= log && prod >= cust) {
            return SOURCE_PRODUCTION;
        }
        if (log >= cust) {
            return SOURCE_LOGISTICS;
        }
        return SOURCE_CUSTOMER;
    }

    private RemediationPlanDto buildRemediationPlan(String dominant, boolean productionAnomaly, int[] pcts) {
        List<String> steps = new ArrayList<>();
        List<RemediationOptionDto> options = new ArrayList<>();

        switch (dominant) {
            case SOURCE_PRODUCTION -> {
                steps.add("Tam analiz ile üretim hattı / sensör sapmasını doğrulayın ve kayıt altına alın.");
                steps.add("Sevk öncesi kalite kaydını bu dosyada kontrol edin (salt okunur özet).");
                steps.add("Müşteriye teknik rapor sunun — hatayı kabul edin, telafi tipini seçin.");
                steps.add("İç CAPA açın; ilgili hat bakımını yönlendirin, tekrarı önleyin.");
                steps.add("Seçilen telafi aksiyonunu kaydedin ve dosyayı sonuçlandırın.");
                options.add(option(ACTION_CREDIT, "Kredi Notu",
                        "Bobin müşteride kalır; faturadan kısmi veya tam düşüm (ERP/muhasebe).", true));
                options.add(option(ACTION_REPLACEMENT, "Yeni Bobin Sevkiyatı",
                        "Aynı spesifikasyonda acil yedek sevkiyat planlayın.", pcts[0] >= 55));
                options.add(option(ACTION_DISCOUNT, "İskontolu Kabul",
                        "Hasar sınırlıysa müşteri kullanmaya devam eder, fiyat iskontosu uygulanır.", false));
                options.add(option(ACTION_CAPA, "İç CAPA Kaydı",
                        "Kök neden düzeltmesi — bakım ekibi, hat durdurma, proses iyileştirme.", true));
            }
            case SOURCE_LOGISTICS -> {
                steps.add("Sevkiyat, depolama ve taşıma kayıtlarını (irsaliye, fotoğraf) inceleyin.");
                steps.add("Hasar analizi ile üretim sensörlerinin nominal olduğunu doğrulayın.");
                steps.add("Lojistik sorumluluğu netleştirin veya müşteriyle paylaşımlı sorumluluk değerlendirin.");
                steps.add("Kredi notu veya sınırlı telafi önerin; gerekirse lojistik CAPA açın.");
                steps.add("Dosyayı sonuçlandırın.");
                options.add(option(ACTION_CREDIT, "Kredi Notu",
                        "Taşıma/depolama kaynaklı hasarda kısmi tazminat.", true));
                options.add(option(ACTION_REJECT, "Talebi Reddet",
                        "Hasar müşteri istifleme/kullanımından — garanti dışı.", pcts[2] > pcts[1]));
                options.add(option(ACTION_CAPA, "Lojistik CAPA",
                        "Sevkiyat/depolama prosedürü iyileştirmesi.", false));
            }
            default -> {
                steps.add("Müşteri beyanı ve saha fotoğraflarını teknik raporla eşleştirin.");
                steps.add("Üretim ve lojistik sensör profilinin temiz olduğunu müşteriye gösterin.");
                steps.add("Garanti kapsamı dışı değerlendirin veya sınırlı goodwill (küçük kredi) önerin.");
                steps.add("Talebi reddetme veya iskontolu kabul seçeneklerinden birini kaydedin.");
                steps.add("Dosyayı sonuçlandırın.");
                options.add(option(ACTION_REJECT, "Talebi Reddet",
                        "Garanti dışı — müşteri kullanım/depolama kaynaklı.", true));
                options.add(option(ACTION_DISCOUNT, "Sınırlı Goodwill / İskonto",
                        "İlişkiyi korumak için küçük ticari jest (isteğe bağlı).", false));
                options.add(option(ACTION_CREDIT, "Kısmi Kredi",
                        "Nadiren: müşteri memnuniyeti için sınırlı kredi.", false));
            }
        }

        if (productionAnomaly && !SOURCE_PRODUCTION.equals(dominant)) {
            steps.add(1, "Dikkat: Üretim sensörlerinde anomali var — karma vaka; kalite ekibi ile birlikte değerlendirin.");
        }

        String label = switch (dominant) {
            case SOURCE_PRODUCTION -> "Üretim kaynaklı — fabrika sorumluluğu";
            case SOURCE_LOGISTICS -> "Lojistik kaynaklı — taşıma/depolama";
            default -> "Müşteri sahası — kullanım/depolama";
        };

        return RemediationPlanDto.builder()
                .dominantSource(dominant)
                .dominantLabel(label)
                .workflowSteps(steps)
                .options(options)
                .build();
    }

    private RemediationOptionDto option(String code, String label, String description, boolean recommended) {
        return RemediationOptionDto.builder()
                .code(code)
                .label(label)
                .description(description)
                .recommended(recommended)
                .build();
    }

    private String resolveCapaReference(DamageTicket ticket, String provided) {
        if (provided != null && !provided.isBlank()) {
            return provided.trim();
        }
        String suffix = ticket.getTicketNumber().replaceAll("[^A-Z0-9]", "");
        if (suffix.length() > 8) {
            suffix = suffix.substring(suffix.length() - 8);
        }
        return "CAPA-" + java.time.Year.now().getValue() + "-" + suffix;
    }

    private String buildSummary(int prod, int log, int cust) {
        int max = Math.max(prod, Math.max(log, cust));
        if (max == prod) {
            return "Baskın görünüm: üretim kaynaklı proses sapması (" + prod + "% güven).";
        }
        if (max == log) {
            return "Baskın görünüm: lojistik / taşıma kaynaklı hasar (" + log + "% güven).";
        }
        return "Baskın görünüm: müşteri sahası / kullanım koşulları (" + cust + "% güven).";
    }

    private String recommendAction(int prod, int log, int cust, boolean production) {
        if (prod >= 45) {
            return "İç CAPA açın, üretim hattı kayıtlarını müşteriyle paylaşın. Gerekirse kısmi kredi değerlendirin.";
        }
        if (log >= 45) {
            return "Sevkiyat ve depolama kayıtlarını inceleyin; lojistik sorumluluğu netleştirin veya kredi notu önerin.";
        }
        if (cust >= 40) {
            return "Garanti kapsamı dışı değerlendirin; müşteriye teknik rapor sunun, talebi reddetme veya sınırlı goodwill seçeneklerini değerlendirin.";
        }
        if (production) {
            return "Karma profil — kalite ekibi ile birlikte manuel inceleme ve ticari çözüm (kredi / ikinci kalite kabul) değerlendirin.";
        }
        return "Ön değerlendirme tamamlayın; fiziksel numune veya fotoğraf ile kalite kararını destekleyin.";
    }

    private int[] normalizeThreeWay(double prod, double log, double customer) {
        prod = Math.max(5, prod);
        log = Math.max(5, log);
        customer = Math.max(5, customer);
        double total = prod + log + customer;
        int p = (int) Math.round(prod / total * 100);
        int l = (int) Math.round(log / total * 100);
        int c = 100 - p - l;
        return new int[]{Math.max(0, p), Math.max(0, l), Math.max(0, c)};
    }

    private int safeInt(Integer value) {
        return value != null ? value : 0;
    }

    private FieldCaseItemDto toItemDto(DamageTicket ticket) {
        Optional<QualityGradeRecord> grade = resolvePriorQualityGrade(ticket.getBatchId(), ticket.getBatchId());
        String gradeStatus = grade.isPresent() ? TicketQueueService.STATUS_DECIDED : TicketQueueService.STATUS_PENDING;

        return FieldCaseItemDto.builder()
                .ticketNumber(ticket.getTicketNumber())
                .batchId(ticket.getBatchId())
                .defectType(ticket.getDefectType())
                .customerCompany(resolveCustomerCompany(ticket))
                .reporterName(ticket.getReporterName())
                .contactPhone(ticket.getContactPhone())
                .extraNotes(ticket.getExtraNotes())
                .caseStatus(resolveCaseStatus(ticket))
                .caseStatusLabel(STATUS_LABELS.getOrDefault(resolveCaseStatus(ticket), "—"))
                .gradeStatus(gradeStatus)
                .finalGradeLabel(grade.map(g -> GRADE_LABELS.getOrDefault(g.getFinalGrade(), g.getFinalGrade()))
                        .orElse(isFieldCase(ticket) ? GRADE_LABELS.get(QualityGradingService.CUSTOMER) : null))
                .createdAt(ticket.getCreatedAt())
                .commercialAction(ticket.getCommercialAction())
                .commercialActionLabel(labelForAction(ticket.getCommercialAction()))
                .capaReference(ticket.getCapaReference())
                .resolutionNotes(ticket.getResolutionNotes())
                .build();
    }

    private String labelForAction(String action) {
        if (action == null || action.isBlank()) {
            return null;
        }
        return ACTION_LABELS.getOrDefault(action, action);
    }

    private String resolveCustomerCompany(DamageTicket ticket) {
        if (ticket.getCustomerCompany() != null && !ticket.getCustomerCompany().isBlank()) {
            return ticket.getCustomerCompany();
        }
        if ("Kalite Kontrol".equals(ticket.getDepartment()) || "Satış".equals(ticket.getDepartment())) {
            return ticket.getReporterName();
        }
        return ticket.getDepartment() != null ? ticket.getDepartment() : "Müşteri";
    }

    private String resolveCaseStatus(DamageTicket ticket) {
        return ticket.getCaseStatus() != null ? ticket.getCaseStatus() : STATUS_OPEN;
    }

    private boolean matchesStatus(FieldCaseItemDto item, String status) {
        return switch (status) {
            case "open" -> STATUS_OPEN.equals(item.getCaseStatus());
            case "reviewing" -> STATUS_IN_REVIEW.equals(item.getCaseStatus());
            case "resolved" -> STATUS_RESOLVED.equals(item.getCaseStatus());
            default -> true;
        };
    }

    /**
     * Müşteriye sevk edilmiş bobinler fabrikadan yalnızca birincil kalite onayı ile çıkar.
     * Şikâyet dosyası açıldığında sevk öncesi CUSTOMER kararı yoksa otomatik oluşturulur.
     */
    private Optional<QualityGradeRecord> resolvePriorQualityGrade(String... coilIds) {
        String fallbackId = null;
        for (String rawId : coilIds) {
            if (rawId == null || rawId.isBlank()) {
                continue;
            }
            fallbackId = rawId.trim();
            Optional<QualityGradeRecord> found = gradeRecordRepository
                    .findTopByCoilIdIgnoreCaseOrderByCreatedAtDesc(fallbackId);
            if (found.isPresent()) {
                return found;
            }
            Optional<String> resolved = coilIdResolver.resolve(fallbackId);
            if (resolved.isPresent()) {
                found = gradeRecordRepository.findTopByCoilIdIgnoreCaseOrderByCreatedAtDesc(resolved.get());
                if (found.isPresent()) {
                    return found;
                }
                fallbackId = resolved.get();
            }
        }
        return Optional.of(ensurePreShipmentCustomerGrade(
                fallbackId != null ? fallbackId : "UNKNOWN"));
    }

    private QualityGradeRecord ensurePreShipmentCustomerGrade(String batchId) {
        if (batchId == null || batchId.isBlank()) {
            return createPreShipmentGradeRecord("UNKNOWN");
        }

        String coilId = coilIdResolver.resolve(batchId.trim()).orElse(batchId.trim());

        Optional<QualityGradeRecord> existing = gradeRecordRepository
                .findTopByCoilIdIgnoreCaseOrderByCreatedAtDesc(coilId);
        if (existing.isPresent()) {
            return existing.get();
        }

        QualityGradeRecord record = createPreShipmentGradeRecord(coilId);
        return gradeRecordRepository.save(record);
    }

    private QualityGradeRecord createPreShipmentGradeRecord(String coilId) {
        QualityGradeRecord record = new QualityGradeRecord();
        record.setCoilId(coilId);
        record.setTicketNumber(null);
        record.setRecommendedGrade(QualityGradingService.CUSTOMER);
        record.setFinalGrade(QualityGradingService.CUSTOMER);
        record.setInspectorName("Kalite Uzmanı Ayşe Korkmaz");
        record.setNotes("Sevk öncesi birincil kalite onayı — müşteriye sevk için zorunlu.");
        record.setCreatedAt(LocalDateTime.now().minusDays(14));
        return record;
    }
}
