import { Component, AfterViewInit, ViewChild, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DefectService } from '../../core/services/defect';
import { AuthService } from '../../core/services/auth.service';
import { ThresholdProfileService } from '../../core/services/threshold-profile.service';
import { ThresholdPresetService, SensorSource, DEFAULT_SENSOR_CATALOG } from '../../core/services/threshold-preset.service';
import { AnalysisResponseDto, ClassificationType, SensorSummaryDto } from '../../core/models/defect.model';
import { ThresholdSensor } from '../../core/models/threshold.model';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

type StageStatus = 'OK' | 'BEKLEMEDE' | 'ANOMALİ';

interface StageCard { title: string; status: StageStatus; }

interface SensorCard {
  title: string; value: string; unit: string; delta: string; state: string;
  originalState: string; thresholdAlarm: boolean; stageName: string;
  target: number; minLimit: number; maxLimit: number;
  warningMin: number; warningMax: number;
  readings: { timeSecond: number; actualValue: number; targetValue: number; minLimit: number; maxLimit: number }[];
}

@Component({
  selector: 'app-damage-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './damage-analysis.html',
  styleUrl: './damage-analysis.scss',
})
export class DamageAnalysisComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('sensorChartCanvas') sensorChartCanvas!: ElementRef<HTMLCanvasElement>;

  batchId = '';
  isLoading = false;
  isAnalyzed = false;
  errorMessage = '';
  headline = '';
  fromQuality = false;
  fromFieldCase = false;
  returnTicket = '';
  autoStarted = false;
  currentSteelGrade = '';
  selectedSteelGrade = '';
  selectedGradePresetLabel = '';
  availableSteelGrades: string[] = [];
  thresholdSaveMessage = '';

  selectedStageName: string | null = null;
  allSensors: SensorCard[] = [];
  filteredSensors: SensorCard[] = [];
  stages: StageCard[] = [];
  backendStages: StageCard[] = [];
  classificationType: ClassificationType = 'LOGISTICS';

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
    private thresholdProfiles: ThresholdProfileService,
    private thresholdPresets: ThresholdPresetService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const coil = params.get('coil');
      const auto = params.get('auto') === '1';
      this.fromQuality = params.get('from') === 'kalite';
      this.fromFieldCase = params.get('from') === 'saha';
      this.returnTicket = params.get('ticket') ?? '';

      if (coil) {
        this.batchId = coil;
        if (auto || this.fromQuality || this.fromFieldCase) {
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

  fieldCaseReturnQueryParams(): Record<string, string> {
    if (!this.returnTicket) return {};
    return { ticket: this.returnTicket };
  }

  qualityReturnQueryParams(): Record<string, string> {
    const params: Record<string, string> = { status: 'all' };
    if (this.returnTicket) params['ticket'] = this.returnTicket;
    if (this.batchId.trim()) params['coil'] = this.batchId.trim();
    return params;
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
    if (data.dataAvailable === false || !data?.sensorSummaries?.length) {
      this.errorMessage = data.dataStatusMessage
        ?? data.headline
        ?? 'Bobin bulundu ancak sensör verisi yok. Üretim/lojistik ayrımı yapılamaz.';
      this.isLoading = false;
      return;
    }

    this.headline = data.headline || '';
    this.currentSteelGrade = data.steelGrade || 'DX51D';
    this.availableSteelGrades = this.thresholdProfiles.listAvailableGrades(this.currentSteelGrade);
    this.stages = (data.stages ?? []).map((s) => ({
      title: s.stageName,
      status: (s.status === 'ANOMALI' ? 'ANOMALİ' : 'OK') as StageStatus,
    }));
    this.backendStages = this.stages.map((s) => ({ ...s }));
    this.classificationType = data.classificationType ?? 'LOGISTICS';
    this.allSensors = data.sensorSummaries.map((s) => this.toSensorCard(s));
    this.applyThresholdsForCurrentGrade();
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
      thresholdAlarm: false,
      stageName: s.stageName,
      target: Number(s.targetValue ?? 0),
      minLimit: Number(s.minLimit ?? 0),
      maxLimit: Number(s.maxLimit ?? 0),
      warningMin: Number(s.minLimit ?? 0),
      warningMax: Number(s.maxLimit ?? 0),
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
    const stage = rc.stageName ?? this.backendStages.find((s) => s.status === 'ANOMALİ')?.title;
    this.rootCauseEquipment = stage ? `${stage} / ${rc.equipment}` : rc.equipment;
  }

  isProductionAnomaly(sensor: SensorCard): boolean {
    return sensor.originalState === 'Anormal';
  }

  isThresholdAlarm(sensor: SensorCard): boolean {
    return sensor.thresholdAlarm;
  }

  hasThresholdAlarmsOnly(): boolean {
    return this.classificationType === 'LOGISTICS'
      && this.allSensors.some((s) => s.thresholdAlarm);
  }

  private analysisErrorMessage(err: HttpErrorResponse): string {
    if (err.status === 403) return 'Hasar analizi için yetkiniz yok.';
    if (err.status === 404) {
      return `Bobin bulunamadı: "${this.batchId.trim()}". Sensör verisi olmadan analiz yapılamaz.`;
    }
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
          { label: 'Hedef (normal)', data: [], borderColor: '#2563eb', borderDash: [6, 4], borderWidth: 2, pointRadius: 0 },
          { label: 'Kritik Alt', data: [], borderColor: '#dc2626', borderDash: [6, 4], borderWidth: 2, pointRadius: 0 },
          { label: 'Kritik Üst', data: [], borderColor: '#dc2626', borderDash: [6, 4], borderWidth: 2, pointRadius: 0 },
          { label: 'Uyarı Alt', data: [], borderColor: '#f59e0b', borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0 },
          { label: 'Uyarı Üst', data: [], borderColor: '#f59e0b', borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(21,32,51,0.08)' }, ticks: { color: '#728095' } },
          y: { grid: { color: 'rgba(21,32,51,0.08)' }, ticks: { color: '#728095' } },
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

    const active = this.getActiveThreshold(sensor.title);
    const targetVal = active?.target ?? sensor.target ?? Number(sensor.value);
    const critMin = active?.criticalMin ?? sensor.minLimit ?? targetVal * 0.85;
    const critMax = active?.criticalMax ?? sensor.maxLimit ?? targetVal * 1.15;
    const warnMin = active?.warningMin ?? sensor.warningMin ?? critMin;
    const warnMax = active?.warningMax ?? sensor.warningMax ?? critMax;

    const dataMin = realData.length ? Math.min(...realData) : Number(sensor.value);
    const dataMax = realData.length ? Math.max(...realData) : Number(sensor.value);
    const yMin = Math.min(critMin, warnMin, dataMin, targetVal) * 0.92;
    const yMax = Math.max(critMax, warnMax, dataMax, targetVal) * 1.08;

    const isAnomali = this.isProductionAnomaly(sensor) || sensor.thresholdAlarm;
    const [actual, target, minDs, maxDs, warnMinDs, warnMaxDs] = this.chart.data.datasets;
    this.chart.data.labels = labels;
    actual.data = realData;
    (actual as any).borderColor = isAnomali ? '#ef4444' : '#10b981';
    (actual as any).backgroundColor = isAnomali ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)';
    target.data = Array(realData.length).fill(targetVal);
    minDs.data = Array(realData.length).fill(critMin);
    maxDs.data = Array(realData.length).fill(critMax);
    if (warnMinDs) warnMinDs.data = Array(realData.length).fill(warnMin);
    if (warnMaxDs) warnMaxDs.data = Array(realData.length).fill(warnMax);

    if (this.chart.options.scales?.['y']) {
      this.chart.options.scales['y'].min = yMin;
      this.chart.options.scales['y'].max = yMax;
    }

    this.chart.update();
  }

  private getActiveThreshold(sensorName: string): ThresholdSensor | null {
    const list = this.savedThresholds.length ? this.savedThresholds : this.thresholdSensors;
    return list.find((t) => t.name === sensorName) ?? null;
  }

  openThresholdModal(): void {
    this.thresholdSaveMessage = '';
    this.selectedSteelGrade = this.currentSteelGrade || 'DX51D';
    this.availableSteelGrades = this.thresholdProfiles.listAvailableGrades(this.currentSteelGrade);
    this.loadThresholdEditorForGrade(this.selectedSteelGrade);
    this.isThresholdModalOpen = true;
  }

  closeThresholdModal(): void {
    this.isThresholdModalOpen = false;
    this.thresholdSaveMessage = '';
  }

  onSteelGradeChange(): void {
    this.applyAutoPresetsForGrade(this.selectedSteelGrade);
  }

  selectThresholdStage(stage: string): void {
    this.activeThresholdStage = stage;
  }

  saveThresholds(): void {
    if (!this.selectedSteelGrade) return;
    this.thresholdSensors = this.thresholdSensors.map((s) => {
      const normalized = this.thresholdPresets.normalizeThreshold(s);
      return { ...normalized, isUserModified: true };
    });
    this.thresholdProfiles.saveProfile(this.selectedSteelGrade, this.thresholdSensors);
    if (this.selectedSteelGrade === this.currentSteelGrade) {
      this.syncActiveThresholdsToAnalysis();
    }
    this.thresholdSaveMessage = `${this.selectedSteelGrade} profili kaydedildi (eşikler hedefe göre düzenlendi).`;
    setTimeout(() => {
      if (this.thresholdSaveMessage.includes('kaydedildi')) this.thresholdSaveMessage = '';
    }, 2500);
  }

  onThresholdFieldChange(sensor: ThresholdSensor): void {
    const idx = this.thresholdSensors.findIndex((s) => s.id === sensor.id);
    if (idx < 0) return;
    this.thresholdSensors[idx] = this.thresholdPresets.normalizeThreshold(sensor);
  }

  isThresholdInvalid(sensor: ThresholdSensor): boolean {
    return !this.thresholdPresets.isThresholdValid(sensor);
  }

  resetThresholds(): void {
    if (!this.selectedSteelGrade) return;
    this.thresholdProfiles.deleteProfile(this.selectedSteelGrade);
    this.applyAutoPresetsForGrade(this.selectedSteelGrade);
    if (this.selectedSteelGrade === this.currentSteelGrade) {
      this.syncActiveThresholdsToAnalysis();
    }
    this.thresholdSaveMessage = `${this.selectedSteelGrade} otomatik eşiklere döndürüldü.`;
  }

  get thresholdStages(): string[] {
    const stages = [...new Set(this.thresholdSensors.map((s) => s.stage))];
    return stages.length ? stages : ['Çelikhane', 'Sıcak Haddehane', 'Asitleme', 'Soğuk Haddehane'];
  }

  get filteredThresholdSensors(): ThresholdSensor[] {
    return this.thresholdSensors.filter((s) => s.stage === this.activeThresholdStage);
  }

  get hasSavedProfileForSelectedGrade(): boolean {
    return !!this.thresholdProfiles.getProfile(this.selectedSteelGrade);
  }

  zoneWidth(sensor: ThresholdSensor, from: number, to: number): number {
    const span = sensor.criticalMax - sensor.criticalMin;
    if (span <= 0) return 0;
    return Math.max(0, Math.min(100, ((to - from) / span) * 100));
  }

  zoneOffset(sensor: ThresholdSensor, from: number): number {
    const span = sensor.criticalMax - sensor.criticalMin;
    if (span <= 0) return 0;
    return Math.max(0, Math.min(100, ((from - sensor.criticalMin) / span) * 100));
  }

  private loadThresholdEditorForGrade(grade: string): void {
    const normalized = grade.trim().toUpperCase();
    this.selectedGradePresetLabel = this.thresholdPresets.getPresetLabel(normalized);
    const saved = this.thresholdProfiles.getProfile(normalized);

    if (saved?.sensors?.length) {
      this.thresholdSensors = saved.sensors.map((s) => this.thresholdPresets.normalizeThreshold(s));
    } else {
      this.applyAutoPresetsForGrade(normalized, false);
    }

    if (!this.thresholdStages.includes(this.activeThresholdStage)) {
      this.activeThresholdStage = this.thresholdStages[0] ?? 'Çelikhane';
    }
  }

  private applyAutoPresetsForGrade(grade: string, updateMessage = true): void {
    const normalized = grade.trim().toUpperCase();
    this.selectedGradePresetLabel = this.thresholdPresets.getPresetLabel(normalized);
    this.thresholdSensors = this.thresholdPresets.buildForGrade(normalized, this.getSensorSources());
    if (!this.thresholdStages.includes(this.activeThresholdStage)) {
      this.activeThresholdStage = this.thresholdStages[0] ?? 'Çelikhane';
    }
    if (updateMessage) {
      this.thresholdSaveMessage = `${normalized} için otomatik eşikler uygulandı.`;
      setTimeout(() => {
        if (this.thresholdSaveMessage.includes('otomatik eşikler')) this.thresholdSaveMessage = '';
      }, 2000);
    }
  }

  private applyThresholdsForCurrentGrade(): void {
    const saved = this.thresholdProfiles.getProfile(this.currentSteelGrade);
    if (saved?.sensors?.length) {
      this.savedThresholds = saved.sensors.map((s) => this.thresholdPresets.normalizeThreshold(s));
    } else {
      this.savedThresholds = this.thresholdPresets.buildForGrade(this.currentSteelGrade, this.getSensorSources());
    }
    this.reevaluateWithThresholds();
  }

  private syncActiveThresholdsToAnalysis(): void {
    this.savedThresholds = structuredClone(this.thresholdSensors);
    this.reevaluateWithThresholds();
  }

  private getSensorSources(): SensorSource[] {
    if (this.allSensors.length) {
      return this.allSensors.map((s) => ({
        name: s.title,
        unit: s.unit,
        target: s.target,
        stage: s.stageName,
        minLimit: s.minLimit,
        maxLimit: s.maxLimit,
      }));
    }
    return DEFAULT_SENSOR_CATALOG;
  }

  private applySavedThresholdsForCurrentGrade(): void {
    this.applyThresholdsForCurrentGrade();
  }

  private buildThresholdsFromSensors(): ThresholdSensor[] {
    this.thresholdSensors = this.thresholdPresets.buildForGrade(
      this.selectedSteelGrade || this.currentSteelGrade || 'DX51D',
      this.getSensorSources(),
    );
    return this.thresholdSensors;
  }

  private reevaluateWithThresholds(): void {
    const thresholds = this.savedThresholds.length ? this.savedThresholds : this.thresholdSensors;
    this.allSensors.forEach((sensor) => {
      const t = thresholds.find((x) => x.name === sensor.title);
      if (!t) {
        sensor.state = sensor.originalState;
        return;
      }

      sensor.target = t.target;
      sensor.minLimit = t.criticalMin;
      sensor.maxLimit = t.criticalMax;
      sensor.warningMin = t.warningMin;
      sensor.warningMax = t.warningMax;

      const values = sensor.readings.length ? sensor.readings.map((r) => r.actualValue) : [Number(sensor.value)];
      const latest = values[values.length - 1];
      const outOfCritical = values.some((v) => v < t.criticalMin || v > t.criticalMax);
      const outOfWarning = values.some((v) => v < t.warningMin || v > t.warningMax);

      if (outOfCritical) {
        sensor.state = 'Anormal';
        sensor.thresholdAlarm = sensor.originalState === 'Normal';
        sensor.delta = this.formatThresholdDelta(latest, t);
      } else if (t.isUserModified && !outOfWarning) {
        sensor.state = 'Normal';
        sensor.thresholdAlarm = false;
        sensor.delta = this.formatDeviationDelta(latest, t.target);
      } else {
        sensor.state = sensor.originalState;
        sensor.thresholdAlarm = false;
      }
    });

    this.stages = this.backendStages.map((s) => ({ ...s }));

    if (this.selectedStageName) {
      this.filteredSensors = this.allSensors.filter((s) => s.stageName === this.selectedStageName).slice(0, 4);
    }

    if (this.chart && this.selectedSensorTitle) {
      this.updateChartData();
    }
  }

  private formatThresholdDelta(value: number, t: ThresholdSensor): string {
    if (value > t.criticalMax) {
      const pct = ((value - t.criticalMax) / Math.abs(t.criticalMax || 1)) * 100;
      return `+${pct.toFixed(1)}% üst eşik`;
    }
    if (value < t.criticalMin) {
      const pct = ((t.criticalMin - value) / Math.abs(t.criticalMin || 1)) * 100;
      return `-${pct.toFixed(1)}% alt eşik`;
    }
    return 'Eşik dışı';
  }

  private formatDeviationDelta(value: number, target: number): string {
    if (!target) return '0%';
    const pct = ((value - target) / target) * 100;
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
  }
}
