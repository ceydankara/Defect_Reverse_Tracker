import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DefectService } from '../../core/services/defect';
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
  stageName?: string;
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
  batchId: string = '';
  defectType: string = '';

  isAnalyzed: boolean = false;
  isLoading: boolean = false;
  errorMessage: string = '';

  selectedStageName: string | null = null;
  allSensors: SensorCard[] = [];
  filteredSensors: SensorCard[] = [];

  stages: StageCard[] = [
    { title: 'Çelikhane', status: 'BEKLEMEDE', value: '4 sensör', delta: '0%' },
    { title: 'Sıcak Haddehane', status: 'BEKLEMEDE', value: '4 sensör', delta: '0%' },
    { title: 'Asitleme', status: 'BEKLEMEDE', value: '4 sensör', delta: '0%' },
    { title: 'Soğuk Haddehane', status: 'BEKLEMEDE', value: '4 sensör', delta: '0%' }
  ];

  rootCauses: ResultRow[] = [];
  indicators: string[] = [];

  rootCauseEquipment: string = '';
  productionImpact: number = 0;
  logisticImpact: number = 0;
  evidenceList: string[] = [];
  recommendedAction: string = '';

  constructor(private defectService: DefectService) {}

  onStartAnalysis(): void {
    if (!this.batchId || this.batchId.trim() === '') {
      alert('Lütfen bir Bobin ID giriniz!');
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.selectedStageName = null;

    this.defectService.getAnalysis(this.batchId.trim()).subscribe({
      next: (data: AnalysisResponseDto) => {
        if (!data) {
          this.errorMessage = 'Bobin bulundu ancak analiz verisi boş geldi.';
          this.isLoading = false;
          return;
        }

        this.defectType = data.defectCode || this.defectType;

        // 1. Aşamalar
        if (data.stages && data.stages.length > 0) {
          this.stages = data.stages.map(s => ({
            title: s.stageName,
            status: (s.status === 'ANOMALI' ? 'ANOMALİ' : 'OK') as StageStatus,
            value: `${s.sensorCount || 4} sensör`,
            delta: s.status === 'ANOMALI' ? 'Anomali Sapması' : 'Nominal'
          }));
        }

        // 2. Kök Neden
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

          this.rootCauseEquipment = `${data.rootCause.equipment || ''} / ${data.rootCause.faultSource || ''}`;
          this.productionImpact = data.rootCause.productionImpactPct || 0;
          this.logisticImpact = data.rootCause.logisticImpactPct || 0;
          this.recommendedAction = data.rootCause.recommendedAction || '';

          this.evidenceList = [
            data.rootCause.detectionDetail || 'Sensör verilerinde sapma tespit edildi.',
            'Sapma süresi ve büyüklüğü kusur oluşumu için yeterli eşiği aştı',
            'Kusur morfolojisi proses kaynaklı dağılımla örtüşüyor',
            'Aynı vardiyada üretilen diğer bobinlerde benzer iz tespit edildi'
          ];
        }

        // 3. Sensörler
        if (data.sensorSummaries && data.sensorSummaries.length > 0) {
          const colors: ('amber' | 'cyan' | 'violet' | 'teal')[] = ['amber', 'cyan', 'violet', 'teal'];

          this.allSensors = data.sensorSummaries.map((s, index) => ({
            title: s.sensorKey,
            value: s.lastActualValue !== undefined && s.lastActualValue !== null ? s.lastActualValue.toString() : '0',
            unit: 'değer',
            delta: `${s.percentageDeviation && s.percentageDeviation > 0 ? '+' : ''}${s.percentageDeviation || 0}%`,
            state: s.status === 'ANOMALI' ? 'Anormal' : 'Normal',
            stageName: (s as any).stageName,
            spark: colors[index % colors.length]
          }));

          this.isAnalyzed = true;
          this.isLoading = false;

          // Sadece ANOMALİ tespit edilen aşamayı otomatik seç
          const anomaliStage = this.stages.find(s => s.status === 'ANOMALİ');
          if (anomaliStage) {
            this.selectStage(anomaliStage.title);
          } else if (this.stages.length > 0) {
            this.selectStage(this.stages[0].title);
          } else {
            this.filteredSensors = [...this.allSensors];
          }
        } else {
          this.isAnalyzed = true;
          this.isLoading = false;
        }
      },
      error: (err) => {
        console.error('API Hatası:', err);
        this.errorMessage = 'Girdiğiniz Bobin ID veritabanında bulunamadı veya backend servisine erişilemedi!';
        this.isAnalyzed = false;
        this.isLoading = false;
      }
    });
  }

  selectStage(stageTitle: string): void {
    if (!this.isAnalyzed) return;

    this.selectedStageName = stageTitle;

    let matches = this.allSensors.filter(sensor =>
      sensor.stageName && sensor.stageName.toLowerCase().trim() === stageTitle.toLowerCase().trim()
    );

    if (matches.length === 0) {
      const titleLower = stageTitle.toLowerCase();

      matches = this.allSensors.filter(sensor => {
        const sKey = sensor.title.toLowerCase();

        if (titleLower.includes('çelikhane')) {
          return sKey.includes('fırın') || sKey.includes('pota') || sKey.includes('argon') || sKey.includes('cüruf') || sKey.includes('sıcaklık');
        } else if (titleLower.includes('sıcak')) {
          return sKey.includes('merdane') || sKey.includes('şerit') || sKey.includes('rulman') || sKey.includes('emülsiyon') || sKey.includes('kuvvet');
        } else if (titleLower.includes('asitleme')) {
          return sKey.includes('asit') || sKey.includes('tank') || sKey.includes('ph') || sKey.includes('banyo') || sKey.includes('sıyırıcı');
        } else if (titleLower.includes('soğuk')) {
          return sKey.includes('gerginlik') || sKey.includes('sac') || sKey.includes('kalınlık') || sKey.includes('x-ray') || sKey.includes('yağlama');
        }

        return sKey.includes(titleLower);
      });
    }

    this.filteredSensors = matches.length > 0 ? matches : [...this.allSensors];
  }
}
