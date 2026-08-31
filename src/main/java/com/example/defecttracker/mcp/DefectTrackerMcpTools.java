package com.example.defecttracker.mcp;

import com.example.defecttracker.dto.AnalysisResponseDto;
import com.example.defecttracker.dto.CoilHistoryResponseDto;
import com.example.defecttracker.dto.FieldCaseDetailDto;
import com.example.defecttracker.dto.FieldCaseItemDto;
import com.example.defecttracker.dto.QualityGradingDto;
import com.example.defecttracker.dto.ResponsibilityAnalysisDto;
import com.example.defecttracker.dto.TicketQueueItemDto;
import com.example.defecttracker.service.AnalysisService;
import com.example.defecttracker.service.CoilHistoryService;
import com.example.defecttracker.service.DashboardService;
import com.example.defecttracker.service.FieldCaseService;
import com.example.defecttracker.service.QualityGradingService;
import com.example.defecttracker.service.TicketQueueService;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DefectTrackerMcpTools {

    private final AnalysisService analysisService;
    private final FieldCaseService fieldCaseService;
    private final DashboardService dashboardService;
    private final TicketQueueService ticketQueueService;
    private final CoilHistoryService coilHistoryService;

    @McpTool(
            name = "get_coil_analysis",
            description = "Bobin hasar analizini getirir: üretim/lojistik sınıflandırması, kök neden, kanıt maddeleri ve kalite önerisi.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, openWorldHint = false)
    )
    public Map<String, Object> getCoilAnalysis(
            @McpToolParam(description = "Bobin numarası, örneğin BOBIN-2026-9080", required = true)
            String coilId) {
        AnalysisResponseDto analysis = analysisService.getAnalysisByCoilId(coilId);
        if (analysis == null) {
            return Map.of("found", false, "message", "Bobin bulunamadı: " + coilId);
        }
        return toCompactAnalysis(analysis);
    }

    @McpTool(
            name = "get_capa_brief",
            description = "CAPA / düzeltici-önleyici faaliyet taslağı için bobin paketini getirir: analiz, kanıt, saha dosyası, sorumluluk yüzdeleri ve geçmiş. CAPA metni yazılırken bunu kullan; yalnızca get_coil_analysis ile yetinme.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, openWorldHint = false)
    )
    public Map<String, Object> getCapaBrief(
            @McpToolParam(description = "Bobin numarası, örneğin BOBIN-2026-9080 veya 9080", required = true)
            String coilId) {
        AnalysisResponseDto analysis = analysisService.getAnalysisByCoilId(coilId);
        if (analysis == null) {
            return Map.of("found", false, "message", "Bobin bulunamadı: " + coilId);
        }
        String resolvedId = analysis.getCoilId();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("found", true);
        out.put("documentType", "CAPA_DRAFT_SOURCE");
        out.put("coilId", resolvedId);
        out.put("analysis", toCompactAnalysis(analysis));

        CoilHistoryResponseDto history = coilHistoryService.getHistory(resolvedId);
        Map<String, Object> historyMap = new LinkedHashMap<>();
        historyMap.put("totalReports", history.getTotalReports());
        historyMap.put("summary", history.getSummaryMessage());
        out.put("history", historyMap);

        fieldCaseService.listCases("all").stream()
                .filter(item -> resolvedId.equalsIgnoreCase(item.getBatchId()))
                .findFirst()
                .flatMap(item -> fieldCaseService.getDetail(item.getTicketNumber()))
                .ifPresent(detail -> out.put("fieldCase", toCompactFieldCaseDetail(detail)));
        return out;
    }

    @McpTool(
            name = "list_open_field_cases",
            description = "Açık (OPEN) müşteri/saha hasar dosyalarını listeler.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, openWorldHint = false)
    )
    public List<Map<String, Object>> listOpenFieldCases() {
        return fieldCaseService.listCases("open").stream()
                .map(this::toCompactFieldCase)
                .toList();
    }

    @McpTool(
            name = "get_dashboard_stats",
            description = "Dashboard özeti: bobin, kusur, talep sayıları, aşama anomalileri, kalite dağılımı.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, openWorldHint = false)
    )
    public Object getDashboardStats() {
        return dashboardService.getStats();
    }

    @McpTool(
            name = "list_quality_queue",
            description = "Fabrika kalite kuyruğunu listeler. pending = karar bekleyenler, decided = karar verilenler, all = tümü. 'Bekleyen bobinler' sorusunda pending kullan.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, openWorldHint = false)
    )
    public Map<String, Object> listQualityQueue(
            @McpToolParam(description = "pending, decided veya all", required = true)
            String status) {
        String filter = normalizeQueueStatus(status);
        List<Map<String, Object>> coils = ticketQueueService.listQueue(filter).stream()
                .map(this::toCompactQueueItem)
                .toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("filter", filter);
        out.put("filterLabel", queueFilterLabel(filter));
        out.put("count", coils.size());
        out.put("coils", coils);
        return out;
    }

    @McpTool(
            name = "list_scrap_recommended_coils",
            description = "Yalnızca hurda (SCRAP) önerilen veya hurda kararı verilen bobinleri listeler. Bekleyen kuyruk için kullanma.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, openWorldHint = false)
    )
    public List<Map<String, Object>> listScrapRecommendedCoils() {
        return ticketQueueService.listQueue("all").stream()
                .filter(item -> QualityGradingService.SCRAP.equals(item.getRecommendedGrade())
                        || QualityGradingService.SCRAP.equals(item.getFinalGrade()))
                .map(this::toCompactQueueItem)
                .toList();
    }

    private Map<String, Object> toCompactAnalysis(AnalysisResponseDto analysis) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("found", true);
        out.put("coilId", analysis.getCoilId());
        out.put("steelGrade", analysis.getSteelGrade());
        out.put("defectCode", analysis.getDefectCode());
        out.put("classificationType", analysis.getClassificationType());
        out.put("classificationLabel", classificationLabel(analysis.getClassificationType()));
        out.put("headline", analysis.getHeadline());
        out.put("dataAvailable", analysis.isDataAvailable());
        out.put("evidenceIndicators", analysis.getEvidenceIndicators());
        if (analysis.getRootCause() != null) {
            var rc = analysis.getRootCause();
            Map<String, Object> root = new LinkedHashMap<>();
            root.put("equipment", nullToDash(rc.getEquipment()));
            root.put("faultSource", nullToDash(rc.getFaultSource()));
            root.put("detectionDetail", nullToDash(rc.getDetectionDetail()));
            root.put("stageName", nullToDash(rc.getStageName()));
            root.put("confidenceRate", rc.getConfidenceRate());
            root.put("productionImpactPct", rc.getProductionImpactPct() == null ? 0 : rc.getProductionImpactPct());
            root.put("logisticImpactPct", rc.getLogisticImpactPct() == null ? 0 : rc.getLogisticImpactPct());
            root.put("recommendedAction", nullToDash(rc.getRecommendedAction()));
            out.put("rootCause", root);
        }
        if (analysis.getSensorSummaries() != null) {
            out.put("anomalousSensors", analysis.getSensorSummaries().stream()
                    .filter(s -> "ANOMALI".equals(s.getStatus()))
                    .map(s -> Map.of(
                            "stageName", s.getStageName(),
                            "sensorKey", s.getSensorKey(),
                            "percentageDeviation", s.getPercentageDeviation()
                    ))
                    .toList());
        }
        QualityGradingDto grade = analysis.getQualityGrading();
        if (grade != null) {
            Map<String, Object> quality = new LinkedHashMap<>();
            quality.put("recommendedGrade", nullToDash(grade.getRecommendedGrade()));
            quality.put("recommendedGradeLabel", nullToDash(grade.getRecommendedGradeLabel()));
            quality.put("headline", nullToDash(grade.getHeadline()));
            quality.put("dispositionAction", nullToDash(grade.getDispositionAction()));
            quality.put("requiresManualReview", grade.isRequiresManualReview());
            quality.put("confidence", grade.getConfidence());
            out.put("qualityRecommendation", quality);
        }
        return out;
    }

    private Map<String, Object> toCompactFieldCaseDetail(FieldCaseDetailDto detail) {
        Map<String, Object> out = new LinkedHashMap<>();
        FieldCaseItemDto ticket = detail.getTicket();
        if (ticket != null) {
            out.put("ticket", toCompactFieldCase(ticket));
        }
        out.put("priorQualityDecision", nullToDash(detail.getPriorQualityDecision()));
        out.put("coilHistorySummary", detail.getCoilHistorySummary());
        out.put("priorReportCount", detail.getPriorReportCount());
        ResponsibilityAnalysisDto resp = detail.getResponsibility();
        if (resp != null) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("productionPct", resp.getProductionPct());
            r.put("logisticsPct", resp.getLogisticsPct());
            r.put("customerPct", resp.getCustomerPct());
            r.put("dominantSource", resp.getDominantSource());
            r.put("summary", resp.getSummary());
            r.put("recommendedAction", resp.getRecommendedAction());
            r.put("indicators", resp.getIndicators());
            if (resp.getRemediationPlan() != null) {
                r.put("workflowSteps", resp.getRemediationPlan().getWorkflowSteps());
                r.put("capaLabel", resp.getRemediationPlan().getCapaLabel());
            }
            out.put("responsibility", r);
        }
        return out;
    }

    private Map<String, Object> toCompactFieldCase(FieldCaseItemDto item) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ticketNumber", item.getTicketNumber());
        out.put("batchId", item.getBatchId());
        out.put("defectType", item.getDefectType());
        out.put("customerCompany", item.getCustomerCompany());
        out.put("caseStatus", item.getCaseStatus());
        out.put("caseStatusLabel", item.getCaseStatusLabel());
        out.put("extraNotes", item.getExtraNotes());
        out.put("capaReference", item.getCapaReference());
        out.put("createdAt", item.getCreatedAt() == null ? null : item.getCreatedAt().toString());
        return out;
    }

    private Map<String, Object> toCompactQueueItem(TicketQueueItemDto item) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ticketNumber", item.getTicketNumber());
        out.put("batchId", item.getBatchId());
        out.put("defectType", item.getDefectType());
        out.put("recommendedGrade", item.getRecommendedGrade());
        out.put("recommendedGradeLabel", item.getRecommendedGradeLabel());
        out.put("finalGrade", item.getFinalGrade());
        out.put("finalGradeLabel", item.getFinalGradeLabel());
        out.put("gradeStatus", item.getGradeStatus());
        out.put("gradeStatusLabel", TicketQueueService.STATUS_PENDING.equals(item.getGradeStatus())
                ? "Beklemede"
                : "Karar Verildi");
        return out;
    }

    private static String normalizeQueueStatus(String status) {
        if (status == null || status.isBlank()) {
            return "pending";
        }
        String value = status.trim().toLowerCase();
        if (value.contains("bekleyen") || value.contains("pending")) {
            return "pending";
        }
        if (value.contains("decid")
                || value.contains("verilen")
                || value.contains("verilmiş")
                || value.contains("verilmis")) {
            return "decided";
        }
        if (value.contains("all") || value.contains("tüm") || value.contains("tum")) {
            return "all";
        }
        return "pending";
    }

    private static String queueFilterLabel(String filter) {
        return switch (filter) {
            case "decided" -> "Karar verilenler";
            case "all" -> "Tümü";
            default -> "Bekleyenler";
        };
    }

    private static String classificationLabel(String type) {
        if ("PRODUCTION".equals(type)) {
            return "Üretim kaynaklı";
        }
        if ("NO_DATA".equals(type)) {
            return "Sensör verisi yok";
        }
        return "Lojistik / dış etken";
    }

    private static String nullToDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }
}
