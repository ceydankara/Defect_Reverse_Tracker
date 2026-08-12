import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AnalysisResponseDto,
  CreateTicketRequest,
  DamageTicket,
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
}
