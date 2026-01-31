
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TransactionType, Transaction } from '../types';

interface Props {
  onSave: (transaction: Transaction) => Promise<boolean>;
  initialData?: Transaction;
  onCancel?: () => void;
  existingTransactions?: Transaction[];
  currentUser: string;
}

const MACHINE_CATEGORIES = ['BA', 'RL', 'SB', 'XD', '7UP', 'HOT8', '3card', 'DT', 'CG', '共用'];
const getTaipeiToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });

const RepairForm: React.FC<Props> = ({ onSave, initialData, onCancel, existingTransactions = [], currentUser }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const suggestionRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState({
    date: getTaipeiToday(),
    type: TransactionType.REPAIR,
    materialName: '',
    materialNumber: '',
    machineCategory: MACHINE_CATEGORIES[0],
    machineNumber: '',
    sn: '',
    quantity: 1,
    unitPrice: 0,
    note: '',
    operator: currentUser,
    faultReason: '',
    isScrapped: false,
    sentDate: '',
    repairDate: '',
    installDate: ''
  });

  const historicalData = useMemo(() => {
    const names = new Set<string>();
    const nameToDetails: Record<string, { number: string, machine: string, price: number }> = {};
    existingTransactions.forEach(t => {
      if (t.materialName) {
        names.add(t.materialName);
        nameToDetails[t.materialName] = { 
          number: t.materialNumber || '', 
          machine: t.machineCategory || MACHINE_CATEGORIES[0],
          price: t.unitPrice || 0
        };
      }
    });
    return { names: Array.from(names), nameToDetails };
  }, [existingTransactions]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...formData,
        ...initialData,
        date: initialData.date || getTaipeiToday(),
        operator: initialData.operator || currentUser,
        isScrapped: !!initialData.isScrapped,
        unitPrice: initialData.unitPrice || 0
      });
    } else {
      setFormData(prev => ({ ...prev, operator: currentUser }));
    }
  }, [initialData, currentUser]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) {
        setSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleMaterialNameChange = (val: string) => {
    setFormData(prev => ({ ...prev, materialName: val }));
    if (val.trim()) {
      const filtered = historicalData.names.filter(n => 
        n.toLowerCase().includes(val.toLowerCase()) && n !== val
      ).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const selectSuggestion = (name: string) => {
    const details = historicalData.nameToDetails[name];
    setFormData(prev => ({
      ...prev,
      materialName: name,
      materialNumber: details?.number || prev.materialNumber,
      machineCategory: details?.machine || prev.machineCategory,
      unitPrice: details?.price || prev.unitPrice
    }));
    setSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    let finalNote = formData.note.trim();
    if (formData.isScrapped && !finalNote.includes('報廢')) {
      finalNote = `【報廢】${finalNote}`.trim();
    }
    
    const finalPrice = formData.isScrapped ? 0 : Number(formData.unitPrice);
    
    const tx: Transaction = {
      ...formData,
      note: finalNote,
      id: initialData?.id || 'RP' + Date.now(),
      unitPrice: finalPrice,
      total: Number(formData.quantity) * finalPrice,
      operator: currentUser,
      isScrapped: !!formData.isScrapped,
      repairDate: formData.isScrapped ? '' : formData.repairDate,
      installDate: formData.isScrapped ? '' : formData.installDate,
      accountCategory: '' // Explicitly empty for repairs
    };
    const result = await onSave(tx);
    if (result) {
      setIsSuccess(true);
      setTimeout(() => { setIsSuccess(false); if (onCancel) onCancel(); }, 1200);
      if (!initialData) setFormData({ ...formData, materialName: '', materialNumber: '', machineNumber: '', sn: '', quantity: 1, unitPrice: 0, note: '', faultReason: '', isScrapped: false, sentDate: '', repairDate: '', installDate: '', operator: currentUser });
    }
    setIsSyncing(false);
  };

  const inputClasses = `w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 outline-none transition-all font-bold text-base text-slate-700 ${formData.isScrapped ? 'focus:ring-rose-500/10 focus:border-rose-500' : 'focus:ring-emerald-500/10 focus:border-emerald-500'}`;
  const labelClasses = `block text-[14px] font-black uppercase tracking-widest mb-2 ml-1 ${formData.isScrapped ? 'text-rose-600' : 'text-emerald-700/70'}`;

  return (
    <form onSubmit={handleSubmit} className={`p-8 rounded-[2rem] shadow-xl border transition-colors duration-500 bg-white w-full ${formData.isScrapped ? 'border-rose-100 ring-4 ring-rose-50' : 'border-emerald-100'}`}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <span className={`w-1.5 h-6 rounded-full ${formData.isScrapped ? 'bg-rose-600' : 'bg-emerald-500'}`}></span>
          {initialData ? "編輯維修" : "新增維修"} {formData.isScrapped && <span className="text-rose-600 ml-1 text-sm">💀</span>}
        </h3>
        {onCancel && <button type="button" onClick={onCancel} className="text-slate-300 hover:text-rose-600 transition-colors text-xl">✕</button>}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>單據日期</label>
            <input type="date" className={inputClasses} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-3 cursor-pointer group mb-2 ml-1">
              <input type="checkbox" checked={formData.isScrapped} onChange={e => setFormData({...formData, isScrapped: e.target.checked})} className="hidden" />
              <div className={`w-12 h-6 rounded-full relative transition-all duration-300 ${formData.isScrapped ? 'bg-rose-600' : 'bg-slate-200'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${formData.isScrapped ? 'left-7' : 'left-1'}`}></div>
              </div>
              <span className={`text-[12px] font-black uppercase ${formData.isScrapped ? 'text-rose-600' : 'text-slate-400'}`}>報廢標記</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>設備序號 (SN)</label>
            <input type="text" placeholder="SN..." className={inputClasses} value={formData.sn} onChange={e => setFormData({...formData, sn: e.target.value})} />
          </div>
          <div>
            <label className={labelClasses}>機台 ID</label>
            <input type="text" placeholder="ID..." className={inputClasses} value={formData.machineNumber} onChange={e => setFormData({...formData, machineNumber: e.target.value})} />
          </div>
        </div>

        <div className="relative">
          <label className={labelClasses}>維修零件/主體</label>
          <input type="text" required placeholder="名稱..." className={inputClasses} value={formData.materialName} autoComplete="off" onChange={e => handleMaterialNameChange(e.target.value)} />
          {suggestions.length > 0 && (
            <div ref={suggestionRef} className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
              {suggestions.map((name, i) => (
                <button key={i} type="button" onClick={() => selectSuggestion(name)} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 border-b border-slate-50 last:border-0">💡 {name}</button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>數量 / 維修單價</label>
            <div className="flex gap-2">
              <input type="number" min="1" className={`${inputClasses} text-center px-1`} value={formData.quantity} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} />
              <input type="number" disabled={formData.isScrapped} placeholder="費用..." className={`${inputClasses} text-right px-1 disabled:opacity-30`} value={formData.unitPrice} onChange={e => setFormData({...formData, unitPrice: Number(e.target.value)})} />
            </div>
          </div>
          <div>
            <label className={labelClasses}>機台類別</label>
            <select className={inputClasses} value={formData.machineCategory} onChange={e => setFormData({...formData, machineCategory: e.target.value})}>
              {MACHINE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>

        {!formData.isScrapped && (
          <div>
            <label className={labelClasses}>本筆維修小計</label>
            <div className="px-5 py-3 bg-slate-900 text-emerald-400 rounded-xl font-black text-lg tabular-nums text-center shadow-inner border border-white/5">
              NT$ {(Number(formData.quantity) * Number(formData.unitPrice)).toLocaleString()}
            </div>
          </div>
        )}

        <div>
          <label className={labelClasses}>故障原因 (必填)</label>
          <input type="text" placeholder="描述..." className={inputClasses} value={formData.faultReason} required onChange={e => setFormData({...formData, faultReason: e.target.value})} />
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className={labelClasses}>送修日</label>
            <input type="date" className={`${inputClasses} px-1`} value={formData.sentDate} onChange={e => setFormData({...formData, sentDate: e.target.value})} />
          </div>
          
          {!formData.isScrapped && (
            <>
              <div>
                <label className={labelClasses}>完修日</label>
                <input type="date" className={`${inputClasses} px-1`} value={formData.repairDate} onChange={e => setFormData({...formData, repairDate: e.target.value})} />
              </div>
              <div>
                <label className={labelClasses}>上機日</label>
                <input type="date" className={`${inputClasses} px-1`} value={formData.installDate} onChange={e => setFormData({...formData, installDate: e.target.value})} />
              </div>
            </>
          )}
        </div>

        <div>
          <label className={labelClasses}>備註說明</label>
          <textarea className={`${inputClasses} min-h-[50px] py-2 resize-none`} value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})}></textarea>
        </div>
      </div>

      <button type="submit" disabled={isSyncing} className={`mt-6 w-full font-black py-4 rounded-xl transition-all shadow-lg text-lg active:scale-[0.98] ${isSuccess ? "bg-emerald-500 text-white" : formData.isScrapped ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}>
        {isSyncing ? "同步中..." : isSuccess ? "✅ 已更新" : formData.isScrapped ? "💀 確認報廢" : "存入紀錄"}
      </button>
    </form>
  );
};

export default RepairForm;
