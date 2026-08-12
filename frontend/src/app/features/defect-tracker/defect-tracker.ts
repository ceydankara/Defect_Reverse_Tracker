import { Component, AfterViewInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DefectService } from '../../core/services/defect';
import { AnalysisResponseDto, SensorSummaryDto } from '../../core/models/defect.model';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

type StageStatus = 'OK' | 'BEKLEMEDE' | 'ANOMALİ';

interface StageCard {
  title: string;
  status: StageStatus;
}

interface SensorCard {
  title: string;
  value: string;
  unit: string;
  delta: string;
  state: string;
  originalState: string;
  stageName: string;
  target: number;
  minLimit: number;
  maxLimit: number;
  readings: { timeSecond: number; actualValue: number; targetValue: number; minLimit: number; maxLimit: number }[];
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
  styleUrl: './defect-tracker.scss',
})
export class DefectTrackerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sensorChartCanvas') sensorChartCanvas!: ElementRef<HTMLCanvasElement>;

  isFormSubmitted = false;
  ticketNumber = '';
  reporterName = '';
  department = '';
  batchId = '';
  detectedLocation = 'Üretim Hattı';
  defectType = '';
  extraNotes = '';

  isLoading = false;
  isAnalyzed = false;
  errorMessage = '';
  headline = '';

  selectedStageName: string | null = null;
  allSensors: SensorCard[] = [];
  filteredSensors: SensorCard[] = [];
  stages: StageCard[] = [
    { title: 'Çelikhane', status: 'BEKLEMEDE' },
    { title: 'Sıcak Haddehane', status: 'BEKLEMEDE' },
    { title: 'Asitleme', status: 'BEKLEMEDE' },
    { title: 'Soğuk Haddehane', status: 'BEKLEMEDE' },
  ];

  rootCauseEquipment = '';
  productionImpact = 0;
  logisticImpact = 0;
  evidenceList: string[] = [];
  recommendedAction = '';

  isThresholdModalOpen = false;
  activeThresholdStage = 'Çelikhane';
  thresholdSensors: ThresholdSensor[] = [];
  savedThresholds: ThresholdSensor[] = [];

  chart: Chart<'line'> | null = null;
  selectedSensorTitle = '';
  selectedSensorStage = '';

  constructor(private defectService: DefectService) {}

  ngAfterViewInit(): void {
    if (this.isAnalyzed && this.filteredSensors.length > 0) {
      this.initChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  selectDefectType(type: string): void {
    this.defectType = type;
  }

  onSubmitTicketAndStartAnalysis(): void {
    if (!this.reporterName.trim()) return alert('Lütfen Ad Soyad alanını doldurunuz!');
    if (!this.department.trim()) return alert('Lütfen Departman seçiniz!');
    if (!this.batchId.trim()) return alert('Lütfen Bobin ID giriniz!');
    if (!this.defectType.trim()) return alert('Lütfen bir Hasar Türü seçiniz!');

    this.isLoading = true;
    this.defectService
      .createTicket({
        reporterName: this.reporterName,
        department: this.department,
        batchId: this.batchId.trim(),
        detectedLocation: this.detectedLocation,
        defectType: this.defectType,
        extraNotes: this.extraNotes,
      })
      .subscribe({
        next: (ticket) => {
          this.ticketNumber = ticket.ticketNumber;
          this.isFormSubmitted = true;
          this.onStartAnalysis();
        },
        error: () => {
          this.isLoading = false;
          alert('Talep kaydedilemedi. Backend servisinin çalıştığından emin olun.');
        },
      });
  }

  openNewTicketForm(): void {
    this.isFormSubmitted = false;
    this.isAnalyzed = false;
    this.errorMessage = '';
    this.batchId = '';
    this.defectType = '';
    this.extraNotes = '';
    this.chart?.destroy();
    this.chart = null;
  }

  onStartAnalysis(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.selectedStageName = null;
    this.savedThresholds = [];

    this.defectService.getAnalysis(this.batchId.trim()).subscribe({
      next: (data) => this.applyAnalysis(data),
      error: () => {
        this.errorMessage = 'Bobin bulunamadı veya backend erişilemiyor. Demo: BOBIN-2026-9041';
        this.isAnalyzed = false;
        this.isLoading = false;
      },
    });
  }

  private applyAnalysis(data: AnalysisResponseDto): void {
    if (!data?.sensorSummaries?.length) {
      this.errorMessage = 'Bobin bulundu ancak sensör verisi yok.';
      this.isLoading = false;
      return;
    }

    this.defectType = data.defectCode || this.defectType;
    this.headline = data.headline || '';

    this.stages = (data.stages ?? []).map((s) => ({
      title: s.stageName,
      status: (s.status === 'ANOMALI' ? 'ANOMALİ' : 'OK') as StageStatus,
    }));

    this.allSensors = data.sensorSummaries.map((s) => this.toSensorCard(s));
    this.buildThresholdsFromSensors();
    this.applyRootCause(data);

    this.isAnalyzed = true;
    this.isLoading = false;

    const anomalyStage = this.stages.find((s) => s.status === 'ANOMALİ');
    this.selectStage(anomalyStage?.title ?? this.stages[0]?.title ?? null);
  }

  private toSensorCard(s: SensorSummaryDto): SensorCard {
    const anomali = s.status === 'ANOMALI';
    return {
      title: s.sensorKey,
      value: String(s.lastActualValue ?? 0),
      unit: s.unit || '',
      delta: `${(s.percentageDeviation ?? 0) > 0 ? '+' : ''}${s.percentageDeviation ?? 0}%`,
      state: anomali ? 'Anormal' : 'Normal',
      originalState: anomali ? 'Anormal' : 'Normal',
      stageName: s.stageName,
      target: Number(s.targetValue ?? 0),
      minLimit: Number(s.minLimit ?? 0),
      maxLimit: Number(s.maxLimit ?? 0),
      readings: (s.readings ?? []).map((r) => ({
        timeSecond: r.timeSecond,
        actualValue: Number(r.actualValue),
        targetValue: Number(r.targetValue),
        minLimit: Number(r.minLimit),
        maxLimit: Number(r.maxLimit),
      })),
    };
  }

  private applyRootCause(data: AnalysisResponseDto): void {
    const rc = data.rootCause;
    if (!rc) return;

    this.productionImpact = rc.productionImpactPct ?? 0;
    this.logisticImpact = rc.logisticImpactPct ?? 0;
    this.recommendedAction = rc.recommendedAction ?? '';
    this.evidenceList = data.evidenceIndicators?.length
      ? data.evidenceIndicators
      : [rc.detectionDetail].filter(Boolean);

    const stage = rc.stageName ?? this.stages.find((s) => s.status === 'ANOMALİ')?.title;
    this.rootCauseEquipment = stage ? `${stage} / ${rc.equipment}` : rc.equipment;
  }

  selectStage(stageTitle: string | null): void {
    if (!this.isAnalyzed || !stageTitle) return;

    this.selectedStageName = stageTitle;
    this.filteredSensors = this.allSensors
      .filter((s) => s.stageName === stageTitle)
      .slice(0, 4);

    if (this.filteredSensors.length > 0) {
      setTimeout(() => {
        if (!this.chart) this.initChart();
        this.onSelectSensorCard(this.filteredSensors[0]);
      }, 50);
    }
  }

  onSelectSensorCard(sensor: SensorCard): void {
    this.selectedSensorTitle = sensor.title;
    this.selectedSensorStage = sensor.stageName;
    if (!this.chart) this.initChart();
    this.updateChartData();
  }

  private initChart(): void {
    if (!this.sensorChartCanvas) return;
    const ctx = this.sensorChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chart?.destroy();
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'Gerçek', data: [], borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 2, tension: 0.35, fill: true, pointRadius: 0 },
          { label: 'Hedef', data: [], borderColor: '#38bdf8', borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0 },
          { label: 'Alt Limit', data: [], borderColor: '#dc2626', borderDash: [5, 5], borderWidth: 1, pointRadius: 0 },
          { label: 'Üst Limit', data: [], borderColor: '#dc2626', borderDash: [5, 5], borderWidth: 1, pointRadius: 0 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
        },
      },
    });
  }

  updateChartData(): void {
    if (!this.chart || !this.selectedSensorTitle) return;

    const sensor = this.allSensors.find((s) => s.title === this.selectedSensorTitle);
    if (!sensor) return;

    const readings = sensor.readings;
    const labels = readings.length ? readings.map((r) => String(r.timeSecond)) : Array.from({ length: 19 }, (_, i) => String(i * 10));
    const realData = readings.length ? readings.map((r) => r.actualValue) : Array(labels.length).fill(Number(sensor.value));
    const targetVal = sensor.target || Number(sensor.value);
    const critMin = sensor.minLimit || targetVal * 0.85;
    const critMax = sensor.maxLimit || targetVal * 1.15;
    const isAnomali = sensor.state === 'Anormal';

    const [actual, target, minDs, maxDs] = this.chart.data.datasets;
    this.chart.data.labels = labels;
    actual.data = realData;
    (actual as any).borderColor = isAnomali ? '#ef4444' : '#10b981';
    (actual as any).backgroundColor = isAnomali ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)';
    target.data = Array(realData.length).fill(targetVal);
    minDs.data = Array(realData.length).fill(critMin);
    maxDs.data = Array(realData.length).fill(critMax);
    this.chart.update();
  }

  openThresholdModal(): void {
    if (this.savedThresholds.length) {
      this.thresholdSensors = structuredClone(this.savedThresholds);
    } else {
      this.buildThresholdsFromSensors();
    }
    this.isThresholdModalOpen = true;
  }

  closeThresholdModal(): void {
    this.isThresholdModalOpen = false;
  }

  saveThresholds(): void {
    this.thresholdSensors.forEach((s) => (s.isUserModified = true));
    this.savedThresholds = structuredClone(this.thresholdSensors);
    this.reevaluateWithThresholds();
    this.updateChartData();
    alert('Alarm eşikleri güncellendi.');
    this.closeThresholdModal();
  }

  resetThresholds(): void {
    this.savedThresholds = [];
    this.allSensors.forEach((s) => (s.state = s.originalState));
    this.buildThresholdsFromSensors();
    this.reevaluateWithThresholds();
    this.updateChartData();
    alert('Eşikler sıfırlandı.');
  }

  get filteredThresholdSensors(): ThresholdSensor[] {
    return this.thresholdSensors.filter((s) => s.stage === this.activeThresholdStage);
  }

  private buildThresholdsFromSensors(): void {
    this.thresholdSensors = this.allSensors.map((s) => ({
      id: s.title,
      name: s.title,
      unit: s.unit,
      target: s.target,
      criticalMin: s.minLimit,
      criticalMax: s.maxLimit,
      warningMin: Math.round(s.target * 0.92 * 10) / 10,
      warningMax: Math.round(s.target * 1.08 * 10) / 10,
      stage: s.stageName,
      isUserModified: false,
    }));
  }

  private reevaluateWithThresholds(): void {
    const thresholds = this.savedThresholds.length ? this.savedThresholds : this.thresholdSensors;

    this.allSensors.forEach((sensor) => {
      const t = thresholds.find((x) => x.name === sensor.title);
      if (!t) {
        sensor.state = sensor.originalState;
        return;
      }
      const values = sensor.readings.length ? sensor.readings.map((r) => r.actualValue) : [Number(sensor.value)];
      const outOfBounds = values.some((v) => v < t.criticalMin || v > t.criticalMax);
      sensor.state = outOfBounds ? 'Anormal' : t.isUserModified ? 'Normal' : sensor.originalState;
    });

    this.stages.forEach((stage) => {
      const hasAnomaly = this.allSensors.some((s) => s.stageName === stage.title && s.state === 'Anormal');
      stage.status = hasAnomaly ? 'ANOMALİ' : 'OK';
    });

    if (this.selectedStageName) {
      this.filteredSensors = this.allSensors.filter((s) => s.stageName === this.selectedStageName).slice(0, 4);
    }
  }
}
