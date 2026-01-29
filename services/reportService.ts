
import * as XLSX from 'xlsx';
import { Transaction, TransactionType } from '../types';

/**
 * 匯出 Excel 專業報表
 * 包含：數據總結頁、凍結視窗、自動欄寬與財務統計
 */
export const exportToExcel = (data: Transaction[], filename: string) => {
  if (!data || data.length === 0) {
    alert(`⚠️ 目前沒有符合條件的紀錄可供匯出`);
    return;
  }

  const wb = XLSX.utils.book_new();

  // 1. 建立「數據總結」分頁
  const prepareSummarySheet = () => {
    const now = new Date();
    const categories = [
      TransactionType.INBOUND,
      TransactionType.USAGE,
      TransactionType.CONSTRUCTION,
      TransactionType.REPAIR
    ];

    const summaryRows: (string | number)[][] = [
      ['倉儲月結智慧報表 - 數據總結'],
      ['生成時間', now.toLocaleString('zh-TW')],
      ['資料總數', `${data.length} 筆`],
      [''],
      ['類別摘要統計', '件數', '總額 (NT$)', '百分比'],
    ];

    const totalAmount = data.reduce((sum, t) => sum + (Number(t.total) || 0), 0);

    categories.forEach(cat => {
      const items = data.filter(t => t.type === cat);
      const catTotal = items.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
      const percentage = totalAmount > 0 ? ((catTotal / totalAmount) * 100).toFixed(1) + '%' : '0%';
      summaryRows.push([cat, items.length, catTotal, percentage]);
    });

    summaryRows.push(['']);
    summaryRows.push(['★ 全案總計', data.length, totalAmount, '100%']);

    const ws = XLSX.utils.aoa_to_sheet(summaryRows);
    ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 15 }];
    return ws;
  };

  // 2. 建立各明細分頁
  const prepareSheetData = (type: TransactionType) => {
    const items = data.filter(t => t.type === type);
    if (items.length === 0) return null;

    let rows: any[] = [];

    if (type === TransactionType.REPAIR) {
      rows = items.map(t => ({
        'ID (編號)': t.id,
        '單據日期': t.date,
        '料件名稱': t.materialName,
        '料件編號(PN)': t.materialNumber,
        '機台編號': t.machineNumber,
        '設備序號(SN)': t.sn || '',
        '故障原因': t.faultReason || '',
        '數量': Number(t.quantity) || 0,
        '維修單價': Number(t.unitPrice) || 0,
        '維修總額': Number(t.total) || 0,
        '送修日': t.sentDate || '',
        '完修日': t.repairDate || '',
        '上機日': t.installDate || '',
        '操作人': t.operator || '系統',
        '備註': t.note || ''
      }));

      const repairGrandTotal = items.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
      rows.push({
        'ID (編號)': '---',
        '單據日期': '★ 總計 ★',
        '維修總額': repairGrandTotal,
        '備註': `共計 ${items.length} 筆維修，總結 NT$ ${repairGrandTotal.toLocaleString()}`
      });

    } else {
      // 通用精簡格式
      rows = items.map(t => {
        const rowObj: any = {
          'ID (編號)': t.id,
          '日期': t.date,
          '類別': t.type,
          '料件名稱': t.materialName,
          '料件編號(PN)': t.materialNumber,
          '機台編號': t.machineNumber,
          '數量': Number(t.quantity) || 0,
          '單價': Number(t.unitPrice) || 0,
          '總額': Number(t.total) || 0,
          '機台種類': t.machineCategory || '',
          '帳目': t.accountCategory || '',
          '操作人': t.operator || '系統',
          '備註': t.note || ''
        };
        // 只有進貨類別才加上收貨狀態
        if (type === TransactionType.INBOUND) {
          rowObj['收貨狀態'] = t.isReceived ? '已收到' : '待收貨';
        }
        return rowObj;
      });

      const grandTotal = items.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
      rows.push({
        'ID (編號)': '---',
        '日期': '★ 總計 ★',
        '料件名稱': `共 ${items.length} 筆`,
        '總額': grandTotal,
        '備註': `本月 ${type} 核銷總計`
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);

    const wscols = [
      { wch: 15 }, // ID
      { wch: 12 }, // 日期
      { wch: 10 }, // 類別
      { wch: 30 }, // 名稱
      { wch: 20 }, // PN
      { wch: 15 }, // 機台
      { wch: 12 }, // 數量
      { wch: 12 }, // 單價
      { wch: 15 }, // 總額
      { wch: 15 }, // 種類
      { wch: 15 }, // 帳目
      { wch: 15 }, // 人員
      { wch: 40 }, // 備註
    ];
    ws['!cols'] = wscols;
    ws['!views'] = [{ state: 'frozen', ySplit: 1 }];

    return ws;
  };

  const summaryWs = prepareSummarySheet();
  XLSX.utils.book_append_sheet(wb, summaryWs, "📊 數據總結");

  const categories = [
    TransactionType.INBOUND, 
    TransactionType.USAGE, 
    TransactionType.CONSTRUCTION,
    TransactionType.REPAIR
  ];
  
  categories.forEach(type => {
    const ws = prepareSheetData(type);
    if (ws) {
      XLSX.utils.book_append_sheet(wb, ws, type);
    }
  });

  const finalFilename = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, finalFilename);
};
