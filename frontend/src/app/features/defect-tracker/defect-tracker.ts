import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DefectService } from '../../core/services/defect';
import { CoilHistory } from '../../core/models/defect.model';

@Component({
  selector: 'app-defect-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './defect-tracker.html',
  styleUrl: './defect-tracker.scss',
})
export class DefectTrackerComponent {
  isFormSubmitted = false;
  ticketNumber = '';
  reporterName = '';
  department = '';
  batchId = '';
  detectedLocation = 'Üretim Hattı';
  defectType = '';
  extraNotes = '';

  coilHistory: CoilHistory | null = null;
  coilHistoryLoading = false;
  isLoading = false;
  private historyCheckTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private defectService: DefectService) {}

  selectDefectType(type: string): void {
    this.defectType = type;
  }

  onBatchIdChange(): void {
    if (this.historyCheckTimer) clearTimeout(this.historyCheckTimer);
    this.historyCheckTimer = setTimeout(() => this.checkCoilHistory(), 450);
  }

  checkCoilHistory(): void {
    const coilId = this.batchId.trim();
    if (!coilId) { this.coilHistory = null; return; }
    this.coilHistoryLoading = true;
    this.defectService.getCoilHistory(coilId).subscribe({
      next: (history) => { this.coilHistory = history; this.coilHistoryLoading = false; },
      error: () => { this.coilHistory = null; this.coilHistoryLoading = false; },
    });
  }

  formatReportDate(value: string): string {
    if (!value) return '—';
    return new Date(value).toLocaleString('tr-TR');
  }

  onSubmitTicket(): void {
    if (!this.reporterName.trim()) return alert('Lütfen Ad Soyad alanını doldurunuz!');
    if (!this.department.trim()) return alert('Lütfen Departman seçiniz!');
    if (!this.batchId.trim()) return alert('Lütfen Bobin ID giriniz!');
    if (!this.defectType.trim()) return alert('Lütfen bir Hasar Türü seçiniz!');

    this.isLoading = true;
    this.defectService.createTicket({
      reporterName: this.reporterName,
      department: this.department,
      batchId: this.batchId.trim(),
      detectedLocation: this.detectedLocation,
      defectType: this.defectType,
      extraNotes: this.extraNotes,
    }).subscribe({
      next: (ticket) => {
        this.ticketNumber = ticket.ticketNumber;
        this.isFormSubmitted = true;
        this.isLoading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        alert(err.status === 0 ? 'Backend erişilemiyor.' : 'Talep kaydedilemedi.');
      },
    });
  }

  openNewTicketForm(): void {
    this.isFormSubmitted = false;
    this.ticketNumber = '';
    this.batchId = '';
    this.defectType = '';
    this.extraNotes = '';
    this.coilHistory = null;
  }
}
