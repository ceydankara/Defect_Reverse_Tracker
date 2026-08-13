import { Injectable } from '@angular/core';
import { ThresholdProfile, ThresholdSensor, COMMON_STEEL_GRADES } from '../models/threshold.model';
import { ThresholdPresetService } from './threshold-preset.service';

const STORAGE_KEY = 'defect-tracker-threshold-profiles';

@Injectable({ providedIn: 'root' })
export class ThresholdProfileService {
  constructor(private thresholdPresets: ThresholdPresetService) {}
  getProfile(steelGrade: string): ThresholdProfile | null {
    const key = this.normalizeGrade(steelGrade);
    if (!key) return null;
    const all = this.loadAll();
    return all[key] ?? null;
  }

  saveProfile(steelGrade: string, sensors: ThresholdSensor[]): ThresholdProfile {
    const key = this.normalizeGrade(steelGrade);
    const profile: ThresholdProfile = {
      steelGrade: key,
      sensors: structuredClone(sensors),
      updatedAt: new Date().toISOString(),
    };
    const all = this.loadAll();
    all[key] = profile;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return profile;
  }

  deleteProfile(steelGrade: string): void {
    const key = this.normalizeGrade(steelGrade);
    const all = this.loadAll();
    delete all[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  listSavedGrades(): string[] {
    return Object.keys(this.loadAll()).sort();
  }

  listAvailableGrades(currentGrade?: string): string[] {
    const set = new Set<string>(COMMON_STEEL_GRADES);
    this.thresholdPresets.listPresetGrades().forEach((g) => set.add(g));
    this.listSavedGrades().forEach((g) => set.add(g));
    if (currentGrade) set.add(this.normalizeGrade(currentGrade));
    return Array.from(set).sort();
  }

  private loadAll(): Record<string, ThresholdProfile> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private normalizeGrade(grade: string): string {
    return (grade || 'DX51D').trim().toUpperCase();
  }
}
