export interface Defect {
  id?: number;
  productSerialNo: string;
  lotNumber: string;
  defectType: string;
  description: string;
  reportedBy: string;
  createdDate?: string;
  status: 'OPEN' | 'IN_INVESTIGATION' | 'RESOLVED' | 'CLOSED';
}

export interface ProductionStep {
  stepName: string;
  machineId: string;
  timestamp: string;
  operatorName: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
  rawMaterialLot?: string;
}

export interface DefectTraceability {
  defect: Defect;
  productionHistory: ProductionStep[];
}
