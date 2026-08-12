export interface AnalysisResponseDto {
  coilId: string;
  defectCode: string;
  steelGrade?: string;
  classificationType?: 'PRODUCTION' | 'LOGISTICS';
  headline?: string;
  stages: StageDto[];
  rootCause: RootCauseDto;
  sensorSummaries: SensorSummaryDto[];
  timeSeriesData: TimeSeriesReadingDto[];
  evidenceIndicators?: string[];
}

export interface StageDto {
  stageName: string;
  stageOrder: number;
  status: string;
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
  stageName?: string;
}

export interface SensorSummaryDto {
  sensorKey: string;
  stageName: string;
  unit: string;
  lastActualValue: number;
  targetValue: number;
  minLimit: number;
  maxLimit: number;
  status: string;
  percentageDeviation: number;
  sparklineValues?: number[];
  readings?: TimeSeriesReadingDto[];
}

export interface TimeSeriesReadingDto {
  sensorKey: string;
  timeSecond: number;
  actualValue: number;
  targetValue: number;
  minLimit: number;
  maxLimit: number;
}

export interface CreateTicketRequest {
  reporterName: string;
  department: string;
  batchId: string;
  detectedLocation: string;
  defectType: string;
  extraNotes?: string;
}

export interface DamageTicket {
  ticketNumber: string;
}
