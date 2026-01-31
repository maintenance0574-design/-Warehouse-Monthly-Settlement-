
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
    quantity: 1,
    unitPrice: 0,
    note: '',
    operator: currentUser,
    isReceived: false 
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
        quantity: Number(initialData.quantity) || 0,
        unitPrice: Number(initialData.unitPrice) || 0,
        note: String(initialData.note || ''),
        operator: initialData.operator || currentUser,
        isReceived: initialData.isReceived !== undefined ? !!initialData.isReceived : false
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
      if (!initialData) setFormData(prev => ({ ...prev, materialName: '', materialNumber: '', machineNumber: '', quantity: 1, unitPrice: 0, note: '', isReceived: false }));
    }
    setIsSyncing(false);
  };

  const inputClasses = `w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 outline-none transition-all font-bold text-base text-black focus:ring-indigo-500/10 focus:border-indigo-500`;
  const labelClasses = `block text-[14px] font-black uppercase tracking-widest mb-2 ml-1 text-slate-500`;

  const isInbound = formData.type === TransactionType.INBOUND;

  return (
    <form onSubmit={handleSubmit} className="p-8 rounded-[2rem] shadow-xl border border-slate-200/60 transition-all duration-300 bg-white w-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <span className="w-1.5 h-6 rounded-full bg-indigo-600"></span>
          {title || "核銷單存檔"}
        </h3>
        {onCancel && <button type="button" onClick={onCancel} className="text-slate-300 hover:text-rose-600 transition-colors text-xl">✕</button>}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelClasses}>單據日期</label>
            <input type="date" className={inputClasses} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className={labelClasses}>紀錄類別</label>
            <select className={`${inputClasses} text-lg font-black text-indigo-700 h-[52px]`} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
              <option value={TransactionType.USAGE}>{TransactionType.USAGE}</option>
              <option value={TransactionType.INBOUND}>{TransactionType.INBOUND}</option>
              <option value={TransactionType.CONSTRUCTION}>{TransactionType.CONSTRUCTION}</option>
            </select>
          </div>
          <div>
            <label className={labelClasses}>帳目類別</label>
            <select className={`${inputClasses} text-lg font-black h-[52px]`} value={formData.accountCategory} onChange={e => setFormData({...formData, accountCategory: e.target.value})}>
              {ACCOUNT_CATEGORIES.map(acc => <option key={acc} value={acc}>{acc} 類</option>)}
            </select>
          </div>
        </div>

        {isInbound && (
          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
            <div>
              <p className="text-[12px] font-black text-indigo-600 uppercase">實物收貨追蹤</p>
              <p className="text-[11px] text-slate-400 font-bold">料件是否已到貨</p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={formData.isReceived} onChange={e => setFormData({...formData, isReceived: e.target.checked})} className="hidden" />
              <div className={`w-12 h-6 rounded-full relative transition-all duration-300 ${formData.isReceived ? 'bg-emerald-500' : 'bg-amber-400'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${formData.isReceived ? 'left-7' : 'left-1'}`}></div>
              </div>
              <span className={`text-[12px] font-black ${formData.isReceived ? 'text-emerald-600' : 'text-amber-600'}`}>
                {formData.isReceived ? '已收貨' : '待收貨'}
              </span>
            </label>
          </div>
        )}

        <div className="relative">
          <label className={labelClasses}>料件名稱</label>
          <input type="text" placeholder="名稱..." required className={inputClasses} value={formData.materialName} autoComplete="off" onChange={e => handleInputChange('materialName', e.target.value)} />
          {suggestions.items.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden max-h-40 overflow-y-auto">
              {suggestions.items.map((item, idx) => (
                <button key={idx} type="button" className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 border-b border-slate-50 last:border-0" onClick={() => selectSuggestion(item)}>{item}</button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>料件編號 (P/N)</label>
            <input type="text" placeholder="P/N..." className={inputClasses} value={formData.materialNumber} onChange={e => setFormData({...formData, materialNumber: e.target.value})} />
          </div>
          <div>
            <label className={labelClasses}>機台 ID</label>
            <input type="text" placeholder="ID..." className={inputClasses} value={formData.machineNumber} onChange={e => setFormData({...formData, machineNumber: e.target.value})} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>機台種類</label>
            <select className={inputClasses} value={formData.machineCategory} onChange={e => setFormData({...formData, machineCategory: e.target.value})}>
              {MACHINE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClasses}>數量 / 單價</label>
            <div className="flex gap-2">
              <input type="number" min="1" className={`${inputClasses} text-center px-1`} value={formData.quantity} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} />
              <input type="number" placeholder="0" className={`${inputClasses} text-right px-1`} value={formData.unitPrice} onChange={e => setFormData({...formData, unitPrice: Number(e.target.value)})} />
            </div>
          </div>
        </div>

        <div>
          <label className={labelClasses}>結算總額</label>
          <div className="px-5 py-3 bg-slate-900 text-indigo-400 rounded-xl font-black text-lg tabular-nums text-center shadow-inner border border-white/5">
            NT$ {(formData.quantity * formData.unitPrice).toLocaleString()}
          </div>
        </div>

        <div>
          <label className={labelClasses}>備註事項</label>
          <textarea placeholder="備註..." className={`${inputClasses} min-h-[60px] py-3 resize-none`} value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})}></textarea>
        </div>
      </div>

      <button type="submit" disabled={isSyncing} className={`mt-8 w-full font-black py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] text-lg ${isSuccess ? "bg-emerald-500 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"}`}>
        {isSyncing ? "同步中..." : isSuccess ? "✅ 存檔成功" : "確認存檔"}
      </button>
    </form>
  );
};

export default TransactionForm;
