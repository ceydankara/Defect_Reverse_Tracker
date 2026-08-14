import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AnalysisResponseDto,
  CreateTicketRequest,
  DamageTicket,
  CoilHistory,
  ConfirmGradeRequest,
  ConfirmGradeResponse,
  TicketQueueItem,
  TicketQueueDetail,
  FieldCaseDetail,
  FieldCaseItem,
  FieldCaseResolutionRequest,
} from '../models/defect.model';

const API = 'http://localhost:8080/api';

@Injectable({ providedIn: 'root' })
export class DefectService {
  constructor(private http: HttpClient) {}

  getAnalysis(coilId: string): Observable<AnalysisResponseDto> {
    return this.http.get<AnalysisResponseDto>(`${API}/analysis/${encodeURIComponent(coilId)}`);
  }

  createTicket(payload: CreateTicketRequest): Observable<DamageTicket> {
    return this.http.post<DamageTicket>(`${API}/tickets`, payload);
  }

  getCoilHistory(coilId: string): Observable<CoilHistory> {
    return this.http.get<CoilHistory>(`${API}/tickets/history/${encodeURIComponent(coilId)}`);
  }

  confirmGrade(payload: ConfirmGradeRequest): Observable<ConfirmGradeResponse> {
    return this.http.post<ConfirmGradeResponse>(`${API}/quality/decisions`, payload);
  }

  getTicketQueue(status: 'all' | 'pending' | 'decided' = 'all'): Observable<TicketQueueItem[]> {
    return this.http.get<TicketQueueItem[]>(`${API}/tickets/queue`, { params: { status } });
  }

  getTicketQueueDetail(ticketNumber: string): Observable<TicketQueueDetail> {
    return this.http.get<TicketQueueDetail>(`${API}/tickets/queue/${encodeURIComponent(ticketNumber)}`);
  }

  getFieldCases(status: 'all' | 'open' | 'reviewing' | 'resolved' = 'all'): Observable<FieldCaseItem[]> {
    return this.http.get<FieldCaseItem[]>(`${API}/field-cases`, { params: { status } });
  }

  getFieldCaseDetail(ticketNumber: string): Observable<FieldCaseDetail> {
    return this.http.get<FieldCaseDetail>(`${API}/field-cases/${encodeURIComponent(ticketNumber)}`);
  }

  updateFieldCaseStatus(ticketNumber: string, caseStatus: string): Observable<FieldCaseItem> {
    return this.http.patch<FieldCaseItem>(
      `${API}/field-cases/${encodeURIComponent(ticketNumber)}/status`,
      { caseStatus },
    );
  }

  applyFieldCaseResolution(ticketNumber: string, payload: FieldCaseResolutionRequest): Observable<FieldCaseDetail> {
    return this.http.patch<FieldCaseDetail>(
      `${API}/field-cases/${encodeURIComponent(ticketNumber)}/resolution`,
      payload,
    );
  }
}
