
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
      accountCategory: '', 
      materialName: '',
      materialNumber: '',
      machineCategory: 'BA',
      machineNumber: '',
      sn: '', 
      faultReason: '',
      quantity: 1,
      unitPrice: 0,
      note: '',
      operator: currentUser,
      isReceived: false // 預設修改為待收貨
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

    return { names: Array.from(names), numbers: Array.from(numbers), nameToDetails };
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
      operator: currentUser,
      isReceived: false // 預設修改為待收貨
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
      const filtered = value.trim() ? source.filter(item => item.toLowerCase().includes(value.toLowerCase()) && item !== value).slice(0, 5) : [];
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
        const isRepair = row.type === TransactionType.REPAIR;
        const isInbound = row.type === TransactionType.INBOUND;
        const tx: Transaction = {
          ...row,
          id: 'TX-B' + Date.now() + Math.random().toString(36).substr(2, 5),
          quantity: Number(row.quantity),
          unitPrice: Number(row.unitPrice),
          total: Number(row.quantity) * Number(row.unitPrice),
          operator: currentUser,
          accountCategory: isRepair ? '' : (row.accountCategory || 'A')
        };
        // 精準清理：除了進貨外其餘皆不具備 isReceived 屬性
        if (!isInbound) {
          delete (tx as any).isReceived;
        } else {
          tx.isReceived = row.isReceived === undefined ? false : !!row.isReceived;
        }

        if (!isRepair) {
          delete tx.sn;
          delete tx.faultReason;
          delete tx.isScrapped;
          delete tx.sentDate;
          delete tx.repairDate;
          delete tx.installDate;
        }
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
  const labelClass = "block text-sm font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1";
  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all";

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl flex flex-wrap justify-between items-center gap-8 sticky top-4 z-10 border border-white/5">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-3xl shadow-lg">⚡</div>
          <div>
            <h2 className="text-xl font-black text-white">智慧批次新增</h2>
            <p className="text-sm text-indigo-400 font-bold uppercase tracking-widest mt-1">目前準備並行提交 {rows.length} 筆紀錄</p>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-black text-slate-500 uppercase mb-1">預估總計</p>
            <p className="text-2xl font-black text-indigo-400">NT$ {totalAmount.toLocaleString()}</p>
          </div>
          <div className="flex gap-3">
             <button onClick={addRow} className="px-6 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-sm transition-all">+ 新增空白列</button>
             <button onClick={handleSubmit} disabled={isSubmitting} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all">
                {isSubmitting ? `並行同步中 ${progress.current}/${progress.total}` : "🚀 開始全量同步"}
             </button>
          </div>
        </div>
      </div>
      <div className="space-y-5">
        {rows.map((row, idx) => {
          const isRepair = row.type === TransactionType.REPAIR;
          const isInbound = row.type === TransactionType.INBOUND;
          return (
            <div key={row.id} className={`bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200/60 transition-all hover:border-indigo-500 relative ${idx === 0 ? 'ring-2 ring-indigo-500/20 bg-indigo-50/5' : ''}`}>
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-end">
                <div className="xl:col-span-2">
                  <label className={labelClass}>日期/類別</label>
                  <div className="flex gap-2">
                    <div className="flex-1"><input type="date" value={row.date} onChange={e => updateRow(idx, 'date', e.target.value)} className={inputClass} /></div>
                    <div className="w-28"><select value={row.type} onChange={e => updateRow(idx, 'type', e.target.value)} className={`${inputClass} text-indigo-600`}>
                      {Object.values(TransactionType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select></div>
                  </div>
                </div>
                <div className="xl:col-span-3 relative">
                  <label className={labelClass}>料件名稱 / 料號 (PN)</label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input type="text" placeholder="名稱..." value={row.materialName} onChange={e => updateRow(idx, 'materialName', e.target.value)} className={inputClass} />
                      {suggestions.rowId === row.id && suggestions.field === 'materialName' && suggestions.items.length > 0 && (
                        <div ref={suggestionRef} className="absolute z-50 left-0 right-0 top-full mt-2 bg-white shadow-2xl border border-slate-200 rounded-2xl overflow-hidden">
                          {suggestions.items.map((item, sIdx) => (<button key={sIdx} onClick={() => selectSuggestion(idx, 'materialName', item)} className="w-full text-left px-5 py-3 text-sm font-black text-slate-600 hover:bg-indigo-600 hover:text-white border-b border-slate-50 last:border-0">💡 {item}</button>))}
                        </div>
                      )}
                    </div>
                    <div className="flex-1"><input type="text" placeholder="PN..." value={row.materialNumber} onChange={e => updateRow(idx, 'materialNumber', e.target.value)} className={inputClass} /></div>
                  </div>
                </div>
                <div className="xl:col-span-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className={labelClass}>機台 ID {isRepair && '/ SN / 故障'}</label>
                    {isInbound && (
                      <button onClick={() => updateRow(idx, 'isReceived', !row.isReceived)} className={`px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all ${row.isReceived ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                        {row.isReceived ? '已收貨' : '待收貨'}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <div className={isRepair ? "flex-1" : "w-full"}><input type="text" placeholder="機台 ID..." value={row.machineNumber} onChange={e => updateRow(idx, 'machineNumber', e.target.value)} className={inputClass} /></div>
                      {isRepair && <div className="flex-1"><input type="text" placeholder="SN..." value={row.sn} onChange={e => updateRow(idx, 'sn', e.target.value)} className={`${inputClass} border-emerald-100 text-emerald-600`} /></div>}
                    </div>
                    {isRepair && <input type="text" placeholder="故障原因 (必填)..." value={row.faultReason} onChange={e => updateRow(idx, 'faultReason', e.target.value)} className={`${inputClass} bg-rose-50 border-rose-200 text-rose-700 placeholder:text-rose-300`} />}
                  </div>
                </div>
                <div className="xl:col-span-2">
                  <label className={labelClass}>數量 / 單價</label>
                  <div className="flex gap-2">
                    <div className="flex-1"><input type="number" min="1" value={row.quantity} onChange={e => updateRow(idx, 'quantity', e.target.value)} className={`${inputClass} text-center`} /></div>
                    <div className="flex-1"><input type="number" min="0" value={row.unitPrice} onChange={e => updateRow(idx, 'unitPrice', e.target.value)} className={`${inputClass} text-right`} /></div>
                  </div>
                </div>
                <div className="xl:col-span-2 flex justify-end gap-3">
                  <button onClick={() => duplicateRow(idx)} className="p-4 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm" title="複製此行">📋</button>
                  <button onClick={() => removeRow(idx)} className="p-4 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all shadow-sm">🗑️</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BatchAddForm;
