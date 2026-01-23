
import * as XLSX from 'xlsx';
import { Transaction, TransactionType } from '../types';

/**
 * 匯出 Excel 報表
 * @param data 要匯出的資料集（通常是過濾後的結果）
 * @param filename 匯出的檔案名稱（不含副檔名）
 */
export const exportToExcel = (data: Transaction[], filename: string) => {
  if (!data || data.length === 0) {
    alert(`⚠️ 目前沒有符合條件的紀錄可供匯出`);
    return;
  }

  const wb = XLSX.utils.book_new();

  const prepareSheetData = (type: TransactionType) => {
    const items = data.filter(t => t.type === type);
    if (items.length === 0) return null;

    let rows: any[] = [];

    if (type === TransactionType.REPAIR) {
      // 維修類別特定順序
      rows = items.map(t => ({
        'id': t.id,
        '單據日期': t.date,
        '類別': t.type,
        '料件名稱': t.materialName,
        '料件編號(PN)': t.materialNumber,
        '機台編號': t.machineNumber,
        '設備序號(SN)': t.sn || '',
        '故障原因': t.faultReason || '',
        '數量': Number(t.quantity) || 0,
        '送修日期': t.sentDate || '',
        '完修日期': t.repairDate || '',
        '備註': t.note || '',
        '上機日期': t.installDate || '',
        '操作人員': t.operator || '系統'
      }));

      // 移除數量總計，僅保留案件筆數說明
      rows.push({
        'id': '---',
        '單據日期': '總計',
        '備註': `共計 ${items.length} 筆維修案件`
      });

    } else {
      // 一般類別: 進貨、用料、建置
      rows = items.map(t => ({
        'id': t.id,
        '日期': t.date,
        '類別': t.type,
        '料件名稱': t.materialName,
        '料件編號(PN)': t.materialNumber,
        '機台編號': t.machineNumber,
        '數量': Number(t.quantity) || 0,
        '單價': Number(t.unitPrice) || 0,
        '總額': Number(t.total) || 0,
        '備註': t.note || '',
        '機台種類': t.machineCategory || '',
        '帳目類別': t.accountCategory || '',
        '操作人員': t.operator || '系統'
      }));

      // 僅計算金額總計
      const grandTotal = items.reduce((sum, t) => sum + (Number(t.total) || 0), 0);

      // 新增總計列，不包含數量加總
      rows.push({
        'id': '---',
        '日期': '★ 總計 ★',
        '料件名稱': `項目共計 ${items.length} 筆`,
        '總額': grandTotal,
        '備註': `本月 ${type} 結算總金額`
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);

    // 設定欄位寬度讓報表更好看
    const wscols = [
      { wch: 15 }, // id
      { wch: 12 }, // 日期
      { wch: 10 }, // 類別
      { wch: 25 }, // 料件名稱
      { wch: 20 }, // PN
      { wch: 15 }, // 機台編號
      { wch: 10 }, // 數量
      { wch: 12 }, // 單價
      { wch: 15 }, // 總額
    ];
    ws['!cols'] = wscols;

    return ws;
  };

  const categories = [
    TransactionType.INBOUND, 
    TransactionType.USAGE, 
    TransactionType.CONSTRUCTION,
    TransactionType.REPAIR
  ];
  
  let hasSheet = false;

  categories.forEach(type => {
    const ws = prepareSheetData(type);
    if (ws) {
      XLSX.utils.book_append_sheet(wb, ws, type);
      hasSheet = true;
    }
  });

  if (!hasSheet) {
    alert("資料格式不正確，無法生成報表");
    return;
  }

  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
};
