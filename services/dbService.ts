import { Transaction, TransactionType } from "../types";

// 更新為使用者提供的最新網址
const DEFAULT_URL = "https://script.google.com/macros/s/AKfycbxuogDxnNZUkS8A4d7nU0enJjYxWd9r1ll9NNGquwEsytgxNIZhb1HkG4AFmNEbIQs5/exec";

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

  async fetchAll(signal?: AbortSignal, retries = 2): Promise<Transaction[]> {
    const url = getScriptUrl();
    if (!url) return [];

    const fetchWithRetry = async (attempt: number): Promise<Transaction[]> => {
      try {
        const separator = url.includes('?') ? '&' : '?';
        const finalUrl = `${url}${separator}action=fetch&_=${Date.now()}`;
        const response = await fetch(finalUrl, { method: 'GET', mode: 'cors', redirect: 'follow', signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!Array.isArray(data)) return [];

        return data.map((item: any, index: number) => {
          const type = (item.type || item.類別 || TransactionType.INBOUND) as TransactionType;
          const isRepair = type === TransactionType.REPAIR;
          const isInbound = type === TransactionType.INBOUND;

          return {
            id: String(item.id || item.ID || item['編號'] || `row-${index + 1}`).trim(),
            date: toTaipeiISO(item.date || item.日期),
            type: type,
            accountCategory: isRepair ? "" : String(item.帳目類別 || item.accountCategory || 'A'),
            materialName: String(item.materialName || item.料件名稱 || item['維修零件/主體'] || '未命名'),
            materialNumber: String(item.materialNumber || item.料件編號 || ''),
            machineCategory: String(item.機台種類 || item.machineCategory || 'BA'),
            machineNumber: String(item.機台編號 || item.machineNumber || ''),
            sn: isRepair ? String(item.sn || item.序號 || '') : "",
            quantity: Number(item.quantity || item.數量) || 0,
            unitPrice: Number(item.unitPrice || item.單價) || 0,
            total: Number(item.total || item.總額) || 0,
            note: String(item.note || item.備註 || ''),
            operator: String(item.操作人員 || item.operator || '系統'),
            faultReason: isRepair ? String(item.故障原因 || item.faultReason || '') : "",
            isScrapped: isRepair ? parseBool(item.isScrapped || item['是否報廢']) : false,
            isReceived: isInbound ? parseBool(item.isReceived || item['是否收貨']) : true,
            sentDate: isRepair ? toTaipeiISO(item.送修日期 || item.sentDate) : "",
            repairDate: isRepair ? toTaipeiISO(item.完修日期 || item.repairDate) : "",
            installDate: isRepair ? toTaipeiISO(item.上機日期 || item.installDate) : ""
          };
        });
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
    return this.postToCloud('update', transaction.id, transaction.type, transaction);
  },

  async delete(id: string, type: TransactionType): Promise<boolean> {
    return this.postToCloud('delete', id, type, {});
  },

  async postToCloud(action: string, id: string, type: string, transaction: any): Promise<boolean> {
    const url = getScriptUrl();
    if (!url) return false;
    
    try {
      const isRepair = type === TransactionType.REPAIR;
      const isInbound = type === TransactionType.INBOUND;

      const dataPayload: any = {
        id: String(id).trim(),
        date: toTaipeiISO(transaction.date),
        type: transaction.type,
        materialName: String(transaction.materialName),
        materialNumber: String(transaction.materialNumber),
        machineNumber: String(transaction.machineNumber),
        quantity: Number(transaction.quantity || 0),
        unitPrice: Number(transaction.unitPrice || 0),
        total: Number(transaction.total || 0),
        note: String(transaction.note || ''),
        operator: String(transaction.operator || '系統'),
        machineCategory: String(transaction.machineCategory || '')
      };

      // 只有核銷相關類別才傳送帳目類別
      if (!isRepair) {
        dataPayload.accountCategory = String(transaction.accountCategory || 'A');
      }

      // 只有進貨類型才允許傳送收貨屬性
      if (isInbound) {
        dataPayload.isReceived = transaction.isReceived === undefined ? true : !!transaction.isReceived;
      }

      // 只有維修類別才允許傳送進階欄位
      if (isRepair) {
        dataPayload.sn = String(transaction.sn || '');
        dataPayload.faultReason = String(transaction.faultReason || '');
        dataPayload.isScrapped = !!transaction.isScrapped;
        dataPayload.sentDate = toTaipeiISO(transaction.sentDate);
        dataPayload.repairDate = toTaipeiISO(transaction.repairDate);
        dataPayload.installDate = toTaipeiISO(transaction.installDate);
      }

      const payload = {
        action,
        id: String(id).trim(),
        type, 
        data: action === 'delete' ? {} : dataPayload
      };

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      return true;
    } catch (e) {
      return false;
    }
  }
};
