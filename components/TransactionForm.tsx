
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TransactionType, Transaction } from '../types';

interface Props {
  onSave: (transaction: Transaction) => Promise<boolean>;
  initialData?: Transaction;
  onCancel?: () => void;
  title?: string;
  existingTransactions?: Transaction[];
  currentUser: string;
}

const MACHINE_CATEGORIES = ['BA', 'RL', 'SB', 'XD', '7UP', 'HOT8', '3card', 'DT', 'CG', '共用'];
const ACCOUNT_CATEGORIES = ['A', 'B', 'C'];
const getTaipeiToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });

const TransactionForm: React.FC<Props> = ({ onSave, initialData, onCancel, title, existingTransactions = [], currentUser }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    date: getTaipeiToday(),
    type: TransactionType.USAGE,
    accountCategory: ACCOUNT_CATEGORIES[0],
    materialName: '',
    materialNumber: '',
    machineCategory: MACHINE_CATEGORIES[0],
    machineNumber: '',
    sn: '',
    quantity: 1,
    unitPrice: 0,
    note: '',
    operator: currentUser
  });

  const [suggestions, setSuggestions] = useState<{ field: string, items: string[] }>({ field: '', items: [] });

  useEffect(() => {
    if (initialData) {
      setFormData({
        date: initialData.date || getTaipeiToday(),
        type: initialData.type === TransactionType.REPAIR ? TransactionType.USAGE : initialData.type,
        accountCategory: initialData.accountCategory || ACCOUNT_CATEGORIES[0],
        materialName: String(initialData.materialName || ''),
        materialNumber: String(initialData.materialNumber || ''),
        machineCategory: String(initialData.machineCategory || MACHINE_CATEGORIES[0]),
        machineNumber: String(initialData.machineNumber || ''),
        sn: String(initialData.sn || ''),
        quantity: Number(initialData.quantity) || 0,
        unitPrice: Number(initialData.unitPrice) || 0,
        note: String(initialData.note || ''),
        operator: initialData.operator || currentUser
      });
    } else {
      setFormData(prev => ({ ...prev, operator: currentUser }));
    }
  }, [initialData, currentUser]);

  const historicalData = useMemo(() => {
    const names = new Set<string>();
    const nameToDetails: Record<string, { number: string, machine: string }> = {};
    existingTransactions.forEach(t => {
      if (t.materialName) {
        names.add(t.materialName);
        nameToDetails[t.materialName] = { 
          number: t.materialNumber || '', 
          machine: t.machineCategory || MACHINE_CATEGORIES[0] 
        };
      }
    });
    return { names: Array.from(names), nameToDetails };
  }, [existingTransactions]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'materialName') {
      const filtered = value.trim() ? historicalData.names.filter(item => item.toLowerCase().includes(value.toLowerCase()) && item !== value).slice(0, 5) : [];
      setSuggestions({ field, items: filtered });
    }
  };

  const selectSuggestion = (value: string) => {
    const details = historicalData.nameToDetails[value];
    setFormData(prev => ({ 
      ...prev, 
      materialName: value,
      materialNumber: details?.number || prev.materialNumber,
      machineCategory: details?.machine || prev.machineCategory
    }));
    setSuggestions({ field: '', items: [] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.materialName.trim()) return;
    setIsSyncing(true);
    const qty = Number(formData.quantity) || 0;
    const price = Number(formData.unitPrice) || 0;
    const tx: Transaction = {
      ...formData,
      id: initialData?.id || 'TX' + Date.now(),
      quantity: qty,
      unitPrice: price,
      total: qty * price,
      operator: currentUser
    };
    const result = await onSave(tx);
    if (result) {
      setIsSuccess(true);
      setTimeout(() => { setIsSuccess(false); if (onCancel && initialData) onCancel(); }, 1200);
      if (!initialData) setFormData(prev => ({ ...prev, materialName: '', materialNumber: '', machineNumber: '', sn: '', quantity: 1, unitPrice: 0, note: '' }));
    }
    setIsSyncing(false);
  };

  // 緊湊型樣式
  const inputClasses = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-sm text-black";
  const labelClasses = "block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1";

  return (
    <form onSubmit={handleSubmit} className="bg-white p-5 rounded-[1.5rem] shadow-xl border border-slate-200/60 w-full overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-indigo-600"></span>
          {title || "核銷單存檔"}
        </h3>
        {onCancel && <button type="button" onClick={onCancel} className="text-slate-300 hover:text-rose-600 transition-colors">✕</button>}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>單據日期</label>
            <input type="date" className={inputClasses} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
          </div>
          <div>
            <label className={labelClasses}>人員 (鎖定)</label>
            <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-bold text-sm text-slate-400 flex items-center gap-2 truncate">
              👤 {formData.operator}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>紀錄類別</label>
            <select className={`${inputClasses} text-indigo-600`} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
              <option value={TransactionType.USAGE}>{TransactionType.USAGE}</option>
              <option value={TransactionType.INBOUND}>{TransactionType.INBOUND}</option>
              <option value={TransactionType.CONSTRUCTION}>{TransactionType.CONSTRUCTION}</option>
            </select>
          </div>
          <div>
            <label className={labelClasses}>帳目類別</label>
            <select className={inputClasses} value={formData.accountCategory} onChange={e => setFormData({...formData, accountCategory: e.target.value})}>
              {ACCOUNT_CATEGORIES.map(acc => <option key={acc} value={acc}>{acc} 類</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-1">
          <div className="relative">
            <label className={labelClasses}>料件名稱</label>
            <input type="text" placeholder="名稱..." required className={inputClasses} value={formData.materialName} autoComplete="off" onChange={e => handleInputChange('materialName', e.target.value)} />
            {suggestions.items.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden max-h-40 overflow-y-auto">
                {suggestions.items.map((item, idx) => (
                  <button key={idx} type="button" className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 border-b border-slate-50 last:border-0" onClick={() => selectSuggestion(item)}>{item}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>料件編號 (P/N)</label>
            <input type="text" placeholder="P/N..." className={inputClasses} value={formData.materialNumber} onChange={e => setFormData({...formData, materialNumber: e.target.value})} />
          </div>
          <div>
            <label className={labelClasses}>機台 ID (編號)</label>
            <input type="text" placeholder="ID..." className={inputClasses} value={formData.machineNumber} onChange={e => setFormData({...formData, machineNumber: e.target.value})} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>機台種類</label>
            <select className={inputClasses} value={formData.machineCategory} onChange={e => setFormData({...formData, machineCategory: e.target.value})}>
              {MACHINE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClasses}>數量 / 單價</label>
            <div className="flex gap-1">
              <input type="number" min="1" className={`${inputClasses} text-center px-1`} value={formData.quantity} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} />
              <input type="number" placeholder="0" className={`${inputClasses} text-right px-1`} value={formData.unitPrice} onChange={e => setFormData({...formData, unitPrice: Number(e.target.value)})} />
            </div>
          </div>
        </div>

        <div>
          <label className={labelClasses}>結算總額</label>
          <div className="px-4 py-2 bg-slate-900 text-indigo-400 rounded-lg font-black text-base tabular-nums text-center shadow-inner">
            NT$ {(formData.quantity * formData.unitPrice).toLocaleString()}
          </div>
        </div>

        <div>
          <label className={labelClasses}>備註事項</label>
          <textarea placeholder="備註..." className={`${inputClasses} min-h-[44px] py-1.5 resize-none`} value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})}></textarea>
        </div>
      </div>

      <button type="submit" disabled={isSyncing} className={`mt-5 w-full font-black py-3 rounded-xl transition-all shadow-lg active:scale-[0.98] text-sm ${isSuccess ? "bg-emerald-500 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"}`}>
        {isSyncing ? "同步中..." : isSuccess ? "✅ 存檔成功" : "確認存檔"}
      </button>
    </form>
  );
};

export default TransactionForm;
