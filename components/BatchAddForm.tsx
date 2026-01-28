
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Transaction, TransactionType } from '../types';

interface Props {
  onSave: (tx: Transaction, action: 'save') => Promise<boolean>;
  existingTransactions: Transaction[];
  onComplete: () => void;
  currentUser: string;
}

const MACHINE_CATEGORIES = ['BA', 'RL', 'SB', 'XD', '7UP', 'HOT8', '3card', 'DT', 'CG', '共用'];
const getTaipeiToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });

const BatchAddForm: React.FC<Props> = ({ onSave, existingTransactions, onComplete, currentUser }) => {
  const [rows, setRows] = useState<any[]>([
    {
      id: Math.random().toString(36).substr(2, 9),
      date: getTaipeiToday(),
      type: TransactionType.USAGE,
      accountCategory: 'A',
      materialName: '',
      materialNumber: '',
      machineCategory: 'BA',
      machineNumber: '',
      sn: '', 
      faultReason: '',
      quantity: 1,
      unitPrice: 0,
      note: '',
      operator: currentUser
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [suggestions, setSuggestions] = useState<{ rowId: string, field: string, items: string[] }>({ rowId: '', field: '', items: [] });
  const suggestionRef = useRef<HTMLDivElement>(null);

  const historicalData = useMemo(() => {
    const names = new Set<string>();
    const numbers = new Set<string>();
    const nameToDetails: Record<string, { number: string, machine: string }> = {};

    existingTransactions.forEach(t => {
      if (t.materialName) {
        names.add(t.materialName);
        nameToDetails[t.materialName] = { 
          number: t.materialNumber || '', 
          machine: t.machineCategory || MACHINE_CATEGORIES[0] 
        };
      }
      if (t.materialNumber) numbers.add(t.materialNumber);
    });

    return { 
      names: Array.from(names), 
      numbers: Array.from(numbers), 
      nameToDetails,
      recentTen: [...existingTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)
    };
  }, [existingTransactions]);

  const addRow = () => {
    const lastRow = rows[0];
    setRows([{
      ...lastRow,
      id: Math.random().toString(36).substr(2, 9),
      materialName: '',
      materialNumber: '',
      sn: '',
      faultReason: '',
      note: '',
      quantity: 1,
      operator: currentUser
    }, ...rows]);
  };

  const duplicateRow = (index: number) => {
    const rowToCopy = { ...rows[index], id: Math.random().toString(36).substr(2, 9) };
    const newRows = [...rows];
    newRows.splice(index, 0, rowToCopy);
    setRows(newRows);
  };

  const removeRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: string, value: any) => {
    const newRows = [...rows];
    newRows[index][field] = value;

    if (field === 'materialName' || field === 'materialNumber') {
      const source = field === 'materialName' ? historicalData.names : historicalData.numbers;
      const filtered = value.trim() 
        ? source.filter(item => item.toLowerCase().includes(value.toLowerCase()) && item !== value).slice(0, 5)
        : [];
      setSuggestions({ rowId: newRows[index].id, field, items: filtered });
    }
    setRows(newRows);
  };

  const selectSuggestion = (index: number, field: string, value: string) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    if (field === 'materialName') {
      const details = historicalData.nameToDetails[value];
      if (details) {
        newRows[index].materialNumber = details.number;
        newRows[index].machineCategory = details.machine;
      }
    }
    setRows(newRows);
    setSuggestions({ rowId: '', field: '', items: [] });
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    const validRows = rows.filter(r => r.materialName.trim());
    if (validRows.length === 0) return;

    setIsSubmitting(true);
    setProgress({ current: 0, total: validRows.length });

    try {
      const promises = validRows.map(async (row) => {
        const tx: Transaction = {
          ...row,
          id: 'TX-B' + Date.now() + Math.random().toString(36).substr(2, 5),
          quantity: Number(row.quantity),
          unitPrice: Number(row.unitPrice),
          total: Number(row.quantity) * Number(row.unitPrice),
          sn: row.sn || '',
          faultReason: row.faultReason || '',
        };
        const res = await onSave(tx, 'save');
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
        return res;
      });

      await Promise.all(promises);
      onComplete();
    } catch (e) {
      console.error("Batch submission error", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalAmount = rows.reduce((sum, r) => sum + (Number(r.quantity) * Number(r.unitPrice)), 0);
  const labelClass = "block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1";
  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-900 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all";

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl flex flex-wrap justify-between items-center gap-8 sticky top-4 z-10 border border-white/5">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-3xl shadow-lg">⚡</div>
          <div>
            <h2 className="text-xl font-black text-white">智慧批次新增</h2>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">目前準備並行提交 {rows.length} 筆紀錄</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-1">預估總計</p>
            <p className="text-xl font-black text-indigo-400">NT$ {totalAmount.toLocaleString()}</p>
          </div>
          <div className="flex gap-3">
             <button onClick={addRow} className="px-6 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-sm transition-all">+ 新增空白列</button>
             <button onClick={handleSubmit} disabled={isSubmitting} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all">
                {isSubmitting ? `並行同步中 ${progress.current}/${progress.total}` : "🚀 開始全量同步"}
             </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {rows.map((row, idx) => (
          <div key={row.id} className={`bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200/60 transition-all hover:border-indigo-500 relative ${idx === 0 ? 'ring-2 ring-indigo-500/20 bg-indigo-50/5' : ''}`}>
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-end">
              <div className="xl:col-span-2">
                <label className={labelClass}>日期/類別</label>
                <div className="flex gap-2">
                  <input type="date" value={row.date} onChange={e => updateRow(idx, 'date', e.target.value)} className={inputClass} />
                  <select value={row.type} onChange={e => updateRow(idx, 'type', e.target.value)} className={`${inputClass} w-24 text-indigo-600`}>
                    {Object.values(TransactionType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="xl:col-span-3 relative">
                <label className={labelClass}>料件名稱 / 料號 (PN)</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input type="text" placeholder="名稱..." value={row.materialName} onChange={e => updateRow(idx, 'materialName', e.target.value)} className={inputClass} />
                    {suggestions.rowId === row.id && suggestions.field === 'materialName' && suggestions.items.length > 0 && (
                      <div ref={suggestionRef} className="absolute z-50 left-0 right-0 top-full mt-2 bg-white shadow-2xl border border-slate-200 rounded-2xl overflow-hidden">
                        {suggestions.items.map((item, sIdx) => (
                          <button key={sIdx} onClick={() => selectSuggestion(idx, 'materialName', item)} className="w-full text-left px-4 py-2 text-[10px] font-black text-slate-600 hover:bg-indigo-600 hover:text-white border-b border-slate-50 last:border-0">💡 {item}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="text" placeholder="PN..." value={row.materialNumber} onChange={e => updateRow(idx, 'materialNumber', e.target.value)} className={`${inputClass} w-24`} />
                </div>
              </div>

              <div className="xl:col-span-3">
                <label className={labelClass}>機台 ID / SN 序號 {row.type === TransactionType.REPAIR && <span className="text-rose-500">/ 故障原因</span>}</label>
                <div className="flex flex-col gap-1">
                  <div className="flex gap-2">
                    <input type="text" placeholder="機台 ID..." value={row.machineNumber} onChange={e => updateRow(idx, 'machineNumber', e.target.value)} className={inputClass} />
                    <input type="text" placeholder="SN..." value={row.sn} onChange={e => updateRow(idx, 'sn', e.target.value)} className={inputClass} />
                  </div>
                  {row.type === TransactionType.REPAIR && (
                    <input type="text" placeholder="輸入故障原因 (必填)..." value={row.faultReason} onChange={e => updateRow(idx, 'faultReason', e.target.value)} className={`${inputClass} bg-rose-50 border-rose-200 text-rose-700 placeholder:text-rose-300`} />
                  )}
                </div>
              </div>

              <div className="xl:col-span-2">
                <label className={labelClass}>數量 / 單價</label>
                <div className="flex gap-2">
                  <input type="number" min="1" value={row.quantity} onChange={e => updateRow(idx, 'quantity', e.target.value)} className={`${inputClass} text-center`} />
                  <input type="number" min="0" value={row.unitPrice} onChange={e => updateRow(idx, 'unitPrice', e.target.value)} className={`${inputClass} text-right`} />
                </div>
              </div>

              <div className="xl:col-span-2 flex justify-end gap-2">
                <button onClick={() => duplicateRow(idx)} className="p-3 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all" title="複製此行">📋</button>
                <button onClick={() => removeRow(idx)} className="p-3 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all">🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-10 border-t border-slate-200">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-3">
          <span className="w-1 h-4 bg-slate-300 rounded-full"></span>
          資料庫最近 10 筆存檔紀錄 (參考用)
        </h3>
        <div className="bg-white rounded-[2rem] border border-slate-200/60 overflow-hidden opacity-60 hover:opacity-100 transition-all shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">日期</th>
                <th className="px-6 py-4">人員</th>
                <th className="px-6 py-4">機台/料件</th>
                <th className="px-6 py-4 text-right">數量</th>
                <th className="px-6 py-4 text-right">總額</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {historicalData.recentTen.map(t => (
                <tr key={t.id} className="text-[11px] font-bold">
                  <td className="px-6 py-3 text-slate-500">{t.date}</td>
                  <td className="px-6 py-3 text-indigo-600">{t.operator}</td>
                  <td className="px-6 py-3">
                    <span className="text-slate-900">{t.materialName}</span>
                    <span className="text-slate-400 ml-2">({t.machineNumber})</span>
                  </td>
                  <td className="px-6 py-3 text-right">{t.quantity}</td>
                  <td className="px-6 py-3 text-right text-slate-400">NT$ {t.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BatchAddForm;
