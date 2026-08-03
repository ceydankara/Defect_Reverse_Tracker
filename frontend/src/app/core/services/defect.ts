import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AnalysisResponseDto } from '../models/defect.model';

@Injectable({
  providedIn: 'root'
})
export class DefectService {
  private apiUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}

  getAnalysis(coilId: string): Observable<AnalysisResponseDto> {
    return this.http.get<AnalysisResponseDto>(`${this.apiUrl}/analysis/${coilId}`);
  }
}
