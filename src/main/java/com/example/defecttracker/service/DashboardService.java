package com.example.defecttracker.service;

import com.example.defecttracker.config.RolePermissions;
import com.example.defecttracker.dto.DashboardStatsDto;
import com.example.defecttracker.entity.DamageTicket;
import com.example.defecttracker.entity.QualityGradeRecord;
import com.example.defecttracker.entity.User;
import com.example.defecttracker.repository.CoilRepository;
import com.example.defecttracker.repository.DamageTicketRepository;
import com.example.defecttracker.repository.DefectRepository;
import com.example.defecttracker.repository.ProcessStageRepository;
import com.example.defecttracker.repository.QualityGradeRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final CoilRepository coilRepository;
    private final DefectRepository defectRepository;
    private final ProcessStageRepository processStageRepository;
    private final DamageTicketRepository damageTicketRepository;
    private final QualityGradeRecordRepository gradeRecordRepository;

    private static final Map<String, String> GRADE_LABELS = Map.of(
            "CUSTOMER", "Müşteri Sevkiyatı",
            "SECOND_QUALITY", "İkinci Kalite",
            "SCRAP", "Hurda"
    );

    public DashboardStatsDto getStats(User user) {
        DashboardStatsDto stats = new DashboardStatsDto();
        stats.setTotalCoils(coilRepository.count());
        stats.setTotalDefects(defectRepository.count());
        stats.setTotalTickets(damageTicketRepository.count());

        List<DashboardStatsDto.CountItem> stageItems = processStageRepository.countAnomaliesByStage().stream()
                .map(row -> new DashboardStatsDto.CountItem((String) row[0], (Long) row[1]))
                .sorted(Comparator.comparingLong(DashboardStatsDto.CountItem::getCount).reversed())
                .collect(Collectors.toList());
        stats.setAnomaliesByStage(stageItems);
        stats.setProductionAnomalyCount(stageItems.stream().mapToLong(DashboardStatsDto.CountItem::getCount).sum());

        stats.setDefectsByCode(defectRepository.countByDefectCode().stream()
                .map(row -> new DashboardStatsDto.CountItem((String) row[0], (Long) row[1]))
                .sorted(Comparator.comparingLong(DashboardStatsDto.CountItem::getCount).reversed())
                .collect(Collectors.toList()));

        stats.setDefectsBySteelGrade(defectRepository.countBySteelGrade().stream()
                .map(row -> new DashboardStatsDto.CountItem((String) row[0], (Long) row[1]))
                .sorted(Comparator.comparingLong(DashboardStatsDto.CountItem::getCount).reversed())
                .collect(Collectors.toList()));

        long coilsWithAnomaly = processStageRepository.findDistinctCoilIdsWithAnomaly().size();
        stats.setLogisticsCaseCount(Math.max(0, coilRepository.count() - coilsWithAnomaly));

        stats.setRecentTickets(damageTicketRepository.findTop5ByOrderByCreatedAtDesc().stream()
                .map(this::toRecentTicket)
                .collect(Collectors.toList()));

        if (RolePermissions.canGradeQuality(user)) {
            Set<String> coilsWithTickets = damageTicketRepository.findAllByOrderByCreatedAtDesc().stream()
                    .map(t -> normalizeCoilKey(t.getBatchId()))
                    .collect(Collectors.toSet());
            long decidedCoils = gradeRecordRepository.findAll().stream()
                    .map(r -> normalizeCoilKey(r.getCoilId()))
                    .distinct()
                    .count();
            stats.setPendingQualityCount(Math.max(0, coilsWithTickets.size() - decidedCoils));
            stats.setDecidedQualityCount(decidedCoils);

            Map<String, Long> gradeCounts = gradeRecordRepository.findAll().stream()
                    .collect(Collectors.groupingBy(QualityGradeRecord::getFinalGrade, Collectors.counting()));
            stats.setQualityByGrade(GRADE_LABELS.entrySet().stream()
                    .map(e -> new DashboardStatsDto.CountItem(
                            e.getValue(),
                            gradeCounts.getOrDefault(e.getKey(), 0L)))
                    .filter(item -> item.getCount() > 0)
                    .collect(Collectors.toList()));
        } else {
            stats.setPendingQualityCount(0);
            stats.setDecidedQualityCount(0);
            stats.setQualityByGrade(List.of());
        }

        return stats;
    }

    private String normalizeCoilKey(String batchId) {
        return batchId == null ? "" : batchId.trim().toUpperCase(Locale.ROOT);
    }

    private DashboardStatsDto.RecentTicketDto toRecentTicket(DamageTicket ticket) {
        DashboardStatsDto.RecentTicketDto dto = new DashboardStatsDto.RecentTicketDto();
        dto.setTicketNumber(ticket.getTicketNumber());
        dto.setBatchId(ticket.getBatchId());
        dto.setDefectType(ticket.getDefectType());
        dto.setDepartment(ticket.getDepartment());
        dto.setReporterName(ticket.getReporterName());
        dto.setCreatedAt(ticket.getCreatedAt());
        return dto;
    }
}
