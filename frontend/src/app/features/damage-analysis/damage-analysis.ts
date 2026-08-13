import { Component, AfterViewInit, ViewChild, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DefectService } from '../../core/services/defect';
import { AuthService } from '../../core/services/auth.service';
import { AnalysisResponseDto, SensorSummaryDto } from '../../core/models/defect.model';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

type StageStatus = 'OK' | 'BEKLEMEDE' | 'ANOMALİ';

interface StageCard { title: string; status: StageStatus; }

interface SensorCard {
  title: string; value: string; unit: string; delta: string; state: string;
  originalState: string; stageName: string; target: number; minLimit: number; maxLimit: number;
  readings: { timeSecond: number; actualValue: number; targetValue: number; minLimit: number; maxLimit: number }[];
}

interface ThresholdSensor {
  id: string; name: string; unit: string; target: number;
  criticalMin: number; criticalMax: number; warningMin: number; warningMax: number;
  stage: string; isUserModified?: boolean;
}

@Component({
  selector: 'app-damage-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './damage-analysis.html',
  styleUrl: '../defect-tracker/defect-tracker.scss',
})
export class DamageAnalysisComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('sensorChartCanvas') sensorChartCanvas!: ElementRef<HTMLCanvasElement>;

  batchId = '';
  isLoading = false;
  isAnalyzed = false;
  errorMessage = '';
  headline = '';
  fromQuality = false;
  autoStarted = false;

  selectedStageName: string | null = null;
  allSensors: SensorCard[] = [];
  filteredSensors: SensorCard[] = [];
  stages: StageCard[] = [];

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

  constructor(
    private defectService: DefectService,
    public auth: AuthService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const coil = params.get('coil');
      const auto = params.get('auto') === '1';
      this.fromQuality = params.get('from') === 'kalite';

      if (coil) {
        this.batchId = coil;
        if (auto || this.fromQuality) {
          this.autoStarted = true;
          this.onStartAnalysis();
        }
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.isAnalyzed && this.filteredSensors.length > 0) {
      this.initChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  onStartAnalysis(): void {
    if (!this.batchId.trim()) return alert('Bobin ID giriniz.');
    this.isLoading = true;
    this.errorMessage = '';
    this.isAnalyzed = false;
    this.selectedStageName = null;
    this.savedThresholds = [];
    this.chart?.destroy();
    this.chart = null;

    const coilId = this.batchId.trim();
    this.defectService.getAnalysis(coilId).subscribe({
      next: (data) => this.applyAnalysis(data),
      error: (err: HttpErrorResponse) => {
        this.errorMessage = this.analysisErrorMessage(err);
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
    this.evidenceList = data.evidenceIndicators?.length ? data.evidenceIndicators : [rc.detectionDetail].filter(Boolean);
    const stage = rc.stageName ?? this.stages.find((s) => s.status === 'ANOMALİ')?.title;
    this.rootCauseEquipment = stage ? `${stage} / ${rc.equipment}` : rc.equipment;
  }

  private analysisErrorMessage(err: HttpErrorResponse): string {
    if (err.status === 403) return 'Hasar analizi için yetkiniz yok.';
    if (err.status === 404) return `Bobin bulunamadı: "${this.batchId.trim()}"`;
    if (err.status === 0) return 'Backend erişilemiyor.';
    return 'Analiz başlatılamadı.';
  }

  selectStage(stageTitle: string | null): void {
    if (!this.isAnalyzed || !stageTitle) return;
    this.selectedStageName = stageTitle;
    this.filteredSensors = this.allSensors.filter((s) => s.stageName === stageTitle).slice(0, 4);
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
        responsive: true, maintainAspectRatio: false,
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
    this.thresholdSensors = this.savedThresholds.length ? structuredClone(this.savedThresholds) : this.buildThresholdsFromSensors();
    this.isThresholdModalOpen = true;
  }

  closeThresholdModal(): void { this.isThresholdModalOpen = false; }

  saveThresholds(): void {
    this.thresholdSensors.forEach((s) => (s.isUserModified = true));
    this.savedThresholds = structuredClone(this.thresholdSensors);
    this.reevaluateWithThresholds();
    this.updateChartData();
    this.closeThresholdModal();
  }

  resetThresholds(): void {
    this.savedThresholds = [];
    this.allSensors.forEach((s) => (s.state = s.originalState));
    this.buildThresholdsFromSensors();
    this.reevaluateWithThresholds();
    this.updateChartData();
  }

  get filteredThresholdSensors(): ThresholdSensor[] {
    return this.thresholdSensors.filter((s) => s.stage === this.activeThresholdStage);
  }

  private buildThresholdsFromSensors(): ThresholdSensor[] {
    this.thresholdSensors = this.allSensors.map((s) => ({
      id: s.title, name: s.title, unit: s.unit, target: s.target,
      criticalMin: s.minLimit, criticalMax: s.maxLimit,
      warningMin: Math.round(s.target * 0.92 * 10) / 10,
      warningMax: Math.round(s.target * 1.08 * 10) / 10,
      stage: s.stageName, isUserModified: false,
    }));
    return this.thresholdSensors;
  }

  private reevaluateWithThresholds(): void {
    const thresholds = this.savedThresholds.length ? this.savedThresholds : this.thresholdSensors;
    this.allSensors.forEach((sensor) => {
      const t = thresholds.find((x) => x.name === sensor.title);
      if (!t) { sensor.state = sensor.originalState; return; }
      const values = sensor.readings.length ? sensor.readings.map((r) => r.actualValue) : [Number(sensor.value)];
      sensor.state = values.some((v) => v < t.criticalMin || v > t.criticalMax) ? 'Anormal' : t.isUserModified ? 'Normal' : sensor.originalState;
    });
    this.stages.forEach((stage) => {
      stage.status = this.allSensors.some((s) => s.stageName === stage.title && s.state === 'Anormal') ? 'ANOMALİ' : 'OK';
    });
    if (this.selectedStageName) {
      this.filteredSensors = this.allSensors.filter((s) => s.stageName === this.selectedStageName).slice(0, 4);
    }
  }
}
