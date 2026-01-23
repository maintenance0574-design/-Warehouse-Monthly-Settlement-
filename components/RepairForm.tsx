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
    note: '',
    operator: currentUser,
    faultReason: '',
    sentDate: '',
    repairDate: '',
    installDate: '',
    accountCategory: '維修'
  });

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

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...formData,
        ...initialData,
        date: initialData.date || getTaipeiToday(),
        operator: initialData.operator || currentUser
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
      machineCategory: details?.machine || prev.machineCategory
    }));
    setSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    const tx: Transaction = {
      ...formData,
      id: initialData?.id || 'RP' + Date.now(),
      unitPrice: 0,
      total: 0,
      operator: currentUser
    };
    const result = await onSave(tx);
    if (result) {
      setIsSuccess(true);
      setTimeout(() => { setIsSuccess(false); if (onCancel) onCancel(); }, 1200);
      if (!initialData) setFormData({ ...formData, materialName: '', materialNumber: '', machineNumber: '', sn: '', quantity: 1, note: '', faultReason: '', sentDate: '', repairDate: '', installDate: '', operator: currentUser });
    }
    setIsSyncing(false);
  };

  const inputClasses = "w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-xs text-slate-700";
  const labelClasses = "block text-[9px] font-black text-emerald-600/60 uppercase tracking-widest mb-0.5 ml-1";

  return (
    <form onSubmit={handleSubmit} className="bg-white p-5 rounded-[1.5rem] shadow-xl border border-emerald-100 relative">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-emerald-500"></span>
          {initialData ? "編輯維修紀錄" : "新增維修案件"}
        </h3>
        {onCancel && <button type="button" onClick={onCancel} className="text-slate-300 hover:text-rose-600 transition-colors">✕</button>}
      </div>

      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>單據日期</label>
            <input type="date" className={inputClasses} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
          </div>
          <div>
            <label className={labelClasses}>操作人員 (已鎖定)</label>
            <div className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-black text-xs text-slate-400 flex items-center gap-2">
              👤 {formData.operator}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>設備 SN 序號</label>
            <input type="text" placeholder="SN..." className={`${inputClasses} border-emerald-200 bg-emerald-50/10`} value={formData.sn} onChange={e => setFormData({...formData, sn: e.target.value})} />
          </div>
          <div>
            <label className={labelClasses}>機台 ID (編號)</label>
            <input type="text" placeholder="ID..." className={inputClasses} value={formData.machineNumber} onChange={e => setFormData({...formData, machineNumber: e.target.value})} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <label className={labelClasses}>維修零件/主體</label>
            <input 
              type="text" 
              required 
              placeholder="名稱..." 
              className={`${inputClasses} border-indigo-100`} 
              value={formData.materialName} 
              autoComplete="off"
              onChange={e => handleMaterialNameChange(e.target.value)} 
            />
            {suggestions.length > 0 && (
              <div ref={suggestionRef} className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden">
                {suggestions.map((name, i) => (
                  <button 
                    key={i} 
                    type="button" 
                    onClick={() => selectSuggestion(name)}
                    className="w-full text-left px-3 py-2 text-[10px] font-black text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 border-b border-slate-50 last:border-0"
                  >
                    💡 {name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className={labelClasses}>料件編號 (P/N)</label>
            <input type="text" placeholder="P/N..." className={inputClasses} value={formData.materialNumber} onChange={e => setFormData({...formData, materialNumber: e.target.value})} />
          </div>
        </div>

        <div>
          <label className={labelClasses}>故障原因 (必填)</label>
          <input 
            type="text" 
            placeholder="描述故障情況..." 
            className={`${inputClasses} border-amber-200 focus:border-amber-500`} 
            value={formData.faultReason} 
            required
            onChange={e => setFormData({...formData, faultReason: e.target.value})} 
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>維修數量</label>
            <input type="number" min="1" className={inputClasses} value={formData.quantity} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} />
          </div>
          <div>
            <label className={labelClasses}>機台類別</label>
            <select className={inputClasses} value={formData.machineCategory} onChange={e => setFormData({...formData, machineCategory: e.target.value})}>
              {MACHINE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 mt-1">
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">進度追蹤</p>
           <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelClasses}>送修日</label>
                <input type="date" className={inputClasses} value={formData.sentDate} onChange={e => setFormData({...formData, sentDate: e.target.value})} />
              </div>
              <div>
                <label className={labelClasses}>完修日</label>
                <input type="date" className={inputClasses} value={formData.repairDate} onChange={e => setFormData({...formData, repairDate: e.target.value})} />
              </div>
              <div>
                <label className={labelClasses}>上機日</label>
                <input type="date" className={inputClasses} value={formData.installDate} onChange={e => setFormData({...formData, installDate: e.target.value})} />
              </div>
           </div>
        </div>

        <div>
          <label className={labelClasses}>其他備註</label>
          <textarea className={`${inputClasses} min-h-[35px] resize-none`} value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})}></textarea>
        </div>
      </div>

      <button type="submit" disabled={isSyncing} className={`mt-4 w-full font-black py-2.5 rounded-xl transition-all shadow-lg text-sm ${isSuccess ? "bg-emerald-500 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}>
        {isSyncing ? "同步中..." : isSuccess ? "✅ 維修單已建檔" : "存入維修紀錄"}
      </button>
    </form>
  );
};

export default RepairForm;