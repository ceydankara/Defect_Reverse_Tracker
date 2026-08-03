import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DefectService } from '../../core/services/defect'; // Path'i kendi klasör yapınıza göre doğrulayın
import { AnalysisResponseDto } from '../../core/models/defect.model';

type StageStatus = 'OK' | 'BEKLEMEDE' | 'ANOMALİ';

interface StageCard {
  title: string;
  status: StageStatus;
  value: string;
  delta: string;
}

interface SensorCard {
  title: string;
  value: string;
  unit: string;
  delta: string;
  state: string;
  spark: 'amber' | 'cyan' | 'violet' | 'teal';
}

interface ResultRow {
  label: string;
  value: string;
}

@Component({
  selector: 'app-defect-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './defect-tracker.html',
  styleUrl: './defect-tracker.scss'
})
export class DefectTrackerComponent {
  batchId: string = 'BOBIN-2026-9041';
  defectType: string = 'DEF_EDGE';

  isAnalyzed: boolean = false;
  isLoading: boolean = false;
  errorMessage: string = '';

  stages: StageCard[] = [
    { title: 'Çelikhane', status: 'BEKLEMEDE', value: '4 adım', delta: '0%' },
    { title: 'Sıcak Haddehane', status: 'BEKLEMEDE', value: '4 adım', delta: '0%' },
    { title: 'Asitleme', status: 'BEKLEMEDE', value: '4 adım', delta: '0%' },
    { title: 'Soğuk Haddehane', status: 'BEKLEMEDE', value: '4 adım', delta: '0%' }
  ];

  indicators: string[] = [];
  rootCauses: ResultRow[] = [];
  sensors: SensorCard[] = [];

  constructor(private defectService: DefectService) {}

  onStartAnalysis(): void {
    if (!this.batchId || this.batchId.trim() === '') {
      alert('Lütfen bir Bobin ID giriniz!');
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.defectService.getAnalysis(this.batchId.trim()).subscribe({
      next: (data: AnalysisResponseDto) => {
        console.log('Backend Response:', data); // F12 Konsolundan gelen veriyi kontrol edebilirsiniz

        if (!data) {
          this.errorMessage = 'Bobin bulundu ancak analiz verisi boş geldi.';
          this.isLoading = false;
          return;
        }

        this.defectType = data.defectCode || this.defectType;

        // 1. Üretim Hattı Aşamaları Güncelleme
        if (data.stages && data.stages.length > 0) {
          this.stages = data.stages.map(s => ({
            title: s.stageName,
            status: (s.status === 'ANOMALI' ? 'ANOMALİ' : 'OK') as StageStatus,
            value: `${s.sensorCount || 4} sensör`,
            delta: s.status === 'ANOMALI' ? 'Anomali Sapması' : 'Nominal'
          }));
        }

        // 2. Kök Neden ve Aksiyon Güncelleme
        if (data.rootCause) {
          this.rootCauses = [
            { label: 'Equipment / Cihaz', value: data.rootCause.equipment || '-' },
            { label: 'Hata / Arıza Kaynağı', value: data.rootCause.faultSource || '-' },
            { label: 'Güven Oranı', value: `%${data.rootCause.confidenceRate || 0}` },
            { label: 'Üretim Etkisi', value: `%${data.rootCause.productionImpactPct || 0}` },
            { label: 'Lojistik Etkisi', value: `%${data.rootCause.logisticImpactPct || 0}` }
          ];

          this.indicators = [
            data.rootCause.detectionDetail || 'Tespit detayı bulunamadı.',
            `Tavsiye Edilen Aksiyon: ${data.rootCause.recommendedAction || 'Aksiyon yok.'}`
          ];
        }

        // 3. Sensör Kartları Güncelleme
        if (data.sensorSummaries && data.sensorSummaries.length > 0) {
          const colors: ('amber' | 'cyan' | 'violet' | 'teal')[] = ['amber', 'cyan', 'violet', 'teal'];

          this.sensors = data.sensorSummaries.map((s, index) => ({
            title: s.sensorKey,
            value: s.lastActualValue !== undefined && s.lastActualValue !== null ? s.lastActualValue.toString() : '0',
            unit: 'değer',
            delta: `${s.percentageDeviation && s.percentageDeviation > 0 ? '+' : ''}${s.percentageDeviation || 0}%`,
            state: s.status === 'ANOMALI' ? 'Anormal' : 'Normal',
            spark: colors[index % colors.length]
          }));
        }

        this.isAnalyzed = true; // Bütün veriler eşlendikten sonra panelleri aç
        this.isLoading = false;
      },
      error: (err) => {
        console.error('API Hatası:', err);
        this.errorMessage = 'Girdiğiniz Bobin ID veritabanında bulunamadı veya backend servisine erişilemedi!';
        this.isAnalyzed = false;
        this.isLoading = false;
      }
    });
  }
}
