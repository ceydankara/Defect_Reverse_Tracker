package com.example.defecttracker.chat;

import com.example.defecttracker.config.RolePermissions;
import com.example.defecttracker.entity.User;
import com.example.defecttracker.mcp.DefectTrackerMcpTools;
import com.example.defecttracker.service.DashboardService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class AssistantChatTools {

    private final DefectTrackerMcpTools domainTools;
    private final DashboardService dashboardService;

    @Tool(name = "get_coil_analysis", description = "Bobin hasar analizini getirir: üretim/lojistik, kök neden, kanıt ve kalite önerisi. Kısa numara (9080) kabul eder.")
    public Map<String, Object> getCoilAnalysis(
            @ToolParam(description = "Bobin numarası, örneğin BOBIN-2026-9080 veya 9080")
            String coilId) {
        User user = currentUser();
        if (!RolePermissions.canAnalyze(user)) {
            return Map.of("error", "Hasar analizi için yetkiniz yok.");
        }
        Object result = domainTools.getCoilAnalysis(coilId);
        if (result instanceof Map<?, ?> map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> typed = (Map<String, Object>) map;
            return typed;
        }
        return Map.of("result", result);
    }

    @Tool(name = "get_capa_brief", description = "CAPA metni yazmak için bobin paketini getirir: analiz, kanıt, saha dosyası, sorumluluk ve geçmiş. 'CAPA yaz', 'düzeltici faaliyet' sorularında bunu çağır.")
    public Map<String, Object> getCapaBrief(
            @ToolParam(description = "Bobin numarası, örneğin BOBIN-2026-9080 veya 9080")
            String coilId) {
        User user = currentUser();
        if (!RolePermissions.canAnalyze(user)
                && !RolePermissions.canManageFieldCases(user)
                && !RolePermissions.canGradeQuality(user)) {
            return Map.of("error", "CAPA taslağı için yetkiniz yok.");
        }
        return domainTools.getCapaBrief(coilId);
    }

    @Tool(name = "list_open_field_cases", description = "Açık müşteri/saha hasar dosyalarını listeler.")
    public Map<String, Object> listOpenFieldCases() {
        User user = currentUser();
        if (!RolePermissions.canManageFieldCases(user)) {
            return Map.of("error", "Müşteri şikâyet dosyaları için yetkiniz yok.");
        }
        return Map.of("cases", domainTools.listOpenFieldCases());
    }

    @Tool(name = "get_dashboard_stats", description = "Ana panel özeti: bobin, kusur, talep sayıları ve anomaliler.")
    public Map<String, Object> getDashboardStats() {
        return Map.of("stats", dashboardService.getStats(currentUser()));
    }

    @Tool(name = "list_quality_queue", description = "Fabrika kalite kuyruğunu listeler. Bekleyen / karar bekleyen bobinler için status=pending. Karar verilenler için decided. Tümü için all.")
    public Map<String, Object> listQualityQueue(
            @ToolParam(description = "pending, decided veya all. 'Bekleyen' sorularında pending.")
            String status) {
        User user = currentUser();
        if (!RolePermissions.canGradeQuality(user)) {
            return Map.of("error", "Fabrika kalite kuyruğu için yetkiniz yok.");
        }
        return domainTools.listQualityQueue(status);
    }

    @Tool(name = "list_scrap_recommended_coils", description = "Yalnızca hurda önerilen veya hurda kararı kesinleşmiş bobinler. Bekleyen kuyruk sorusunda bunu çağırma.")
    public Map<String, Object> listScrapRecommendedCoils() {
        User user = currentUser();
        if (!RolePermissions.canGradeQuality(user)) {
            return Map.of("error", "Fabrika kalite kuyruğu için yetkiniz yok.");
        }
        return Map.of("coils", domainTools.listScrapRecommendedCoils());
    }

    private User currentUser() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs)) {
            return null;
        }
        HttpServletRequest request = attrs.getRequest();
        Object user = request.getAttribute("currentUser");
        return user instanceof User current ? current : null;
    }
}
