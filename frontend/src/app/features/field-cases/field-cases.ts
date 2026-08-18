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
  openCapa = false;
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
          ? 'Müşteri şikâyet dosyaları için yetkiniz yok. kalite veya admin hesabıyla giriş yapın.'
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
    const plan = this.detail.responsibility?.remediationPlan;
    const legacyCapaAction = t.commercialAction === 'CAPA';

    if (legacyCapaAction) {
      this.selectedAction = this.defaultRecommendedAction();
      this.openCapa = true;
    } else {
      this.selectedAction = t.commercialAction ?? this.defaultRecommendedAction();
      this.openCapa = !!t.capaReference || !!(plan?.capaDefaultOpen && !t.commercialAction);
    }

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

  isLogisticsDominant(): boolean {
    return this.detail?.responsibility?.dominantSource === 'LOGISTICS';
  }

  capaCheckboxLabel(): string {
    return this.detail?.responsibility?.remediationPlan?.capaLabel
      ?? (this.isProductionDominant() ? 'İç CAPA aç' : 'Lojistik CAPA aç');
  }

  showCapaOption(): boolean {
    return !!this.detail?.responsibility?.remediationPlan?.capaOptional;
  }

  isResolved(): boolean {
    return this.detail?.ticket?.caseStatus === 'RESOLVED';
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

  isProductionDominant(): boolean {
    return this.detail?.responsibility?.dominantSource === 'PRODUCTION';
  }

  saveResolution(): void {
    if (!this.selectedCase || !this.selectedAction) return;
    this.savingResolution = true;
    this.errorMessage = '';

    this.defectService.applyFieldCaseResolution(this.selectedCase.ticketNumber, {
      commercialAction: this.selectedAction,
      openCapa: this.showCapaOption() ? this.openCapa : undefined,
      capaReference: this.openCapa ? (this.capaReference.trim() || undefined) : undefined,
      resolutionNotes: this.resolutionNotes.trim() || undefined,
      markResolved: this.markResolvedOnSave,
    }).subscribe({
      next: (data) => {
        this.detail = data;
        this.selectedCase = data.ticket;
        this.syncResolutionFormFromDetail();
        this.savingResolution = false;
        const capaNote = data.ticket.capaReference ? ` · CAPA: ${data.ticket.capaReference}` : '';
        this.statusMessage = this.markResolvedOnSave
          ? `Telafi aksiyonu kaydedildi ve dosya sonuçlandı: ${data.ticket.commercialActionLabel}${capaNote}`
          : `Telafi aksiyonu kaydedildi: ${data.ticket.commercialActionLabel}${capaNote}`;
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

  remediationPanelClass(): string {
    const src = this.detail?.responsibility?.dominantSource;
    if (src === 'PRODUCTION') return 'remediation-production';
    if (src === 'LOGISTICS') return 'remediation-logistics';
    return 'remediation-customer';
  }

  actionCardClasses(opt: RemediationOption): Record<string, boolean> {
    const key = this.actionStyleKey(opt.code);
    return {
      [`action-${key}`]: true,
      active: this.isActionSelected(opt.code),
      recommended: opt.recommended,
    };
  }

  actionStyleKey(code: string): string {
    const map: Record<string, string> = {
      CREDIT: 'credit',
      REPLACEMENT: 'replacement',
      DISCOUNT: 'discount',
      REJECT_CLAIM: 'reject',
      CAPA: 'capa',
    };
    return map[code] ?? 'default';
  }

  actionIcon(code: string): string {
    const map: Record<string, string> = {
      CREDIT: '₺',
      REPLACEMENT: '↗',
      DISCOUNT: '%',
      REJECT_CLAIM: '✕',
      CAPA: '⚙',
    };
    return map[code] ?? '•';
  }

  /** Sevk öncesi fabrika kalite kaydı — müşteriye giden bobinlerde birincil onay zorunlu */
  sevkQualityLabel(): string {
    const label = this.detail?.ticket?.finalGradeLabel
      ?? this.detail?.priorQualityDecision
      ?? '';
    if (!label || /verilmedi|kayıt yok/i.test(label)) {
      return 'Müşteri Sevkiyatı (Birincil)';
    }
    return label;
  }

  listGradeLabel(item: FieldCaseItem): string {
    const label = item.finalGradeLabel ?? '';
    if (!label || /verilmedi|kayıt yok/i.test(label)) {
      return 'Müşteri Sevkiyatı (Birincil)';
    }
    return label;
  }

  analysisQueryParams(): Record<string, string> {
    const params: Record<string, string> = {
      coil: this.selectedCase?.batchId ?? '',
      auto: '1',
      from: 'saha',
    };
    if (this.selectedCase?.ticketNumber) {
      params['ticket'] = this.selectedCase.ticketNumber;
    }
    return params;
  }

  analysisHeadline(): string {
    return this.detail?.analysisHeadline ?? this.detail?.analysis?.headline ?? '';
  }
}
