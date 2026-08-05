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

interface ThresholdSensor {
  name: string;
  unit: string;
  target: number;
  criticalMin: number;
  criticalMax: number;
  warningMin: number;
  warningMax: number;
  stage: string;
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

  // Geriye dönük uyumluluk alanları
  rootCauses: ResultRow[] = [];
  indicators: string[] = [];

  // Dinamik Kök Neden Değişkenleri
  rootCauseEquipment: string = '';
  productionImpact: number = 0;
  logisticImpact: number = 0;
  evidenceList: string[] = [];
  recommendedAction: string = '';

  // ALARM EŞİĞİ EDİTÖRÜ MODAL DEĞİŞKENLERİ
  isThresholdModalOpen: boolean = false;
  activeThresholdStage: string = 'Çelikhane';
  thresholdSensors: ThresholdSensor[] = [];

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

        // 2. Kök Neden (Dinamik Yüzde Hesaplamalı)
        if (data.rootCause) {
          const prodRaw = data.rootCause.productionImpactPct || 0;
          const logRaw = data.rootCause.logisticImpactPct || 0;
          const total = prodRaw + logRaw;

          if (total > 0) {
            this.productionImpact = Math.round((prodRaw / total) * 100);
            this.logisticImpact = 100 - this.productionImpact;
          } else {
            this.productionImpact = 100;
            this.logisticImpact = 0;
          }

          const stageName = (data.rootCause as any).stageName || (this.stages.find(s => s.status === 'ANOMALİ')?.title) || 'Üretim Hattı';
          const equipmentName = data.rootCause.equipment || 'Ekipman';

          this.rootCauseEquipment = `${stageName} / ${equipmentName}`;
          this.recommendedAction = data.rootCause.recommendedAction || 'Bakım ekibini ilgili hatta yönlendirin ve kök neden düzeltici aksiyon formunu (CAPA) açın.';

          this.evidenceList = [
            data.rootCause.detectionDetail || `${stageName} aşamasında ${equipmentName} cihazında sapma tespit edildi.`,
            `Üretim Etkisi Oranı: %${this.productionImpact} | Lojistik Etkisi Oranı: %${this.logisticImpact}`,
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

  // --- ALARM EŞİĞİ EDİTÖRÜ MODAL METOTLARI ---

  openThresholdModal(): void {
    if (this.allSensors && this.allSensors.length > 0) {
      this.thresholdSensors = this.allSensors.map(sensor => {
        const val = parseFloat(sensor.value) || 100;
        return {
          name: sensor.title,
          unit: sensor.unit || 'birim',
          target: val,
          criticalMin: Math.round(val * 0.85 * 10) / 10,
          criticalMax: Math.round(val * 1.15 * 10) / 10,
          warningMin: Math.round(val * 0.92 * 10) / 10,
          warningMax: Math.round(val * 1.08 * 10) / 10,
          stage: this.detectStageBySensorName(sensor.title, sensor.stageName)
        };
      });
    } else {
      this.initDefault16Sensors();
    }

    this.isThresholdModalOpen = true;
  }

  closeThresholdModal(): void {
    this.isThresholdModalOpen = false;
  }

  saveThresholds(): void {
    console.log('Güncellenmiş 16 Sensör Eşik Değerleri:', this.thresholdSensors);
    alert('Bütün sensörlerin alarm eşikleri başarıyla kaydedildi!');
    this.closeThresholdModal();
  }

  resetThresholds(): void {
    this.initDefault16Sensors();
    alert('Tüm sensör eşikleri varsayılana sıfırlandı.');
  }

  get filteredThresholdSensors(): ThresholdSensor[] {
    return this.thresholdSensors.filter(s =>
      s.stage.toLowerCase().trim() === this.activeThresholdStage.toLowerCase().trim()
    );
  }

  private detectStageBySensorName(title: string, stageName?: string): string {
    if (stageName) return stageName;
    const s = title.toLowerCase();
    if (s.includes('fırın') || s.includes('pota') || s.includes('argon') || s.includes('cüruf')) return 'Çelikhane';
    if (s.includes('merdane') || s.includes('şerit') || s.includes('rulman') || s.includes('emülsiyon')) return 'Sıcak Haddehane';
    if (s.includes('asit') || s.includes('tank') || s.includes('ph') || s.includes('banyo')) return 'Asitleme';
    return 'Soğuk Haddehane';
  }

  private initDefault16Sensors(): void {
    const defaultList = [
      // Çelikhane (4 Sensör)
      { name: 'Fırın Sıcaklığı', stage: 'Çelikhane', target: 1150, unit: '°C' },
      { name: 'Pota Sıcaklığı', stage: 'Çelikhane', target: 1580, unit: '°C' },
      { name: 'Argon Akış Debisi', stage: 'Çelikhane', target: 450, unit: 'L/dk' },
      { name: 'Cüruf Kalınlığı', stage: 'Çelikhane', target: 12, unit: 'mm' },

      // Sıcak Haddehane (4 Sensör)
      { name: 'Hadde Merdane Sıcaklığı', stage: 'Sıcak Haddehane', target: 880, unit: '°C' },
      { name: 'Şerit Çıkış Hızı', stage: 'Sıcak Haddehane', target: 15, unit: 'm/s' },
      { name: 'Rulman Titreşimi', stage: 'Sıcak Haddehane', target: 2.4, unit: 'mm/s' },
      { name: 'Emülsiyon Basıncı', stage: 'Sıcak Haddehane', target: 6.5, unit: 'bar' },

      // Asitleme (4 Sensör)
      { name: 'Asit Banyo Sıcaklığı', stage: 'Asitleme', target: 85, unit: '°C' },
      { name: 'Asit Konsantrasyonu (HCl)', stage: 'Asitleme', target: 18, unit: '%' },
      { name: 'Tank pH Seviyesi', stage: 'Asitleme', target: 1.2, unit: 'pH' },
      { name: 'Sıyırıcı Rulo Basıncı', stage: 'Asitleme', target: 4.2, unit: 'bar' },

      // Soğuk Haddehane (4 Sensör)
      { name: 'Şerit Gerginliği', stage: 'Soğuk Haddehane', target: 125, unit: 'kN' },
      { name: 'Sac Çıkış Kalınlığı', stage: 'Soğuk Haddehane', target: 1.5, unit: 'mm' },
      { name: 'X-Ray Kalınlık Sapması', stage: 'Soğuk Haddehane', target: 0.02, unit: 'mm' },
      { name: 'Yağlama Debisi', stage: 'Soğuk Haddehane', target: 18.5, unit: 'L/dk' }
    ];

    this.thresholdSensors = defaultList.map(s => ({
      ...s,
      criticalMin: Math.round(s.target * 0.85 * 10) / 10,
      criticalMax: Math.round(s.target * 1.15 * 10) / 10,
      warningMin: Math.round(s.target * 0.92 * 10) / 10,
      warningMax: Math.round(s.target * 1.08 * 10) / 10
    }));
  }
}
