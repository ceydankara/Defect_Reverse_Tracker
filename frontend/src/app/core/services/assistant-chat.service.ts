import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API = 'http://localhost:8080/api/chat';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  available: boolean;
}

export interface ChatStatus {
  available: boolean;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class AssistantChatService {
  constructor(private http: HttpClient) {}

  status(): Observable<ChatStatus> {
    return this.http.get<ChatStatus>(`${API}/status`);
  }

  send(message: string, history: ChatTurn[]): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(API, { message, history });
  }
}
