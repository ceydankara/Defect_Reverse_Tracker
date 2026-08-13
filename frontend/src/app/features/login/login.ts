import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  loading = false;
  errorMessage = '';
  backendOnline = false;

  readonly demoAccounts = [
    { user: 'admin', pass: 'admin123', role: 'Yönetici — tüm paneller' },
    { user: 'kalite', pass: 'kalite123', role: 'Kalite — sınıflandırma + analiz' },
    { user: 'bakim', pass: 'bakim123', role: 'Bakım — talep + analiz (kalite yok)' },
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.http.get<{ status: string }>('http://localhost:8080/api/auth/health').subscribe({
      next: () => (this.backendOnline = true),
      error: () => (this.backendOnline = false),
    });
  }

  fillDemo(account: { user: string; pass: string }): void {
    this.username = account.user;
    this.password = account.pass;
  }

  onSubmit(): void {
    if (!this.username.trim() || !this.password) {
      this.errorMessage = 'Kullanıcı adı ve şifre zorunludur.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.auth.login({ username: this.username.trim(), password: this.password }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 0) {
          this.errorMessage =
            'Backend servisine bağlanılamadı. Spring Boot uygulamasını başlatın (port 8080).';
        } else if (err.status === 401) {
          this.errorMessage = 'Geçersiz kullanıcı adı veya şifre.';
        } else {
          this.errorMessage = `Giriş hatası (${err.status}). Backend loglarını kontrol edin.`;
        }
      },
    });
  }
}
