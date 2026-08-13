import { Injectable } from '@angular/core';
import { ThresholdSensor } from '../models/threshold.model';

export interface SensorSource {
  name: string;
  unit: string;
  target: number;
  stage: string;
  minLimit?: number;
  maxLimit?: number;
}

export interface GradeTolerancePreset {
  label: string;
  criticalLowPct: number;
  criticalHighPct: number;
  warningLowPct: number;
  warningHighPct: number;
  /** Aşama bazlı ek sıkılaştırma (+ = geniş, - = dar) */
  stageDelta?: Record<string, number>;
}

/** Demo / varsayılan sensör kataloğu — analiz yokken editörde kullanılır */
export const DEFAULT_SENSOR_CATALOG: SensorSource[] = [
  { stage: 'Çelikhane', name: 'Fırın Sıcaklığı', unit: '°C', target: 1150 },
  { stage: 'Çelikhane', name: 'Oksijen Üfleme Debisi', unit: 'Nm³/h', target: 3200 },
  { stage: 'Çelikhane', name: 'Ergitme Akımı', unit: 'kA', target: 48 },
  { stage: 'Çelikhane', name: 'Cüruf Bazikliği', unit: '-', target: 2.8 },
  { stage: 'Sıcak Haddehane', name: 'Descaler Basıncı', unit: 'Bar', target: 180 },
  { stage: 'Sıcak Haddehane', name: 'Şerit Sıcaklığı', unit: '°C', target: 918 },
  { stage: 'Sıcak Haddehane', name: 'Merdane Kuvveti', unit: 'MN', target: 27.86 },
  { stage: 'Sıcak Haddehane', name: 'Haddehane Hızı', unit: 'm/s', target: 12.61 },
  { stage: 'Asitleme', name: 'Asit Konsantrasyonu', unit: 'g/L', target: 160 },
  { stage: 'Asitleme', name: 'Banyo Sıcaklığı', unit: '°C', target: 72 },
  { stage: 'Asitleme', name: 'Soğutma Debisi', unit: 'm³/h', target: 420 },
  { stage: 'Asitleme', name: 'Şerit Geçiş Hızı', unit: 'm/dk', target: 95 },
  { stage: 'Soğuk Haddehane', name: 'Merdane Kuvveti', unit: 'MN', target: 9 },
  { stage: 'Soğuk Haddehane', name: 'Şerit Gerginliği', unit: 'kN', target: 14 },
  { stage: 'Soğuk Haddehane', name: 'Rulman Sıcaklığı', unit: '°C', target: 55 },
  { stage: 'Soğuk Haddehane', name: 'Emülsiyon Debisi', unit: 'L/dk', target: 280 },
];

/**
 * Çelik kalitesine göre fabrika eşik profilleri.
 * Yüksek mukavemetli kalitelerde tolerans bandı daraltılır.
 */
const GRADE_TOLERANCE_PRESETS: Record<string, GradeTolerancePreset> = {
  DX51D: {
    label: 'Galvanizli yapı çeliği',
    criticalLowPct: 0.85,
    criticalHighPct: 1.15,
    warningLowPct: 0.92,
    warningHighPct: 1.08,
    stageDelta: { 'Çelikhane': 0.02 },
  },
  DX54D: {
    label: 'Derin çekme galvaniz',
    criticalLowPct: 0.86,
    criticalHighPct: 1.14,
    warningLowPct: 0.93,
    warningHighPct: 1.07,
    stageDelta: { 'Soğuk Haddehane': -0.01 },
  },
  DC01: {
    label: 'Soğuk haddeli düşük karbon',
    criticalLowPct: 0.84,
    criticalHighPct: 1.16,
    warningLowPct: 0.91,
    warningHighPct: 1.09,
  },
  S235JR: {
    label: 'Yapı çeliği (geniş tolerans)',
    criticalLowPct: 0.83,
    criticalHighPct: 1.17,
    warningLowPct: 0.90,
    warningHighPct: 1.10,
    stageDelta: { 'Çelikhane': 0.03, 'Sıcak Haddehane': 0.02 },
  },
  S355MC: {
    label: 'Yüksek mukavemetli mikro alaşımlı',
    criticalLowPct: 0.88,
    criticalHighPct: 1.12,
    warningLowPct: 0.94,
    warningHighPct: 1.06,
    stageDelta: { 'Sıcak Haddehane': -0.02, 'Soğuk Haddehane': -0.02 },
  },
  HX380LAD: {
    label: 'Yüksek mukavemetli katı çözelti',
    criticalLowPct: 0.90,
    criticalHighPct: 1.10,
    warningLowPct: 0.95,
    warningHighPct: 1.05,
    stageDelta: { 'Asitleme': -0.02, 'Soğuk Haddehane': -0.03 },
  },
  HC260LA: {
    label: 'IF ultra düşük karbon',
    criticalLowPct: 0.87,
    criticalHighPct: 1.13,
    warningLowPct: 0.93,
    warningHighPct: 1.07,
    stageDelta: { 'Soğuk Haddehane': -0.01 },
  },
  DP600: {
    label: 'Dual-phase (çok sıkı)',
    criticalLowPct: 0.91,
    criticalHighPct: 1.09,
    warningLowPct: 0.96,
    warningHighPct: 1.04,
    stageDelta: { 'Sıcak Haddehane': -0.03, 'Soğuk Haddehane': -0.03 },
  },
};

const DEFAULT_PRESET: GradeTolerancePreset = GRADE_TOLERANCE_PRESETS['DX51D'];

@Injectable({ providedIn: 'root' })
export class ThresholdPresetService {
  getPreset(steelGrade: string): GradeTolerancePreset {
    const key = this.normalizeGrade(steelGrade);
    return GRADE_TOLERANCE_PRESETS[key] ?? DEFAULT_PRESET;
  }

  getPresetLabel(steelGrade: string): string {
    return this.getPreset(steelGrade).label;
  }

  listPresetGrades(): string[] {
    return Object.keys(GRADE_TOLERANCE_PRESETS).sort();
  }

  buildForGrade(steelGrade: string, sources: SensorSource[]): ThresholdSensor[] {
    const grade = this.normalizeGrade(steelGrade);
    const preset = this.getPreset(grade);

    return sources.map((src) => {
      const target = src.target || 0;
      const stageDelta = preset.stageDelta?.[src.stage] ?? 0;
      const critLow = this.clampPct(preset.criticalLowPct + stageDelta, 0.75, 0.98);
      const critHigh = this.clampPct(preset.criticalHighPct - stageDelta, 1.02, 1.25);
      const warnLow = this.clampPct(preset.warningLowPct + stageDelta * 0.5, critLow + 0.01, 0.99);
      const warnHigh = this.clampPct(preset.warningHighPct - stageDelta * 0.5, 1.01, critHigh - 0.01);

      return {
        id: `${grade}-${src.stage}-${src.name}`,
        name: src.name,
        unit: src.unit,
        target: this.round(target),
        criticalMin: this.round(target * critLow),
        criticalMax: this.round(target * critHigh),
        warningMin: this.round(target * warnLow),
        warningMax: this.round(target * warnHigh),
        stage: src.stage,
        isUserModified: false,
      };
    });
  }

  /** Hedef değerin kritik bantların ortasında kalmasını sağlar: kritikAlt < uyarıAlt < hedef < uyarıÜst < kritikÜst */
  normalizeThreshold(sensor: ThresholdSensor): ThresholdSensor {
    const s = { ...sensor };
    const target = s.target || 1;
    const absTarget = Math.abs(target) || 1;

    if (s.criticalMin >= target) {
      s.criticalMin = this.round(target - absTarget * 0.08);
    }
    if (s.criticalMax <= target) {
      s.criticalMax = this.round(target + absTarget * 0.08);
    }
    if (s.criticalMin >= s.criticalMax) {
      s.criticalMin = this.round(target * 0.85);
      s.criticalMax = this.round(target * 1.15);
    }

    if (s.warningMin <= s.criticalMin || s.warningMin >= target) {
      s.warningMin = this.round((s.criticalMin + target) / 2);
    }
    if (s.warningMax >= s.criticalMax || s.warningMax <= target) {
      s.warningMax = this.round((target + s.criticalMax) / 2);
    }

    if (!(s.criticalMin < s.warningMin && s.warningMin < target && target < s.warningMax && s.warningMax < s.criticalMax)) {
      s.criticalMin = this.round(target * 0.85);
      s.criticalMax = this.round(target * 1.15);
      s.warningMin = this.round(target * 0.92);
      s.warningMax = this.round(target * 1.08);
    }

    return s;
  }

  isThresholdValid(sensor: ThresholdSensor): boolean {
    const t = sensor.target;
    return sensor.criticalMin < sensor.warningMin
      && sensor.warningMin < t
      && t < sensor.warningMax
      && sensor.warningMax < sensor.criticalMax;
  }

  private normalizeGrade(grade: string): string {
    return (grade || 'DX51D').trim().toUpperCase();
  }

  private clampPct(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private round(value: number): number {
    if (Math.abs(value) >= 100) return Math.round(value * 10) / 10;
    if (Math.abs(value) >= 10) return Math.round(value * 100) / 100;
    return Math.round(value * 1000) / 1000;
  }
}
