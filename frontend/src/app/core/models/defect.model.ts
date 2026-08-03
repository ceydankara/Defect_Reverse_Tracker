export interface AnalysisResponseDto {
  coilId: string;
  defectCode: string;
  stages: StageDto[];
  rootCause: RootCauseDto;
  sensorSummaries: SensorSummaryDto[];
  timeSeriesData: TimeSeriesReadingDto[];
}

export interface StageDto {
  stageName: string;
  stageOrder: number;
  status: string; // 'OK' | 'ANOMALI' | 'BEKLEMEDE'
  sensorCount: number;
}

export interface RootCauseDto {
  equipment: string;
  faultSource: string;
  detectionDetail: string;
  confidenceRate: number;
  productionImpactPct: number;
  logisticImpactPct: number;
  recommendedAction: string;
}

export interface SensorSummaryDto {
  sensorKey: string;
  lastActualValue: number;
  targetValue: number;
  minLimit: number;
  maxLimit: number;
  status: string;
  percentageDeviation: number;
}

export interface TimeSeriesReadingDto {
  sensorKey: string;
  timeSecond: number;
  actualValue: number;
  targetValue: number;
  minLimit: number;
  maxLimit: number;
}
