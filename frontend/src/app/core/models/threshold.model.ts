export interface ThresholdSensor {
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

export interface ThresholdProfile {
  steelGrade: string;
  sensors: ThresholdSensor[];
  updatedAt: string;
}

export const COMMON_STEEL_GRADES = [
  'DX51D',
  'DX54D',
  'DC01',
  'S235JR',
  'S355MC',
  'HX380LAD',
  'HC260LA',
  'DP600',
] as const;
