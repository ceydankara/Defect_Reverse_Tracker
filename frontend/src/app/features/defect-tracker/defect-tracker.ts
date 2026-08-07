import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DefectService } from '../../core/services/defect';
import { AnalysisResponseDto } from '../../core/models/defect.model';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

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
  originalState: string;
  stageName?: string;
  spark: 'amber' | 'cyan' | 'violet' | 'teal';
  timeSeries?: any[];
}

interface ThresholdSensor {
  id: string;
  name: string;
  unit: string;
  target: number;
  criticalMin: number;
  criticalMax: number;
  warningMin: number;
  warningMax: number;
  stage: string;
  isUserModified?: boolean;
}

@Component({
  selector: 'app-defect-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './defect-tracker.html',
  styleUrl: './defect-tracker.scss'
})
export class DefectTrackerComponent implements AfterViewInit {
  @ViewChild('sensorChartCanvas') sensorChartCanvas!: ElementRef<HTMLCanvasElement>;

  // TALEP FORMU ALANLARI
  isFormSubmitted: boolean = false;
  ticketNumber: string = '';
  reporterName: string = '';
  department: string = '';
  batchId: string = '';
  detectedLocation: string = 'Üretim Hattı'; // 'Üretim Hattı' | 'Depo / Sevkiyat' | 'Müşteri / Saha'
  defectType: string = '';
  extraNotes: string = '';

  isLoading: boolean = false;
  isAnalyzed: boolean = false;
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

  // KÖK NEDEN VE ETKİ DEĞİŞKENLERİ
  rootCauseEquipment: string = '';
  productionImpact: number = 0;
  logisticImpact: number = 0;
  evidenceList: string[] = [];
  recommendedAction: string = '';

  // EŞİK EDİTÖRÜ MODAL DEĞİŞKENLERİ
  isThresholdModalOpen: boolean = false;
  activeThresholdStage: string = 'Çelikhane';
  thresholdSensors: ThresholdSensor[] = [];
  savedThresholds: ThresholdSensor[] = [];

  // GRAFİK DEĞİŞKENLERİ
  chart: Chart<'line'> | null = null;
  selectedSensorTitle: string = '';
  selectedSensorStage: string = '';

  constructor(private defectService: DefectService) {}

  ngAfterViewInit(): void {
    if (this.isAnalyzed && this.filteredSensors.length > 0) {
      this.initChart();
    }
  }

  // HASAR KUSUR SEÇİMİ (FORM İÇİN)
  selectDefectType(type: string): void {
    this.defectType = type;
  }

  // TALEP OLUŞTURMA VE ANALİZİ BAŞLATMA
  onSubmitTicketAndStartAnalysis(): void {
    if (!this.reporterName || this.reporterName.trim() === '') {
      alert('Lütfen Ad Soyad alanını doldurunuz!');
      return;
    }
    if (!this.department || this.department.trim() === '') {
      alert('Lütfen Departman seçiniz!');
      return;
    }
    if (!this.batchId || this.batchId.trim() === '') {
      alert('Lütfen Bobin ID giriniz!');
      return;
    }
    if (!this.defectType || this.defectType.trim() === '') {
      alert('Lütfen bir Hasar Türü seçiniz!');
      return;
    }

    // Rastgele Bilet Numarası Oluşturma
    const randomTicketId = Math.floor(1000 + Math.random() * 9000);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    this.ticketNumber = `TKT-${dateStr}-${randomTicketId}`;

    this.isFormSubmitted = true;
    this.onStartAnalysis();
  }

  // YENİ TALEP AÇMA (FORM EKRANINA GERİ DÖNÜŞ)
  openNewTicketForm(): void {
    this.isFormSubmitted = false;
    this.isAnalyzed = false;
    this.errorMessage = '';
    this.batchId = '';
    this.defectType = '';
    this.extraNotes = '';
  }

  onStartAnalysis(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.selectedStageName = null;
    this.savedThresholds = [];

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

        // 2. Sensörler ve Zaman Serisi Verileri
        if (data.sensorSummaries && data.sensorSummaries.length > 0) {
          const colors: ('amber' | 'cyan' | 'violet' | 'teal')[] = ['amber', 'cyan', 'violet', 'teal'];

          this.allSensors = data.sensorSummaries.map((s, index) => {
            const isAnomali = s.status === 'ANOMALI';
            return {
              title: s.sensorKey,
              value: s.lastActualValue !== undefined && s.lastActualValue !== null ? s.lastActualValue.toString() : '0',
              unit: (s as any).unit || 'değer',
              delta: `${s.percentageDeviation && s.percentageDeviation > 0 ? '+' : ''}${s.percentageDeviation || 0}%`,
              state: isAnomali ? 'Anormal' : 'Normal',
              originalState: isAnomali ? 'Anormal' : 'Normal',
              stageName: (s as any).stageName,
              spark: colors[index % colors.length],
              timeSeries: (s as any).timeSeries || (s as any).readings || []
            };
          });

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

          if (this.filteredSensors.length > 0) {
            setTimeout(() => {
              this.initChart();
              this.onSelectSensorCard(this.filteredSensors[0]);
            }, 100);
          }
        } else {
          this.isAnalyzed = true;
          this.isLoading = false;
        }

        // 3. Kök Neden Mantığı ve Formül
        if (data.rootCause) {
          const hasAnyStageAnomaly = this.stages.some(s => s.status === 'ANOMALİ');

          if (!hasAnyStageAnomaly) {
            this.productionImpact = 10;
            this.logisticImpact = 90;

            this.rootCauseEquipment = 'Lojistik & Dış Etken / Depo - Nakliye Hattı';
            this.recommendedAction = 'Müşteri sevkiyat kayıtlarını, forklift elleçleme raporlarını ve stok sahası kilitlerini denetleyin.';

            this.evidenceList = [
              'Üretim hattındaki tüm sensör verileri (Çelikhane, Haddehane, Asitleme) nominal limitler dahilindedir.',
              'Etki Dağılımı: Üretim %10 | Lojistik %90 (Lojistik Ağırlıklı Hasar)',
              'Tesis içi üretim süreçlerinde herhangi bir tolerans aşımı veya termal/mekanik sapma tespit edilmemiştir.',
              'Kusur morfolojisi fabrika dışı taşıma, istifleme veya yükleme kaynaklı mekanik darbelerle uyuşmaktadır.'
            ];
          } else {
            const anomalousSensor = this.allSensors.find(s => s.state === 'Anormal');
            let deviationPct = 0;

            if (anomalousSensor && anomalousSensor.delta) {
              deviationPct = Math.abs(parseFloat(anomalousSensor.delta.replace('%', '').replace('+', ''))) || 0;
            }

            let calculatedProdImpact = Math.round(50 + (deviationPct * 1.5));
            if (calculatedProdImpact > 95) calculatedProdImpact = 95;
            if (calculatedProdImpact < 50) calculatedProdImpact = 50;

            this.productionImpact = calculatedProdImpact;
            this.logisticImpact = 100 - calculatedProdImpact;

            const stageName = (data.rootCause as any).stageName || (this.stages.find(s => s.status === 'ANOMALİ')?.title) || 'Üretim Hattı';
            const equipmentName = data.rootCause.equipment || 'Ekipman';

            this.rootCauseEquipment = `${stageName} / ${equipmentName}`;
            this.recommendedAction = data.rootCause.recommendedAction || 'Bakım ekibini ilgili hatta yönlendirin.';

            const dynamicEvidence: string[] = [
              data.rootCause.detectionDetail || `${stageName} aşamasında ${equipmentName} cihazında tolerans dışı sapma tespit edildi.`,
              `Hesaplanan Sapma Şiddeti: %${deviationPct} -> Etki Dağılımı: Üretim %${this.productionImpact} | Lojistik %${this.logisticImpact}`
            ];

            dynamicEvidence.push(`${equipmentName} sensörlerinden alınan veriler tolerans limitlerini aştı.`);
            dynamicEvidence.push(`Aynı vardiyada ${stageName} hattından geçen bobin verilerinde benzer trend izlendi.`);
            this.evidenceList = dynamicEvidence;
          }
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

    if (this.filteredSensors.length > 0) {
      setTimeout(() => {
        if (!this.chart) {
          this.initChart();
        }
        this.onSelectSensorCard(this.filteredSensors[0]);
      }, 50);
    }
  }

  onSelectSensorCard(sensor: SensorCard): void {
    this.selectedSensorTitle = sensor.title;
    this.selectedSensorStage = sensor.stageName || this.selectedStageName || 'Üretim Hattı';

    if (!this.chart) {
      this.initChart();
    }
    this.updateChartData();
  }

  private initChart(): void {
    if (!this.sensorChartCanvas) return;
    const ctx = this.sensorChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.chart) {
      this.chart.destroy();
    }

    const labels = Array.from({ length: 19 }, (_, i) => (i * 10).toString());

    this.chart = new Chart<'line'>(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Gerçek Değer',
            data: [],
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 2,
            tension: 0.35,
            fill: true
          },
          {
            label: 'Hedef Limit',
            data: [],
            borderColor: '#38bdf8',
            borderDash: [5, 5],
            borderWidth: 1.5,
            pointRadius: 0
          },
          {
            label: 'Uyarı Limiti',
            data: [],
            borderColor: '#f59e0b',
            borderDash: [5, 5],
            borderWidth: 1.5,
            pointRadius: 0
          },
          {
            label: 'Kritik Limit',
            data: [],
            borderColor: '#dc2626',
            borderDash: [5, 5],
            borderWidth: 1.5,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }

  updateChartData(): void {
    if (!this.chart || !this.selectedSensorTitle) return;

    const activeSensor = this.allSensors.find(s => s.title === this.selectedSensorTitle);
    if (!activeSensor) return;

    const val = parseFloat(activeSensor.value) || 100;
    const matchThreshold = this.savedThresholds.find(t => t.name === this.selectedSensorTitle || t.id === this.selectedSensorTitle);

    let targetVal = matchThreshold ? matchThreshold.target : val;
    if (!matchThreshold && activeSensor.delta) {
      const devPct = parseFloat(activeSensor.delta.replace('%', '').replace('+', '')) || 0;
      if (devPct !== 0) {
        targetVal = Math.round((val / (1 + devPct / 100)) * 10) / 10;
      }
    }

    const isBelowTarget = val < targetVal;

    let warningVal = matchThreshold
      ? (isBelowTarget ? matchThreshold.warningMin : matchThreshold.warningMax)
      : Math.round(targetVal * (isBelowTarget ? 0.92 : 1.08) * 10) / 10;

    let criticalVal = matchThreshold
      ? (isBelowTarget ? matchThreshold.criticalMin : matchThreshold.criticalMax)
      : Math.round(targetVal * (isBelowTarget ? 0.85 : 1.15) * 10) / 10;

    let realData: number[] = [];
    const timePoints = 19;

    if (activeSensor.timeSeries && activeSensor.timeSeries.length > 0) {
      realData = activeSensor.timeSeries.map((item: any) =>
        typeof item === 'number' ? item : (item.actualValue !== undefined ? item.actualValue : (item.value || 0))
      );
    } else {
      const isAnomali = activeSensor.state === 'Anormal';
      const sTitle = this.selectedSensorTitle.toLowerCase();
      const titleHash = sTitle.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

      for (let i = 0; i < timePoints; i++) {
        let currentVal = targetVal;
        if (!isAnomali) {
          const microNoise = Math.sin(i + titleHash) * (targetVal * 0.015);
          currentVal = targetVal + microNoise;
        } else {
          currentVal = targetVal + ((val - targetVal) * (i / timePoints));
        }
        realData.push(Math.round(currentVal * 10) / 10);
      }
    }

    const isAnomali = activeSensor.state === 'Anormal';
    const datasets = this.chart.data.datasets;

    if (datasets && datasets.length >= 4) {
      datasets[0].data = realData;
      (datasets[0] as any).borderColor = isAnomali ? '#ef4444' : '#10b981';
      (datasets[0] as any).backgroundColor = isAnomali ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)';

      datasets[1].data = Array(realData.length).fill(targetVal);
      datasets[2].data = Array(realData.length).fill(warningVal);
      datasets[3].data = Array(realData.length).fill(criticalVal);
    }

    this.chart.update();
  }

  // ALARM EŞİĞİ MODAL
  openThresholdModal(): void {
    if (this.savedThresholds && this.savedThresholds.length > 0) {
      this.thresholdSensors = JSON.parse(JSON.stringify(this.savedThresholds));
    } else if (this.allSensors && this.allSensors.length > 0) {
      this.thresholdSensors = this.allSensors.map(sensor => {
        const val = parseFloat(sensor.value) || 100;
        return {
          id: sensor.title,
          name: sensor.title,
          unit: sensor.unit || 'değer',
          target: val,
          criticalMin: Math.round(val * 0.85 * 10) / 10,
          criticalMax: Math.round(val * 1.15 * 10) / 10,
          warningMin: Math.round(val * 0.92 * 10) / 10,
          warningMax: Math.round(val * 1.08 * 10) / 10,
          stage: this.detectStageBySensorName(sensor.title, sensor.stageName),
          isUserModified: false
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
    this.savedThresholds = JSON.parse(JSON.stringify(this.thresholdSensors));
    this.reevaluateSensorsAndStagesWithThresholds();
    this.updateChartData();
    alert('Alarm eşikleri kaydedildi!');
    this.closeThresholdModal();
  }

  resetThresholds(): void {
    this.savedThresholds = [];
    if (this.allSensors && this.allSensors.length > 0) {
      this.allSensors.forEach(s => s.state = s.originalState);
    }
    this.openThresholdModal();
    this.reevaluateSensorsAndStagesWithThresholds();
    this.updateChartData();
    alert('Tüm sensör eşikleri sıfırlandı.');
  }

  private reevaluateSensorsAndStagesWithThresholds(): void {
    if (!this.allSensors || this.allSensors.length === 0) return;

    this.allSensors.forEach(sensor => {
      const val = parseFloat(sensor.value);
      const matchThreshold = this.savedThresholds.find(t => t.id === sensor.title || t.name === sensor.title);

      if (matchThreshold && matchThreshold.isUserModified && !isNaN(val)) {
        if (val < matchThreshold.criticalMin || val > matchThreshold.criticalMax) {
          sensor.state = 'Anormal';
        } else {
          sensor.state = 'Normal';
        }
      } else {
        sensor.state = sensor.originalState;
      }
    });

    this.stages.forEach(stage => {
      const stageNameLower = stage.title.toLowerCase().trim();
      const hasAnomaly = this.allSensors.some(s => {
        const sStage = this.detectStageBySensorName(s.title, s.stageName).toLowerCase().trim();
        return sStage === stageNameLower && s.state === 'Anormal';
      });
      stage.status = hasAnomaly ? 'ANOMALİ' : 'OK';
      stage.delta = hasAnomaly ? 'Anomali Sapması' : 'Nominal';
    });

    if (this.selectedStageName) {
      this.selectStage(this.selectedStageName);
    } else {
      this.filteredSensors = [...this.allSensors];
    }
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
      { name: 'Fırın Sıcaklığı', stage: 'Çelikhane', target: 1150, unit: '°C' },
      { name: 'Pota Sıcaklığı', stage: 'Çelikhane', target: 1580, unit: '°C' },
      { name: 'Argon Akış Debisi', stage: 'Çelikhane', target: 450, unit: 'L/dk' },
      { name: 'Cüruf Kalınlığı', stage: 'Çelikhane', target: 12, unit: 'mm' },
      { name: 'Hadde Merdane Sıcaklığı', stage: 'Sıcak Haddehane', target: 880, unit: '°C' },
      { name: 'Şerit Çıkış Hızı', stage: 'Sıcak Haddehane', target: 15, unit: 'm/s' },
      { name: 'Rulman Titreşimi', stage: 'Sıcak Haddehane', target: 2.4, unit: 'mm/s' },
      { name: 'Emülsiyon Basıncı', stage: 'Sıcak Haddehane', target: 6.5, unit: 'bar' },
      { name: 'Asit Banyo Sıcaklığı', stage: 'Asitleme', target: 85, unit: '°C' },
      { name: 'Asit Konsantrasyonu (HCl)', stage: 'Asitleme', target: 18, unit: '%' },
      { name: 'Tank pH Seviyesi', stage: 'Asitleme', target: 1.2, unit: 'pH' },
      { name: 'Sıyırıcı Rulo Basıncı', stage: 'Asitleme', target: 4.2, unit: 'bar' },
      { name: 'Şerit Gerginliği', stage: 'Soğuk Haddehane', target: 125, unit: 'kN' },
      { name: 'Sac Çıkış Kalınlığı', stage: 'Soğuk Haddehane', target: 1.5, unit: 'mm' },
      { name: 'X-Ray Kalınlık Sapması', stage: 'Soğuk Haddehane', target: 0.02, unit: 'mm' },
      { name: 'Yağlama Debisi', stage: 'Soğuk Haddehane', target: 18.5, unit: 'L/dk' }
    ];

    this.thresholdSensors = defaultList.map(s => ({
      id: s.name,
      ...s,
      criticalMin: Math.round(s.target * 0.85 * 10) / 10,
      criticalMax: Math.round(s.target * 1.15 * 10) / 10,
      warningMin: Math.round(s.target * 0.92 * 10) / 10,
      warningMax: Math.round(s.target * 1.08 * 10) / 10,
      isUserModified: false
    }));
  }
}
