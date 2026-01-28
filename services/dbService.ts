
import { Transaction, TransactionType } from "../types";

const DEFAULT_URL = "https://script.google.com/macros/s/AKfycbzn25Yi5rY5gnHbksYTEOABjUJrk2AkCkFFJ5cB1SyhuhbgitTsVX4Bj2L1KqZmi8WD/exec";

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

  forceUpdateUrl(newUrl: string) {
    localStorage.setItem('google_sheet_script_url', newUrl);
  },

  /**
   * 後端密碼驗證
   */
  async verifyLogin(username: string, password: string): Promise<{ authorized: boolean; message?: string }> {
    const url = getScriptUrl();
    try {
      // 登入必須獲得回傳值，因此不能用 no-cors
      // GAS 的 POST 請求如果回傳 ContentService，瀏覽器會跟隨 302 導向
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'login',
          data: { username, password }
        })
      });
      
      const res = await response.json();
      return {
        authorized: res.authorized === true,
        message: res.message
      };
    } catch (e) {
      console.error("Login verification error:", e);
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
          id: String(item.id || item.ID || `row-${index + 1}`).trim(),
          date: toTaipeiISO(item.date || item.日期),
          type: (item.type || item.類別 || TransactionType.INBOUND) as TransactionType,
          accountCategory: String(item.帳目類別 || item.accountCategory || 'A'),
          materialName: String(item.materialName || item.料件名稱 || '未命名'),
          materialNumber: String(item.materialNumber || item.料件編號 || ''),
          machineCategory: String(item.機台種類 || item.machineCategory || 'BA'),
          machineNumber: String(item.機台編號 || item.machineNumber || ''),
          sn: String(item.sn || item.序號 || ''),
          quantity: Number(item.quantity || item.數量) || 0,
          unitPrice: Number(item.unitPrice || item.單價) || 0,
          total: Number(item.total || item.總額) || 0,
          note: String(item.note || item.備註 || ''),
          operator: String(item.操作人員 || item.operator || '系統'),
          faultReason: String(item.故障原因 || item.faultReason || ''),
          isScrapped: !!(item.是否報廢 || item.isScrapped),
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
    return this.postToCloud('update', transaction.id, transaction.type, transaction);
  },

  async delete(id: string, type: TransactionType): Promise<boolean> {
    return this.postToCloud('delete', id, type, {});
  },

  async postToCloud(action: string, id: string, type: string, transaction: any): Promise<boolean> {
    const url = getScriptUrl();
    if (!url) return false;
    
    try {
      const dataPayload: any = {
        id: String(id).trim(),
        date: toTaipeiISO(transaction.date),
        type: transaction.type,
        materialName: String(transaction.materialName),
        materialNumber: String(transaction.materialNumber),
        machineNumber: String(transaction.machineNumber),
        sn: String(transaction.sn || ''),
        quantity: Number(transaction.quantity),
        unitPrice: Number(transaction.unitPrice || 0),
        total: Number(transaction.total || 0),
        note: String(transaction.note || ''),
        operator: String(transaction.operator || '系統'),
        faultReason: String(transaction.faultReason || ''),
        isScrapped: !!transaction.isScrapped,
        machineCategory: String(transaction.machineCategory || ''),
        accountCategory: String(transaction.accountCategory || ''),
        sentDate: toTaipeiISO(transaction.sentDate),
        repairDate: toTaipeiISO(transaction.repairDate),
        installDate: toTaipeiISO(transaction.installDate)
      };

      const payload = {
        action,
        id: String(id).trim(),
        type, 
        data: action === 'delete' ? {} : dataPayload
      };

      await fetch(url, {
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
