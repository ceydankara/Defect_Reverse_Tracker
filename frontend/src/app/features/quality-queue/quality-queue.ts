import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DefectService } from '../../core/services/defect';
import { AuthService } from '../../core/services/auth.service';
import { QualityGrading, TicketQueueItem, AnalysisResponseDto } from '../../core/models/defect.model';
import { AnalysisSummaryComponent } from '../../shared/analysis-summary/analysis-summary';

@Component({
  selector: 'app-quality-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AnalysisSummaryComponent],
  templateUrl: './quality-queue.html',
  styleUrl: './quality-queue.scss',
})
export class QualityQueueComponent implements OnInit {
  tickets: TicketQueueItem[] = [];
  selectedTicket: TicketQueueItem | null = null;
  qualityGrading: QualityGrading | null = null;
  analysis: AnalysisResponseDto | null = null;
  analysisHeadline = '';

  filter: 'all' | 'pending' | 'decided' = 'pending';
  loadingList = false;
  loadingDetail = false;
  errorMessage = '';

  selectedFinalGrade = '';
  gradeNotes = '';
  gradeConfirmed = false;

  constructor(
    private defectService: DefectService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const ticket = params.get('ticket');
      const status = params.get('status');
      if (status === 'all' || status === 'pending' || status === 'decided') {
        this.filter = status;
      }
      this.loadTickets(ticket ?? undefined);
    });
  }

  loadTickets(selectTicketNumber?: string): void {
    this.loadingList = true;
    this.errorMessage = '';

    this.defectService.getTicketQueue(this.filter).subscribe({
      next: (items) => {
        this.tickets = items;
        this.loadingList = false;

        if (selectTicketNumber) {
          const match = items.find((t) =>
            t.ticketNumber === selectTicketNumber
            || t.relatedTickets?.some((r) => r.ticketNumber === selectTicketNumber),
          );
          if (match) {
            this.selectTicket(match);
            return;
          }
          this.loadTicketByNumber(selectTicketNumber);
          return;
        }

        if (!this.selectedTicket && items.length > 0) {
          this.selectTicket(items[0]);
        } else if (this.selectedTicket) {
          const stillExists = items.find((t) => t.batchId === this.selectedTicket!.batchId);
          if (!stillExists && items.length > 0) {
            this.selectTicket(items[0]);
          } else if (stillExists) {
            this.selectedTicket = stillExists;
          }
        }
      },
      error: (err: HttpErrorResponse) => {
        this.loadingList = false;
        this.errorMessage = err.status === 0
          ? 'Backend erişilemiyor. Port 8080\'de Spring Boot çalıştığından emin olun.'
          : 'Talep listesi yüklenemedi.';
      },
    });
  }

  setFilter(filter: 'all' | 'pending' | 'decided'): void {
    this.filter = filter;
    this.selectedTicket = null;
    this.qualityGrading = null;
    this.analysis = null;
    this.analysisHeadline = '';
    this.loadTickets();
  }

  loadTicketByNumber(ticketNumber: string): void {
    this.loadingDetail = true;
    this.defectService.getTicketQueueDetail(ticketNumber).subscribe({
      next: (detail) => {
        this.selectedTicket = detail.ticket;
        this.tickets = [detail.ticket];
        this.qualityGrading = detail.qualityGrading ?? null;
        this.analysis = detail.analysis ?? null;
        this.analysisHeadline = detail.analysisHeadline ?? '';
        this.selectedFinalGrade = detail.ticket.finalGrade
          ?? detail.qualityGrading?.recommendedGrade
          ?? '';
        this.gradeConfirmed = detail.ticket.gradeStatus === 'DECIDED';
        this.loadingDetail = false;
      },
      error: () => {
        this.loadingDetail = false;
        this.errorMessage = 'Saha dosyası kalite ekranında yüklenemedi.';
      },
    });
  }

  selectTicket(ticket: TicketQueueItem): void {
    this.selectedTicket = ticket;
    this.gradeConfirmed = ticket.gradeStatus === 'DECIDED';
    this.gradeNotes = '';
    this.errorMessage = '';

    if (this.isDecidedView(ticket)) {
      this.loadingDetail = false;
      this.analysis = null;
      this.qualityGrading = null;
      this.analysisHeadline = '';
      this.selectedFinalGrade = ticket.finalGrade ?? '';
      return;
    }

    this.loadingDetail = true;

    this.defectService.getTicketQueueDetail(ticket.ticketNumber).subscribe({
      next: (detail) => {
        this.selectedTicket = detail.ticket;
        this.qualityGrading = detail.qualityGrading ?? null;
        this.analysis = detail.analysis ?? null;
        this.analysisHeadline = detail.analysisHeadline ?? '';
        this.selectedFinalGrade = detail.ticket.finalGrade
          ?? detail.qualityGrading?.recommendedGrade
          ?? '';
        this.gradeConfirmed = detail.ticket.gradeStatus === 'DECIDED';
        this.loadingDetail = false;
      },
      error: (err: HttpErrorResponse) => {
        this.loadingDetail = false;
        this.qualityGrading = null;
        this.analysis = null;
        if (err.status === 0) {
          this.errorMessage = 'Backend erişilemiyor. Port 8080\'de Spring Boot çalıştığından emin olun.';
        } else if (err.status === 403) {
          this.errorMessage = 'Kalite ekranı için yetkiniz yok. kalite veya admin hesabıyla giriş yapın.';
        } else if (err.status === 401) {
          this.errorMessage = 'Oturum süresi doldu. Lütfen tekrar giriş yapın.';
        } else if (err.status === 404) {
          this.errorMessage = 'Talep kaydı bulunamadı.';
        } else {
          this.errorMessage = 'Bobin detayı yüklenemedi.';
        }
      },
    });
  }

  isGradeActive(grade: string): boolean {
    return this.selectedFinalGrade === grade;
  }

  isRecommendedGrade(grade: string): boolean {
    return this.qualityGrading?.recommendedGrade === grade;
  }

  selectGrade(grade: string): void {
    this.selectedFinalGrade = grade;
    this.gradeConfirmed = false;
  }

  confirmQualityGrade(): void {
    if (!this.selectedTicket || !this.qualityGrading || !this.selectedFinalGrade) return;

    this.defectService.confirmGrade({
      coilId: this.selectedTicket.batchId,
      finalGrade: this.selectedFinalGrade,
      recommendedGrade: this.qualityGrading.recommendedGrade,
      inspectorName: this.auth.user()?.fullName ?? 'Kalite Kontrol',
      notes: this.gradeNotes,
      ticketNumber: this.selectedTicket.ticketNumber,
    }).subscribe({
      next: (result) => {
        this.gradeConfirmed = true;
        const count = result.resolvedTicketCount;
        const msg = count > 1
          ? `${count} talep için kalite kararı kaydedildi (${result.finalGradeLabel}).`
          : 'Kalite kararı kaydedildi.';
        alert(msg);
        this.loadTickets(this.selectedTicket!.ticketNumber);
      },
      error: () => alert('Kalite kararı kaydedilemedi.'),
    });
  }

  formatDate(value: string): string {
    if (!value) return '—';
    return new Date(value).toLocaleString('tr-TR');
  }

  statusLabel(ticket: TicketQueueItem): string {
    return ticket.gradeStatus === 'DECIDED' ? 'Karar Verildi' : 'Beklemede';
  }

  pendingCount(): number {
    return this.tickets.filter((t) => t.gradeStatus === 'PENDING').length;
  }

  isSelected(ticket: TicketQueueItem): boolean {
    return this.selectedTicket?.batchId === ticket.batchId;
  }

  hasMultipleTickets(ticket: TicketQueueItem): boolean {
    return (ticket.relatedTicketCount ?? 1) > 1;
  }

  isDecidedView(ticket: TicketQueueItem | null = this.selectedTicket): boolean {
    return ticket?.gradeStatus === 'DECIDED';
  }

  gradeBadgeClass(grade?: string): string {
    switch (grade) {
      case 'CUSTOMER': return 'grade-customer';
      case 'SCRAP': return 'grade-scrap';
      default: return 'grade-second';
    }
  }

  openFullAnalysis(): void {
    if (!this.selectedTicket?.batchId) return;

    const navigate = () => {
      this.router.navigate(['/hasar-analiz'], {
        queryParams: {
          coil: this.selectedTicket!.batchId,
          auto: '1',
          from: 'kalite',
        },
      });
    };

    this.defectService.getTicketQueueDetail(this.selectedTicket.ticketNumber).subscribe({
      next: () => navigate(),
      error: () => navigate(),
    });
  }
}
