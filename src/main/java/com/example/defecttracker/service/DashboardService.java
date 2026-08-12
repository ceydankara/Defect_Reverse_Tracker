package com.example.defecttracker.service;

import com.example.defecttracker.dto.DashboardStatsDto;
import com.example.defecttracker.entity.DamageTicket;
import com.example.defecttracker.repository.CoilRepository;
import com.example.defecttracker.repository.DamageTicketRepository;
import com.example.defecttracker.repository.DefectRepository;
import com.example.defecttracker.repository.ProcessStageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final CoilRepository coilRepository;
    private final DefectRepository defectRepository;
    private final ProcessStageRepository processStageRepository;
    private final DamageTicketRepository damageTicketRepository;

    public DashboardStatsDto getStats() {
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

        return stats;
    }

    private DashboardStatsDto.RecentTicketDto toRecentTicket(DamageTicket ticket) {
        DashboardStatsDto.RecentTicketDto dto = new DashboardStatsDto.RecentTicketDto();
        dto.setTicketNumber(ticket.getTicketNumber());
        dto.setBatchId(ticket.getBatchId());
        dto.setDefectType(ticket.getDefectType());
        dto.setDepartment(ticket.getDepartment());
        dto.setReporterName(ticket.getReporterName());
        return dto;
    }
}
