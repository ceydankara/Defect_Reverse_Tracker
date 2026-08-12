import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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
  detectedLocation: string = 'Üretim Hattı';
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

  private defaultTargets: { [key: string]: number } = {
    'Fırın Sıcaklığı': 1150,
    'Pota Sıcaklığı': 1580,
    'Argon Akış Debisi': 450,
    'Cüruf Kalınlığı': 12,
    'Hadde Merdane Sıcaklığı': 880,
    'Şerit Çıkış Hızı': 15,
    'Rulman Titreşimi': 2.4,
    'Emülsiyon Basıncı': 6.5,
    'Asit Banyo Sıcaklığı': 85,
    'Asit Konsantrasyonu (HCl)': 18,
    'Tank pH Seviyesi': 1.2,
    'Sıyırıcı Rulo Basıncı': 4.2,
    'Merdane Kuvveti': 10,
    'Şerit Gerginliği': 125,
    'Rulman Sıcaklığı': 60,
    'Emülsiyon Debisi': 280
  };

  constructor(
    private defectService: DefectService,
    private http: HttpClient
  ) {}

  ngAfterViewInit(): void {
    if (this.isAnalyzed && this.filteredSensors.length > 0) {
      this.initChart();
    }
  }

  selectDefectType(type: string): void {
    this.defectType = type;
  }

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

    this.isLoading = true;

    const payload = {
      reporterName: this.reporterName,
      department: this.department,
      batchId: this.batchId,
      detectedLocation: this.detectedLocation,
      defectType: this.defectType,
      extraNotes: this.extraNotes
    };

    this.http.post<any>('http://localhost:8080/api/tickets', payload).subscribe({
      next: (savedTicket) => {
        this.ticketNumber = savedTicket.ticketNumber;
        this.isFormSubmitted = true;
        this.onStartAnalysis();
      },
      error: (err) => {
        console.error('Veritabanına kayıt atılırken hata oluştu:', err);
        this.isLoading = false;
        alert('Talep veritabanına kaydedilemedi! Lütfen Backend servisinizin çalıştığından emin olun.');
      }
    });
  }

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
            value: `4 sensör`,
            delta: s.status === 'ANOMALI' ? 'Anomali Sapması' : 'Nominal'
          }));
        }

        // 2. Sensörler
        if (data.sensorSummaries && data.sensorSummaries.length > 0) {
          const colors: ('amber' | 'cyan' | 'violet' | 'teal')[] = ['amber', 'cyan', 'violet', 'teal'];

          this.allSensors = data.sensorSummaries.map((s, index) => {
            const isAnomali = s.status === 'ANOMALI';

            // GÜVENLİ ZAMAN SERİSİ ÇEKİMİ
            let seriesData = (s as any).readings || (s as any).timeSeries || [];
            if (data.timeSeriesData && data.timeSeriesData.length > 0) {
              const matchedPoints = data.timeSeriesData.filter(ts => ts.sensorKey === s.sensorKey);
              if (matchedPoints.length > 0) {
                seriesData = matchedPoints;
              }
            }

            return {
              title: s.sensorKey,
              value: s.lastActualValue !== undefined && s.lastActualValue !== null ? s.lastActualValue.toString() : '0',
              unit: (s as any).unit || 'değer',
              delta: `${s.percentageDeviation && s.percentageDeviation > 0 ? '+' : ''}${s.percentageDeviation || 0}%`,
              state: isAnomali ? 'Anormal' : 'Normal',
              originalState: isAnomali ? 'Anormal' : 'Normal',
              stageName: (s as any).stageName,
              spark: colors[index % colors.length],
              timeSeries: seriesData
            };
          });

          this.isAnalyzed = true;
          this.isLoading = false;

          this.syncThresholdSensorsWithAllSensors();

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

        // 3. Kök Neden Analizi
        if (data.rootCause) {
          const hasAnyStageAnomaly = this.stages.some(s => s.status === 'ANOMALİ');

          if (!hasAnyStageAnomaly) {
            this.productionImpact = 10;
            this.logisticImpact = 90;
            this.rootCauseEquipment = 'Lojistik & Dış Etken / Depo - Nakliye Hattı';
            this.recommendedAction = 'Müşteri sevkiyat kayıtlarını, forklift elleçleme raporlarını denetleyin.';
            this.evidenceList = [
              'Üretim hattındaki tüm sensör verileri nominal limitler dahilindedir.',
              'Etki Dağılımı: Üretim %10 | Lojistik %90 (Lojistik Ağırlıklı Hasar)',
              'Tesis içi üretim süreçlerinde herhangi bir tolerans aşımı tespit edilmemiştir.'
            ];
          } else {
            const anomalousSensor = this.allSensors.find(s => s.state === 'Anormal');
            let deviationPct = 0;
            if (anomalousSensor && anomalousSensor.delta) {
              deviationPct = Math.abs(parseFloat(anomalousSensor.delta.replace('%', '').replace('+', ''))) || 0;
            }

            if (deviationPct <= 0) {
              this.productionImpact = 50;
            } else if (deviationPct <= 15) {
              this.productionImpact = Math.round(50 + (deviationPct * 1.33));
            } else if (deviationPct <= 50) {
              this.productionImpact = Math.round(70 + ((deviationPct - 15) * 0.51));
            } else {
              this.productionImpact = Math.min(99, Math.round(88 + Math.log10(deviationPct - 49) * 4.5));
            }

            this.logisticImpact = 100 - this.productionImpact;

            const stageName = (data.rootCause as any).stageName || (this.stages.find(s => s.status === 'ANOMALİ')?.title) || 'Üretim Hattı';
            const equipmentName = data.rootCause.equipment || 'Ekipman';

            this.rootCauseEquipment = `${stageName} / ${equipmentName}`;
            this.recommendedAction = data.rootCause.recommendedAction || 'Bakım ekibini ilgili hatta yönlendirin.';

            this.evidenceList = [
              data.rootCause.detectionDetail || `${stageName} aşamasında ${equipmentName} cihazında tolerans dışı sapma tespit edildi.`,
              `Hesaplanan Sapma Şiddeti: %${deviationPct} -> Etki Dağılımı: Üretim %${this.productionImpact} | Lojistik %${this.logisticImpact}`
            ];
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
          return sKey.includes('fırın') || sKey.includes('pota') || sKey.includes('argon') || sKey.includes('cüruf');
        } else if (titleLower.includes('sıcak')) {
          return sKey.includes('merdane') || sKey.includes('şerit') || sKey.includes('rulman') || sKey.includes('emülsiyon') || sKey.includes('hız') || sKey.includes('basınç');
        } else if (titleLower.includes('asitleme')) {
          return sKey.includes('asit') || sKey.includes('tank') || sKey.includes('ph') || sKey.includes('sıyırıcı');
        } else if (titleLower.includes('soğuk')) {
          return sKey.includes('gerginlik') || sKey.includes('sac') || sKey.includes('x-ray') || sKey.includes('yağlama') || sKey.includes('kuvvet') || sKey.includes('sıcaklık') || sKey.includes('debi');
        }
        return sKey.includes(titleLower);
      });
    }

    this.filteredSensors = matches.slice(0, 4);

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
            label: 'Kritik Alt Limit',
            data: [],
            borderColor: '#dc2626',
            borderDash: [5, 5],
            borderWidth: 1.5,
            pointRadius: 0
          },
          {
            label: 'Kritik Üst Limit',
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

  // GRAFİK DİZİSİNİ DÜZELTEN METOD
  updateChartData(): void {
    if (!this.chart || !this.selectedSensorTitle) return;

    const activeSensor = this.allSensors.find(s => s.title === this.selectedSensorTitle);
    if (!activeSensor) return;

    const val = parseFloat(activeSensor.value) || 0;
    const matchThreshold = (this.savedThresholds.length > 0 ? this.savedThresholds : this.thresholdSensors)
      .find(t => t.name === this.selectedSensorTitle || t.id === this.selectedSensorTitle);

    let targetVal = matchThreshold ? Number(matchThreshold.target) : (this.defaultTargets[this.selectedSensorTitle] || 100);

    let critMin = matchThreshold ? Number(matchThreshold.criticalMin) : Math.round(targetVal * 0.85 * 10) / 10;
    let critMax = matchThreshold ? Number(matchThreshold.criticalMax) : Math.round(targetVal * 1.15 * 10) / 10;

    let realData: number[] = [];

    // Zaman serisini düzgün map etme (Sayı mı Obje mi Kontrolü)
    if (activeSensor.timeSeries && activeSensor.timeSeries.length > 0) {
      realData = activeSensor.timeSeries.map((item: any) => {
        if (typeof item === 'number') return item;
        if (item && item.actualValue !== undefined && item.actualValue !== null) return Number(item.actualValue);
        if (item && item.value !== undefined && item.value !== null) return Number(item.value);
        return 0;
      });
    }

    // Eğer seri boş geldiyse düz çizgi çekmek yerine en azından noktayı koy
    if (realData.length === 0) {
      realData = Array(19).fill(val);
    }

    const isUpperViolated = realData.some(v => v > critMax);
    const isLowerViolated = realData.some(v => v < critMin);
    const isGraphAnomalous = isUpperViolated || isLowerViolated || activeSensor.state === 'Anormal';

    const datasets = this.chart.data.datasets;

    if (datasets && datasets.length >= 4) {
      datasets[0].data = realData;
      (datasets[0] as any).borderColor = isGraphAnomalous ? '#ef4444' : '#10b981';
      (datasets[0] as any).backgroundColor = isGraphAnomalous ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)';

      datasets[1].data = Array(realData.length).fill(targetVal);

      if (isLowerViolated || (!isUpperViolated && !isLowerViolated)) {
        datasets[2].data = Array(realData.length).fill(critMin);
      } else {
        datasets[2].data = [];
      }

      if (isUpperViolated || (!isUpperViolated && !isLowerViolated)) {
        datasets[3].data = Array(realData.length).fill(critMax);
      } else {
        datasets[3].data = [];
      }
    }

    this.chart.update();
  }

  openThresholdModal(): void {
    if (this.savedThresholds && this.savedThresholds.length > 0) {
      this.thresholdSensors = JSON.parse(JSON.stringify(this.savedThresholds));
    } else if (this.allSensors && this.allSensors.length > 0) {
      this.thresholdSensors = this.allSensors.map(sensor => {
        const targetVal = this.defaultTargets[sensor.title] || parseFloat(sensor.value) || 100;

        return {
          id: sensor.title,
          name: sensor.title,
          unit: sensor.unit || 'değer',
          target: targetVal,
          criticalMin: Math.round(targetVal * 0.85 * 10) / 10,
          criticalMax: Math.round(targetVal * 1.15 * 10) / 10,
          warningMin: Math.round(targetVal * 0.92 * 10) / 10,
          warningMax: Math.round(targetVal * 1.08 * 10) / 10,
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
    this.thresholdSensors.forEach(s => s.isUserModified = true);
    this.savedThresholds = JSON.parse(JSON.stringify(this.thresholdSensors));

    this.reevaluateSensorsAndStagesWithThresholds();
    this.updateChartData();

    alert('Alarm eşikleri güncellendi ve tüm sensörler yeniden değerlendirildi!');
    this.closeThresholdModal();
  }

  resetThresholds(): void {
    this.savedThresholds = [];
    if (this.allSensors && this.allSensors.length > 0) {
      this.allSensors.forEach(s => s.state = s.originalState);
    }
    this.syncThresholdSensorsWithAllSensors();
    this.reevaluateSensorsAndStagesWithThresholds();
    this.updateChartData();
    alert('Tüm sensör eşikleri sıfırlandı.');
  }

  private reevaluateSensorsAndStagesWithThresholds(): void {
    if (!this.allSensors || this.allSensors.length === 0) return;

    const thresholdList = this.savedThresholds.length > 0 ? this.savedThresholds : this.thresholdSensors;

    this.allSensors.forEach(sensor => {
      const matchThreshold = thresholdList.find(t => t.id === sensor.title || t.name === sensor.title);

      if (matchThreshold) {
        const critMin = Number(matchThreshold.criticalMin);
        const critMax = Number(matchThreshold.criticalMax);

        let points: number[] = [];
        if (sensor.timeSeries && sensor.timeSeries.length > 0) {
          points = sensor.timeSeries.map((item: any) =>
            typeof item === 'number' ? item : (item.actualValue !== undefined ? Number(item.actualValue) : Number(item.value || 0))
          );
        } else {
          points = [parseFloat(sensor.value) || 0];
        }

        const hasAnomalyPoint = points.some(val => val < critMin || val > critMax);

        if (hasAnomalyPoint) {
          sensor.state = 'Anormal';
        } else {
          if (!matchThreshold.isUserModified && sensor.originalState === 'Anormal') {
            sensor.state = 'Anormal';
          } else {
            sensor.state = 'Normal';
          }
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

  private syncThresholdSensorsWithAllSensors(): void {
    if (this.allSensors && this.allSensors.length > 0) {
      this.openThresholdModal();
      this.isThresholdModalOpen = false;
    }
  }

  private detectStageBySensorName(title: string, stageName?: string): string {
    if (stageName) return stageName;
    const s = title.toLowerCase();
    if (s.includes('fırın') || s.includes('pota') || s.includes('argon') || s.includes('cüruf')) return 'Çelikhane';
    if (s.includes('merdane') || s.includes('şerit') || s.includes('rulman') || s.includes('emülsiyon')) return 'Sıcak Haddehane';
    if (s.includes('asit') || s.includes('tank') || s.includes('ph') || s.includes('sıyırıcı')) return 'Asitleme';
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

      { name: 'Merdane Kuvveti', stage: 'Soğuk Haddehane', target: 10, unit: 'kN' },
      { name: 'Şerit Gerginliği', stage: 'Soğuk Haddehane', target: 125, unit: 'kN' },
      { name: 'Rulman Sıcaklığı', stage: 'Soğuk Haddehane', target: 60, unit: '°C' },
      { name: 'Emülsiyon Debisi', stage: 'Soğuk Haddehane', target: 280, unit: 'L/dk' }
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
