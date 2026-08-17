import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthUser, LoginRequest } from '../models/auth.model';
import { ANALYSIS_ROLES, AppRole, FIELD_CASE_ROLES, formatInspectorName, QUALITY_ROLES, ROLE_LABELS } from '../auth/roles';

const STORAGE_KEY = 'drt_auth';
const API = 'http://localhost:8080/api/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSignal = signal<AuthUser | null>(this.readStoredUser());

  readonly user = this.userSignal.asReadonly();
  readonly isLoggedIn = computed(() => !!this.userSignal()?.token);

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  login(credentials: LoginRequest): Observable<AuthUser> {
    return this.http.post<AuthUser>(`${API}/login`, credentials).pipe(
      tap((user) => this.persistUser(user)),
    );
  }

  logout(): void {
    const token = this.userSignal()?.token;
    if (token) {
      this.http.post(`${API}/logout`, {}).subscribe({ error: () => undefined });
    }
    sessionStorage.removeItem(STORAGE_KEY);
    this.userSignal.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.userSignal()?.token ?? null;
  }

  hasAnyRole(roles: AppRole[]): boolean {
    const role = this.userSignal()?.role;
    return !!role && roles.includes(role as AppRole);
  }

  canAnalyze(): boolean {
    return this.hasAnyRole(ANALYSIS_ROLES);
  }

  canViewRecentTickets(): boolean {
    return this.canAnalyze();
  }

  canGradeQuality(): boolean {
    return this.hasAnyRole(QUALITY_ROLES);
  }

  canManageFieldCases(): boolean {
    return this.hasAnyRole(FIELD_CASE_ROLES);
  }

  /** Karar veren satırı: "Kalite Uzmanı Ceyda Ankara" */
  inspectorDisplayName(): string {
    const u = this.userSignal();
    if (!u) return 'Kalite Kontrol';
    return formatInspectorName(u.jobTitle, u.fullName);
  }

  roleLabel(): string {
    const u = this.userSignal();
    if (u?.jobTitle?.trim()) {
      return u.jobTitle.trim();
    }
    const role = u?.role as AppRole | undefined;
    return role ? (ROLE_LABELS[role] ?? role) : '';
  }

  private persistUser(user: AuthUser): void {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    this.userSignal.set(user);
  }

  private readStoredUser(): AuthUser | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}
