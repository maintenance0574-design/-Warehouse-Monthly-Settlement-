
import { Transaction, TransactionType } from "../types";

// 更新預設連接網址
const DEFAULT_URL = "https://script.google.com/macros/s/AKfycby4yVDJXoV-mQRiZ5WYTjQOGnPxg_iMcasOcZTXkDwXcvw0LCA0-xacL5pGwBBPEcDd/exec";

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

const parseBool = (val: any): boolean => {
  if (val === true || val === 1 || val === "true") return true;
  if (typeof val === 'string') {
    const s = val.trim().toUpperCase();
    return s === 'TRUE' || s === '1' || s === 'YES' || s === '是';
  }
  return false;
};

export const dbService = {
  isConfigured(): boolean {
    const url = getScriptUrl();
    return !!url && url.startsWith('https://script.google.com/');
  },

  forceUpdateUrl(newUrl: string) {
    localStorage.setItem('google_sheet_script_url', newUrl);
  },

  async verifyLogin(username: string, password: string): Promise<{ authorized: boolean; message?: string }> {
    const url = getScriptUrl();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        priority: 'high',
        body: JSON.stringify({
          action: 'login',
          data: { username, password }
        })
      });
      const res = await response.json();
      return { authorized: res.authorized === true, message: res.message };
    } catch (e) {
      return { authorized: false, message: "無法連線至後端驗證伺服器" };
    }
  },

  async fetchAll(signal?: AbortSignal, retries = 1): Promise<Transaction[]> {
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
          signal,
          cache: 'no-cache'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) return [];

        return data.map((item: any, index: number) => {
          const type = (item.type || item.類別 || TransactionType.INBOUND) as TransactionType;
          const unitPrice = Number(item.unitPrice || item.單價 || item['維修單價'] || item['費用'] || 0);
          const quantity = Number(item.quantity || item.數量 || 1);
          const total = Number(item.total || item.總額 || item['維修總額'] || item['小計'] || item['結算總額'] || (unitPrice * quantity));

          return {
            id: String(item.id || item.ID || item['編號'] || `row-${index + 1}`).trim(),
            date: toTaipeiISO(item.date || item.日期),
            type: type,
            accountCategory: String(item.帳目類別 || item.accountCategory || 'A'),
            materialName: String(item.materialName || item.料件名稱 || item['維修零件/主體'] || '未命名'),
            materialNumber: String(item.materialNumber || item.料件編號 || item['料件編號(PN)'] || ''),
            machineCategory: String(item.機台種類 || item.machineCategory || 'BA'),
            machineNumber: String(item.機台編號 || item.machineNumber || item['機台 ID'] || ''),
            sn: String(item.sn || item.序號 || item['設備序號(SN)'] || ''),
            quantity: quantity,
            unitPrice: unitPrice,
            total: total,
            note: String(item.note || item.備註 || ''),
            operator: String(item.操作人員 || item.operator || '系統'),
            faultReason: String(item.故障原因 || item.faultReason || ''),
            isScrapped: parseBool(item.isScrapped || item['是否報廢']),
            isReceived: parseBool(item.isReceived || item['是否收貨']),
            sentDate: toTaipeiISO(item.送修日期 || item.sentDate),
            repairDate: toTaipeiISO(item.完修日期 || item.repairDate),
            installDate: toTaipeiISO(item.上機日期 || item.installDate)
          };
        });
      } catch (error: any) {
        if (error.name === 'AbortError') throw error;
        if (attempt < retries) {
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

  async batchSave(transactions: Transaction[]): Promise<boolean> {
    const url = getScriptUrl();
    if (!url || transactions.length === 0) return false;
    try {
      const payload = {
        action: 'batch_insert',
        data: transactions.map(tx => ({
          ...tx,
          date: toTaipeiISO(tx.date),
          sentDate: toTaipeiISO(tx.sentDate),
          repairDate: toTaipeiISO(tx.repairDate),
          installDate: toTaipeiISO(tx.installDate)
        }))
      };
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        priority: 'high',
        keepalive: true,
        body: JSON.stringify(payload)
      });
      return true;
    } catch (e) {
      console.error("Batch save error", e);
      return false;
    }
  },

  async update(transaction: Transaction): Promise<boolean> {
    return this.postToCloud('update', transaction.id, transaction.type, transaction);
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
          ...transaction,
          date: toTaipeiISO(transaction.date),
          sentDate: toTaipeiISO(transaction.sentDate),
          repairDate: toTaipeiISO(transaction.repairDate),
          installDate: toTaipeiISO(transaction.installDate)
        }
      };
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        priority: 'high',
        keepalive: true,
        body: JSON.stringify(payload)
      });
      return true;
    } catch (e) {
      return false;
    }
  }
};
