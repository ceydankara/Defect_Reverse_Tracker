import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DefectService } from '../../core/services/defect'; // Path'i projenize göre kontrol edin
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

interface ScenarioCard {
  title: string;
  value: string;
  note: string;
  tone: 'amber' | 'cyan' | 'violet' | 'teal';
}

@Component({
  selector: 'app-defect-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './defect-tracker.html',
  styleUrl: './defect-tracker.scss'
})
export class DefectTrackerComponent {
  // Girdi Kutularının Yazılabilir Değişkenleri
  batchId: string = 'BOBIN-2026-9041';
  defectType: string = 'DEF_EDGE';

  // Analiz Tetiklenme Bayrakları
  isAnalyzed: boolean = false;
  isLoading: boolean = false;
  errorMessage: string = '';

  // 1. İLK AÇILIŞ: Tüm aşamalar "BEKLEMEDE"
  stages: StageCard[] = [
    { title: 'Çelikhane', status: 'BEKLEMEDE', value: '4 adım', delta: '0%' },
    { title: 'Sıcak Haddehane', status: 'BEKLEMEDE', value: '4 adım', delta: '0%' },
    { title: 'Asitleme', status: 'BEKLEMEDE', value: '4 adım', delta: '0%' },
    { title: 'Soğuk Haddehane', status: 'BEKLEMEDE', value: '4 adım', delta: '0%' }
  ];

  indicators: string[] = [];
  rootCauses: ResultRow[] = [];
  sensors: SensorCard[] = [];
  scenarios: ScenarioCard[] = [];

  constructor(private defectService: DefectService) {}

  // BUTONA BASILDIĞINDA ÇALIŞAN METOD
  onStartAnalysis(): void {
    if (!this.batchId || this.batchId.trim() === '') {
      alert('Lütfen analiz edilecek bir Bobin ID giriniz!');
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    // Backend REST API Çağrısı
    this.defectService.getAnalysis(this.batchId.trim()).subscribe({
      next: (data: AnalysisResponseDto) => {
        // Kusur Kodu Veritabanından Gelenle Güncellenir
        if (data.defectCode) {
          this.defectType = data.defectCode;
        }

        // 1. Aşamaları Güncelle (OK / ANOMALİ)
        if (data.stages && data.stages.length > 0) {
          this.stages = data.stages.map(s => ({
            title: s.stageName,
            status: (s.status === 'ANOMALI' ? 'ANOMALİ' : 'OK') as StageStatus,
            value: `${s.sensorCount || 4} adım`,
            delta: s.status === 'ANOMALI' ? '% Sapma' : 'Nominal'
          }));
        }

        // 2. Kök Neden Bilgilerini Doldur
        if (data.rootCause) {
          this.rootCauses = [
            { label: 'Equipment / Cihaz', value: data.rootCause.equipment },
            { label: 'Hata Kaynağı', value: data.rootCause.faultSource },
            { label: 'Güven Oranı', value: `%${data.rootCause.confidenceRate}` },
            { label: 'Üretim Etkisi', value: `%${data.rootCause.productionImpactPct}` },
            { label: 'Lojistik Etkisi', value: `%${data.rootCause.logisticImpactPct}` }
          ];

          this.indicators = [
            data.rootCause.detectionDetail,
            `Önerilen Aksiyon: ${data.rootCause.recommendedAction}`
          ];
        }

        // 3. Sensör Özet Kartlarını Doldur
        if (data.sensorSummaries && data.sensorSummaries.length > 0) {
          const colors: ('amber' | 'cyan' | 'violet' | 'teal')[] = ['amber', 'cyan', 'violet', 'teal'];

          this.sensors = data.sensorSummaries.map((s, index) => ({
            title: s.sensorKey,
            value: s.lastActualValue ? s.lastActualValue.toString() : '0',
            unit: 'değer',
            delta: `${s.percentageDeviation > 0 ? '+' : ''}${s.percentageDeviation}%`,
            state: s.status === 'ANOMALI' ? 'Anormal' : 'Normal',
            spark: colors[index % colors.length]
          }));
        }

        // 4. Detay Panellerini Aç
        this.isAnalyzed = true;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = 'Girdiğiniz Bobin ID veritabanında bulunamadı veya sunucu hatası!';
        this.isAnalyzed = false;
        this.isLoading = false;
      }
    });
  }
}
