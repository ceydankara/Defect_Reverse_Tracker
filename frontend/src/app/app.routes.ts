import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards/auth.guard';
import { ANALYSIS_ROLES, QUALITY_ROLES } from './core/auth/roles';
import { MainLayoutComponent } from './layout/main-layout/main-layout';
import { LoginComponent } from './features/login/login';
import { DashboardComponent } from './features/dashboard/dashboard';
import { DefectTrackerComponent } from './features/defect-tracker/defect-tracker';
import { DamageAnalysisComponent } from './features/damage-analysis/damage-analysis';
import { QualityQueueComponent } from './features/quality-queue/quality-queue';
import { FieldCasesComponent } from './features/field-cases/field-cases';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'hasar-talep', component: DefectTrackerComponent },
      {
        path: 'hasar-analiz',
        component: DamageAnalysisComponent,
        canActivate: [roleGuard(ANALYSIS_ROLES)],
      },
      {
        path: 'kalite-siniflandirma',
        component: QualityQueueComponent,
        canActivate: [roleGuard(QUALITY_ROLES)],
      },
      {
        path: 'saha-hasar-dosyalari',
        component: FieldCasesComponent,
        canActivate: [roleGuard(QUALITY_ROLES)],
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
