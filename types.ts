
export enum TransactionType {
  INBOUND = '進貨',
  USAGE = '用料',
  CONSTRUCTION = '建置',
  REPAIR = '維修'
}

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  accountCategory: string; 
  materialName: string;    
  materialNumber: string;  
  machineCategory: string; 
  machineNumber: string;   
  sn?: string; 
  quantity: number;
  unitPrice: number;
  total: number;
  note: string;
  operator: string; // 操作人員
  faultReason?: string; // 故障原因
  isScrapped?: boolean; // 是否報廢
  // 維修專用欄位
  sentDate?: string;    // 送修日期
  repairDate?: string;  // 完修日期
  installDate?: string; // 上機日期
}

export interface MonthlyStats {
  inboundTotal: number;
  usageTotal: number;
  constructionTotal: number;
  repairTotal: number;
  grandTotal: number;
}
