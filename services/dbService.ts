
import { Transaction, TransactionType } from "../types";

// 更新為用戶提供的新網址 (2024/05 最新版本)
const DEFAULT_URL = "https://script.google.com/macros/s/AKfycbz-YFkCb20FKni1-Fc9ugrq-sougLIsAanXQgi-iHCIkk8GqEtQbwH_hyzsREP4EUdy/exec";

const getScriptUrl = () => {
  const saved = localStorage.getItem('google_sheet_script_url');
  return (saved || DEFAULT_URL).trim();
};

const toTaipeiISO = (dateStr: string | undefined) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
  } catch {
    return "";
  }
};

export const dbService = {
  isConfigured(): boolean {
    const url = getScriptUrl();
    return !!url && url.startsWith('https://script.google.com/');
  },

  // 強制更新本地存儲的 URL (用於切換新環境)
  forceUpdateUrl(newUrl: string) {
    localStorage.setItem('google_sheet_script_url', newUrl);
  },

  async fetchAll(signal?: AbortSignal, retries = 2): Promise<Transaction[]> {
    const url = getScriptUrl();
    if (!url) return [];

    const fetchWithRetry = async (attempt: number): Promise<Transaction[]> => {
      try {
        const separator = url.includes('?') ? '&' : '?';
        const finalUrl = `${url}${separator}action=fetch&_=${Date.now()}`;

        const response = await fetch(finalUrl, {
          method: 'GET',
          mode: 'cors',
          redirect: 'follow',
          signal
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!Array.isArray(data)) return [];

        return data.map((item: any, index: number) => ({
          id: String(item.id || `row-${index + 1}`).trim(),
          date: toTaipeiISO(item.date || new Date()),
          type: (item.type || TransactionType.INBOUND) as TransactionType,
          accountCategory: String(item.帳目類別 || item.accountCategory || 'A'),
          materialName: String(item.materialName || '未命名'),
          materialNumber: String(item.materialNumber || ''),
          machineCategory: String(item.機台種類 || item.machineCategory || 'BA'),
          machineNumber: String(item.機台編號 || item.machineNumber || ''),
          sn: String(item.sn || ''),
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unitPrice) || 0,
          total: Number(item.total) || 0,
          note: String(item.note || ''),
          operator: String(item.操作人員 || item.operator || '系統'),
          faultReason: String(item.故障原因 || item.faultReason || ''),
          sentDate: toTaipeiISO(item.送修日期 || item.sentDate),
          repairDate: toTaipeiISO(item.完修日期 || item.repairDate),
          installDate: toTaipeiISO(item.上機日期 || item.installDate)
        }));
      } catch (error: any) {
        if (error.name === 'AbortError') throw error;
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchWithRetry(attempt + 1);
        }
        throw error;
      }
    };

    return fetchWithRetry(0).catch(() => []);
  },

  async save(transaction: Transaction): Promise<boolean> {
    return this.postToCloud('insert', transaction.id, transaction.type, transaction);
  },

  async update(transaction: Transaction): Promise<boolean> {
    return this.postToCloud('insert', transaction.id, transaction.type, transaction);
  },

  async delete(id: string, type: TransactionType): Promise<boolean> {
    return this.postToCloud('delete', id, type, {});
  },

  async postToCloud(action: string, id: string, type: string, transaction: any): Promise<boolean> {
    const url = getScriptUrl();
    if (!url) return false;
    
    try {
      const payload = {
        action,
        id: String(id).trim(),
        type, 
        data: action === 'delete' ? {} : {
          id: String(id).trim(),
          date: toTaipeiISO(transaction.date),
          type: transaction.type,
          materialName: String(transaction.materialName),
          materialNumber: String(transaction.materialNumber),
          "機台編號": String(transaction.machineNumber),
          sn: String(transaction.sn || ''),
          quantity: Number(transaction.quantity),
          unitPrice: Number(transaction.unitPrice || 0),
          total: Number(transaction.total || 0),
          note: String(transaction.note || ''),
          operator: String(transaction.operator || '系統'),
          "故障原因": String(transaction.faultReason || ''),
          "機台種類": String(transaction.machineCategory || ''),
          "帳目類別": String(transaction.accountCategory || ''),
          "送修日期": toTaipeiISO(transaction.sentDate),
          "完修日期": toTaipeiISO(transaction.repairDate),
          "上機日期": toTaipeiISO(transaction.installDate)
        }
      };

      const result = await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      
      return true;
    } catch (e) {
      console.error("Cloud Sync Error:", e);
      return false;
    }
  }
};
