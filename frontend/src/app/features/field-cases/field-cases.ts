import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DefectService } from '../../core/services/defect';
import { AuthService } from '../../core/services/auth.service';
import { FieldCaseDetail, FieldCaseItem, RemediationOption } from '../../core/models/defect.model';

type FieldFilter = 'all' | 'open' | 'reviewing' | 'resolved';

@Component({
  selector: 'app-field-cases',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './field-cases.html',
  styleUrl: './field-cases.scss',
})
export class FieldCasesComponent implements OnInit {
  cases: FieldCaseItem[] = [];
  selectedCase: FieldCaseItem | null = null;
  detail: FieldCaseDetail | null = null;

  filter: FieldFilter = 'open';
  loadingList = false;
  loadingDetail = false;
  savingResolution = false;
  errorMessage = '';
  statusMessage = '';

  selectedAction = '';
  capaReference = '';
  resolutionNotes = '';
  markResolvedOnSave = true;

  constructor(
    private defectService: DefectService,
    public auth: AuthService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const ticket = params.get('ticket');
      const status = params.get('status');
      if (status === 'all' || status === 'open' || status === 'reviewing' || status === 'resolved') {
        this.filter = status;
      }
      this.loadCases(ticket ?? undefined);
    });
  }

  loadCases(selectTicket?: string): void {
    this.loadingList = true;
    this.errorMessage = '';

    this.defectService.getFieldCases(this.filter).subscribe({
      next: (items) => {
        this.cases = items;
        this.loadingList = false;

        if (selectTicket) {
          const match = items.find((c) => c.ticketNumber === selectTicket);
          if (match) {
            this.selectCase(match);
            return;
          }
        }

        if (!this.selectedCase && items.length > 0) {
          this.selectCase(items[0]);
        } else if (this.selectedCase) {
          const still = items.find((c) => c.ticketNumber === this.selectedCase!.ticketNumber);
          if (still) {
            this.selectedCase = still;
          } else if (items.length > 0) {
            this.selectCase(items[0]);
          } else {
            this.selectedCase = null;
            this.detail = null;
          }
        }
      },
      error: (err: HttpErrorResponse) => {
        this.loadingList = false;
        this.errorMessage = err.status === 403
          ? 'Saha hasar dosyaları için yetkiniz yok. kalite veya admin hesabıyla giriş yapın.'
          : err.status === 0
            ? 'Backend erişilemiyor.'
            : 'Dosya listesi yüklenemedi.';
      },
    });
  }

  setFilter(filter: FieldFilter): void {
    this.filter = filter;
    this.selectedCase = null;
    this.detail = null;
    this.loadCases();
  }

  selectCase(item: FieldCaseItem): void {
    this.selectedCase = item;
    this.detail = null;
    this.loadingDetail = true;
    this.statusMessage = '';
    this.errorMessage = '';

    this.defectService.getFieldCaseDetail(item.ticketNumber).subscribe({
      next: (data) => {
        this.detail = data;
        this.syncResolutionFormFromDetail();
        this.loadingDetail = false;
      },
      error: () => {
        this.loadingDetail = false;
        this.errorMessage = 'Dosya detayı yüklenemedi.';
      },
    });
  }

  private syncResolutionFormFromDetail(): void {
    if (!this.detail) return;
    const t = this.detail.ticket;
    this.selectedAction = t.commercialAction ?? this.defaultRecommendedAction();
    this.capaReference = t.capaReference ?? '';
    this.resolutionNotes = t.resolutionNotes ?? '';
  }

  private defaultRecommendedAction(): string {
    const opts = this.detail?.responsibility?.remediationPlan?.options ?? [];
    return opts.find((o) => o.recommended)?.code ?? opts[0]?.code ?? '';
  }

  isSelected(item: FieldCaseItem): boolean {
    return this.selectedCase?.ticketNumber === item.ticketNumber;
  }

  isActionSelected(code: string): boolean {
    return this.selectedAction === code;
  }

  selectAction(option: RemediationOption): void {
    this.selectedAction = option.code;
  }

  isProductionDominant(): boolean {
    return this.detail?.responsibility?.dominantSource === 'PRODUCTION';
  }

  setStatus(status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED'): void {
    if (!this.selectedCase) return;
    this.defectService.updateFieldCaseStatus(this.selectedCase.ticketNumber, status).subscribe({
      next: (updated) => {
        this.selectedCase = updated;
        this.statusMessage = `Durum güncellendi: ${updated.caseStatusLabel}`;
        this.loadCases(updated.ticketNumber);
        setTimeout(() => { if (this.statusMessage.includes('güncellendi')) this.statusMessage = ''; }, 2500);
      },
      error: () => {
        this.errorMessage = 'Durum güncellenemedi.';
      },
    });
  }

  saveResolution(): void {
    if (!this.selectedCase || !this.selectedAction) return;
    this.savingResolution = true;
    this.errorMessage = '';

    this.defectService.applyFieldCaseResolution(this.selectedCase.ticketNumber, {
      commercialAction: this.selectedAction,
      capaReference: this.capaReference.trim() || undefined,
      resolutionNotes: this.resolutionNotes.trim() || undefined,
      markResolved: this.markResolvedOnSave,
    }).subscribe({
      next: (data) => {
        this.detail = data;
        this.selectedCase = data.ticket;
        this.syncResolutionFormFromDetail();
        this.savingResolution = false;
        this.statusMessage = this.markResolvedOnSave
          ? `Telafi aksiyonu kaydedildi ve dosya sonuçlandı: ${data.ticket.commercialActionLabel}`
          : `Telafi aksiyonu kaydedildi: ${data.ticket.commercialActionLabel}`;
        this.loadCases(data.ticket.ticketNumber);
        setTimeout(() => { if (this.statusMessage.includes('kaydedildi')) this.statusMessage = ''; }, 3500);
      },
      error: () => {
        this.savingResolution = false;
        this.errorMessage = 'Telafi aksiyonu kaydedilemedi.';
      },
    });
  }

  formatDate(value: string): string {
    if (!value) return '—';
    return new Date(value).toLocaleString('tr-TR');
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'OPEN': return 'badge-open';
      case 'IN_REVIEW': return 'badge-review';
      case 'RESOLVED': return 'badge-resolved';
      default: return '';
    }
  }

  dominantBadgeClass(): string {
    const src = this.detail?.responsibility?.dominantSource;
    if (src === 'PRODUCTION') return 'dom-prod';
    if (src === 'LOGISTICS') return 'dom-log';
    return 'dom-cust';
  }

  /** Sevk öncesi fabrika kalite kaydı — yalnızca görüntüleme */
  sevkQualityLabel(): string {
    return this.detail?.ticket?.finalGradeLabel
      ?? this.detail?.priorQualityDecision
      ?? 'Kayıt yok';
  }

  analysisQueryParams(): Record<string, string> {
    return {
      coil: this.selectedCase?.batchId ?? '',
      auto: '1',
      from: 'saha',
    };
  }

  analysisHeadline(): string {
    return this.detail?.analysisHeadline ?? this.detail?.analysis?.headline ?? '';
  }
}
