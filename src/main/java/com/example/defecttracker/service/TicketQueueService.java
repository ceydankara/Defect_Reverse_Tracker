package com.example.defecttracker.service;

import com.example.defecttracker.dto.AnalysisResponseDto;
import com.example.defecttracker.dto.QualityGradingDto;
import com.example.defecttracker.dto.RelatedTicketDto;
import com.example.defecttracker.dto.TicketQueueDetailDto;
import com.example.defecttracker.dto.TicketQueueItemDto;
import com.example.defecttracker.entity.DamageTicket;
import com.example.defecttracker.entity.QualityGradeRecord;
import com.example.defecttracker.repository.DamageTicketRepository;
import com.example.defecttracker.repository.QualityGradeRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TicketQueueService {

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_DECIDED = "DECIDED";

    private static final Map<String, String> GRADE_LABELS = Map.of(
            QualityGradingService.CUSTOMER, "Müşteri Sevkiyatı",
            QualityGradingService.SECOND_QUALITY, "İkinci Kalite",
            QualityGradingService.SCRAP, "Hurda"
    );

    private final DamageTicketRepository ticketRepository;
    private final QualityGradeRecordRepository gradeRecordRepository;
    private final AnalysisService analysisService;
    private final QualityGradingService qualityGradingService;
    private final CoilIdResolver coilIdResolver;
    private final CoilProvisioningService coilProvisioningService;

    public List<TicketQueueItemDto> listQueue(String status) {
        String normalized = status == null ? "all" : status.trim().toLowerCase(Locale.ROOT);

        Map<String, List<DamageTicket>> grouped = new LinkedHashMap<>();
        for (DamageTicket ticket : ticketRepository.findAllByOrderByCreatedAtDesc()) {
            String key = normalizeCoilKey(ticket.getBatchId());
            grouped.computeIfAbsent(key, ignored -> new ArrayList<>()).add(ticket);
        }

        return grouped.values().stream()
                .map(this::mergeCoilGroup)
                .filter(item -> matchesStatus(item, normalized))
                .sorted(Comparator.comparing(TicketQueueItemDto::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    public Optional<TicketQueueDetailDto> getDetail(String ticketNumber) {
        return ticketRepository.findByTicketNumber(ticketNumber)
                .map(ticket -> buildDetail(ticket.getBatchId(), ticket.getTicketNumber()));
    }

    private TicketQueueDetailDto buildDetail(String batchId, String primaryTicketNumber) {
        List<DamageTicket> related = ticketRepository.findByBatchIdIgnoreCaseOrderByCreatedAtDesc(batchId);
        DamageTicket primary = related.stream()
                .filter(t -> t.getTicketNumber().equals(primaryTicketNumber))
                .findFirst()
                .orElse(related.get(0));

        TicketQueueItemDto item = mergeCoilGroup(related);
        String resolvedCoilId = coilProvisioningService.ensureCoilForTicket(
                batchId, primary.getDefectType());
        AnalysisResponseDto analysis = analysisService.getAnalysisByCoilId(resolvedCoilId);
        QualityGradingDto grading = analysis != null
                ? analysis.getQualityGrading()
                : qualityGradingService.grade(buildMinimalAnalysis(primary));

        return TicketQueueDetailDto.builder()
                .ticket(item)
                .qualityGrading(grading)
                .analysisHeadline(analysis != null ? analysis.getHeadline() : null)
                .analysis(analysis)
                .build();
    }

    private TicketQueueItemDto mergeCoilGroup(List<DamageTicket> tickets) {
        List<DamageTicket> sorted = tickets.stream()
                .sorted(Comparator.comparing(DamageTicket::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        DamageTicket latest = sorted.get(0);
        Optional<QualityGradeRecord> coilDecision = findCoilDecision(latest.getBatchId());

        List<RelatedTicketDto> related = sorted.stream()
                .map(this::toRelatedTicket)
                .toList();

        String gradeStatus = coilDecision.isPresent() ? STATUS_DECIDED : STATUS_PENDING;
        String finalGrade = coilDecision.map(QualityGradeRecord::getFinalGrade).orElse(null);
        String recommendedGrade = coilDecision.map(QualityGradeRecord::getRecommendedGrade).orElse(null);

        return TicketQueueItemDto.builder()
                .ticketNumber(latest.getTicketNumber())
                .batchId(latest.getBatchId())
                .defectType(latest.getDefectType())
                .department(latest.getDepartment())
                .reporterName(latest.getReporterName())
                .detectedLocation(latest.getDetectedLocation())
                .extraNotes(latest.getExtraNotes())
                .createdAt(latest.getCreatedAt())
                .gradeStatus(gradeStatus)
                .finalGrade(finalGrade)
                .finalGradeLabel(labelFor(finalGrade))
                .recommendedGrade(recommendedGrade)
                .recommendedGradeLabel(labelFor(recommendedGrade))
                .inspectorName(coilDecision.map(QualityGradeRecord::getInspectorName).orElse(null))
                .relatedTicketCount(sorted.size())
                .relatedTickets(related)
                .build();
    }

    private RelatedTicketDto toRelatedTicket(DamageTicket ticket) {
        return RelatedTicketDto.builder()
                .ticketNumber(ticket.getTicketNumber())
                .defectType(ticket.getDefectType())
                .department(ticket.getDepartment())
                .reporterName(ticket.getReporterName())
                .createdAt(ticket.getCreatedAt())
                .build();
    }

    private Optional<QualityGradeRecord> findCoilDecision(String batchId) {
        return gradeRecordRepository.findTopByCoilIdIgnoreCaseOrderByCreatedAtDesc(batchId);
    }

    private String normalizeCoilKey(String batchId) {
        return batchId == null ? "" : batchId.trim().toUpperCase(Locale.ROOT);
    }

    private boolean matchesStatus(TicketQueueItemDto item, String status) {
        if ("all".equals(status)) {
            return true;
        }
        if ("pending".equals(status)) {
            return STATUS_PENDING.equals(item.getGradeStatus());
        }
        if ("decided".equals(status)) {
            return STATUS_DECIDED.equals(item.getGradeStatus());
        }
        return true;
    }

    private AnalysisResponseDto buildMinimalAnalysis(DamageTicket ticket) {
        AnalysisResponseDto dto = new AnalysisResponseDto();
        dto.setCoilId(ticket.getBatchId());
        dto.setClassificationType("LOGISTICS");
        dto.setDefectCode("");
        dto.setStages(List.of());
        dto.setSensorSummaries(List.of());
        dto.setRootCause(new AnalysisResponseDto.RootCauseDto());
        return dto;
    }

    private String labelFor(String grade) {
        if (grade == null || grade.isBlank()) {
            return null;
        }
        return GRADE_LABELS.getOrDefault(grade, grade);
    }
}
