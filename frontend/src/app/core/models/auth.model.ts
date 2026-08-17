export interface AuthUser {
  token: string;
  username: string;
  fullName: string;
  jobTitle?: string;
  role: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface DashboardStats {
  totalCoils: number;
  totalDefects: number;
  totalTickets: number;
  productionAnomalyCount: number;
  logisticsCaseCount: number;
  pendingQualityCount: number;
  decidedQualityCount: number;
  anomaliesByStage: CountItem[];
  defectsByCode: CountItem[];
  defectsBySteelGrade: CountItem[];
  qualityByGrade: CountItem[];
  recentTickets: RecentTicket[];
}

export interface CountItem {
  label: string;
  count: number;
}

export interface RecentTicket {
  ticketNumber: string;
  batchId: string;
  defectType: string;
  department: string;
  reporterName: string;
  createdAt?: string;
}
