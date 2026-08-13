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
  qualityGrading?: QualityGrading;
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

export interface CoilHistory {
  coilId: string;
  previouslyReported: boolean;
  reportCount: number;
  summaryMessage?: string;
  previousReports: PreviousReport[];
}

export interface PreviousReport {
  ticketNumber: string;
  defectType: string;
  department: string;
  reporterName: string;
  detectedLocation: string;
  createdAt: string;
}

export interface QualityGrading {
  recommendedGrade: 'CUSTOMER' | 'SECOND_QUALITY' | 'SCRAP';
  recommendedGradeLabel: string;
  headline: string;
  confidence: number;
  customerScore: number;
  secondQualityScore: number;
  scrapScore: number;
  requiresManualReview: boolean;
  dispositionAction: string;
  criteria: string[];
  gradeLabels?: Record<string, string>;
}

export interface ConfirmGradeRequest {
  coilId: string;
  finalGrade: string;
  recommendedGrade?: string;
  inspectorName: string;
  notes?: string;
  ticketNumber?: string;
}

export interface ConfirmGradeResponse {
  id: number;
  coilId: string;
  finalGrade: string;
  finalGradeLabel: string;
  resolvedTicketCount: number;
}

export interface RelatedTicket {
  ticketNumber: string;
  defectType: string;
  department: string;
  reporterName: string;
  createdAt: string;
}

export interface TicketQueueItem {
  ticketNumber: string;
  batchId: string;
  defectType: string;
  department: string;
  reporterName: string;
  detectedLocation: string;
  extraNotes?: string;
  createdAt: string;
  gradeStatus: 'PENDING' | 'DECIDED';
  finalGrade?: string;
  finalGradeLabel?: string;
  recommendedGrade?: string;
  recommendedGradeLabel?: string;
  inspectorName?: string;
  relatedTicketCount?: number;
  relatedTickets?: RelatedTicket[];
}

export interface TicketQueueDetail {
  ticket: TicketQueueItem;
  qualityGrading?: QualityGrading;
  analysisHeadline?: string;
  analysis?: AnalysisResponseDto;
}
