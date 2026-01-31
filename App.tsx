
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, TransactionType } from './types';
import TransactionForm from './components/TransactionForm';
import RepairForm from './components/RepairForm';
import BatchAddForm from './components/BatchAddForm';
import Dashboard from './components/Dashboard';
import LoginScreen from './components/LoginScreen';
import { dbService } from './services/dbService';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell } from 'recharts';

const getTaipeiDate = (dateInput?: string | Date): string => {
  const d = dateInput ? new Date(dateInput) : new Date();
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
};

const NEW_TARGET_URL = "https://script.google.com/macros/s/AKfycby4yVDJXoV-mQRiZ5WYTjQOGnPxg_iMcasOcZTXkDwXcvw0LCA0-xacL5pGwBBPEcDd/exec";
const ITEMS_PER_PAGE = 15;

const App: React.FC = () => {
  // 1. 基礎狀態
  const [currentUser, setCurrentUser] = useState<string | null>(() => sessionStorage.getItem('wms_current_user'));
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('wms_cache_data');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'records' | 'repairs' | 'batch'>(
    (localStorage.getItem('ui_active_tab') as any) || 'dashboard'
  );

  // 2. 篩選與分頁狀態
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_inbound' | 'scrapped' | 'repairing'>('all');
  const [recordCategoryFilter, setRecordCategoryFilter] = useState<'all' | TransactionType.INBOUND | TransactionType.USAGE | TransactionType.CONSTRUCTION>('all');
  const [viewScope, setViewScope] = useState<'monthly' | 'all'>('monthly');
  
  // 日期區間狀態
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [keywordSearch, setKeywordSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  // 3. 維修中心專用狀態
  const [repairAnalysisScope, setRepairAnalysisScope] = useState<'standard' | 'custom'>('standard');
  const [selectedRepairAnalysisYear, setSelectedRepairAnalysisYear] = useState<string>('all');
  const [selectedRepairAnalysisMonth, setSelectedRepairAnalysisMonth] = useState<string>('all');
  const [repairStatsLimit, setRepairStatsLimit] = useState<number>(5);
  const [selectedRepairMaterial, setSelectedRepairMaterial] = useState<string | null>(null);

  // 4. 操作狀態
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // 5. 資料載入
  const loadData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await dbService.fetchAll();
      const formatted = (data || []).map(t => ({ ...t, date: getTaipeiDate(t.date) }));
      setTransactions(formatted);
      localStorage.setItem('wms_cache_data', JSON.stringify(formatted));
    } catch (e) {
      console.error("Fetch data error:", e);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) loadData();
    dbService.forceUpdateUrl(NEW_TARGET_URL);
  }, [currentUser, loadData]);

  // 6. 登出
  const handleLogout = useCallback(() => {
    sessionStorage.clear();
    localStorage.removeItem('wms_cache_data');
    localStorage.removeItem('ui_active_tab');
    setCurrentUser(null);
    setShowLogoutConfirm(false);
    window.location.reload();
  }, []);

  // 7. 衍生計算
  const isRepairs = activeTab === 'repairs';
  const isRecords = activeTab === 'records';

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    transactions.forEach(t => {
      const y = t.date.split('-')[0];
      if (y && y.length === 4) years.add(y);
    });
    if (years.size === 0) years.add(String(new Date().getFullYear()));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const filteredList = useMemo(() => {
    return transactions.filter(t => {
      // 狀態篩選：根據 statusFilter 進行過濾
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending_inbound') return t.type === TransactionType.INBOUND && t.isReceived === false;
        if (statusFilter === 'scrapped') return t.isScrapped === true;
        if (statusFilter === 'repairing') return t.type === TransactionType.REPAIR && !t.repairDate && !t.isScrapped;
      }
      
      // 頁籤內容分流
      if (activeTab === 'records') {
        if (t.type === TransactionType.REPAIR || t.isScrapped === true) return false;
        if (recordCategoryFilter !== 'all' && t.type !== recordCategoryFilter) return false;
      }
      if (activeTab === 'repairs') {
        if (t.type !== TransactionType.REPAIR) return false;
      }

      // 日期區間篩選 (常駐啟用，不論是否為月檢視)
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;

      // 關鍵字搜尋
      const k = keywordSearch.toLowerCase().trim();
      if (k) {
        return t.materialName.toLowerCase().includes(k) || 
               t.materialNumber.toLowerCase().includes(k) || 
               (t.sn && t.sn.toLowerCase().includes(k)) || 
               (t.machineNumber && t.machineNumber.toLowerCase().includes(k));
      }
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, activeTab, statusFilter, recordCategoryFilter, startDate, endDate, keywordSearch]);

  const repairStats = useMemo(() => {
    const repairData = transactions.filter(t => {
      if (t.type !== TransactionType.REPAIR) return false;
      const [y, m] = t.date.split('-');
      if (repairAnalysisScope === 'standard') {
        if (selectedRepairAnalysisYear !== 'all' && y !== selectedRepairAnalysisYear) return false;
        if (selectedRepairAnalysisMonth !== 'all' && m !== selectedRepairAnalysisMonth) return false;
      } else {
        if (startDate && t.date < startDate) return false;
        if (endDate && t.date > endDate) return false;
      }
      return true;
    });

    const map = new Map<string, number>();
    repairData.forEach(t => map.set(t.materialName, (map.get(t.materialName) || 0) + 1));
    const sorted = Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    return repairStatsLimit === -1 ? sorted : sorted.slice(0, repairStatsLimit);
  }, [transactions, repairAnalysisScope, selectedRepairAnalysisYear, selectedRepairAnalysisMonth, startDate, endDate, repairStatsLimit]);

  const displayedList = useMemo(() => {
    // 如果是「最新 10 筆」，在經過日期篩選後只取前 10 筆
    return viewScope === 'monthly' ? filteredList.slice(0, 10) : filteredList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredList, viewScope, currentPage]);

  const totalPages = Math.ceil(filteredList.length / ITEMS_PER_PAGE);

  const handleAction = async (tx: Transaction) => {
    const isUpdate = transactions.some(t => t.id === tx.id);
    const result = await (isUpdate ? dbService.update(tx) : dbService.save(tx));
    if (result) {
      setTransactions(prev => isUpdate ? prev.map(t => t.id === tx.id ? tx : t) : [tx, ...prev]);
    }
    return result;
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const success = await dbService.delete(pendingDelete.id, pendingDelete.type);
    if (success) {
      setTransactions(prev => prev.filter(t => t.id !== pendingDelete.id));
      setPendingDelete(null);
    }
  };

  // 精確篩選列 UI
  const renderFilterHeader = () => (
    <div className="p-6 lg:p-8 border-b border-slate-100 flex flex-col gap-6 bg-white">
      <div className="flex flex-wrap items-center gap-4">
        {/* 視角切換 */}
        <div className="bg-slate-100 p-1 rounded-xl flex shadow-inner shrink-0">
          <button onClick={() => {setViewScope('monthly'); setCurrentPage(1);}} className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${viewScope === 'monthly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>最新 10 筆</button>
          <button onClick={() => {setViewScope('all'); setCurrentPage(1);}} className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${viewScope === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>全部紀錄</button>
        </div>

        {/* 自定義日期區間 (常駐顯示) */}
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm shrink-0">
          <span className="text-sm">📅</span>
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={startDate} 
              onChange={e => {setStartDate(e.target.value); setCurrentPage(1);}} 
              className="bg-transparent text-xs font-black text-indigo-600 outline-none cursor-pointer p-0.5 border-none focus:ring-0" 
            />
            <span className="text-slate-300 text-[10px] font-black uppercase">至</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => {setEndDate(e.target.value); setCurrentPage(1);}} 
              className="bg-transparent text-xs font-black text-indigo-600 outline-none cursor-pointer p-0.5 border-none focus:ring-0" 
            />
          </div>
          {(startDate || endDate) && (
            <button onClick={() => {setStartDate(''); setEndDate('');}} className="ml-1 text-slate-300 hover:text-rose-500 transition-colors">✕</button>
          )}
        </div>

        {/* 狀態選單：根據分頁隔離選項 */}
        <div className="flex items-center gap-3 shrink-0">
          <select 
            value={statusFilter} 
            onChange={e => {setStatusFilter(e.target.value as any); setCurrentPage(1);}} 
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-black outline-none text-slate-600 focus:border-indigo-500 shadow-sm cursor-pointer h-[42px] min-w-[120px]"
          >
            <option value="all">全部狀態</option>
            {isRecords && (
              <option value="pending_inbound">⏳ 尚未收貨</option>
            )}
            {isRepairs && (
              <>
                <option value="scrapped">💀 僅報廢</option>
                <option value="repairing">🛠️ 維修中</option>
              </>
            )}
          </select>

          {isRecords && (
            <select 
              value={recordCategoryFilter} 
              onChange={e => {setRecordCategoryFilter(e.target.value as any); setCurrentPage(1);}} 
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-black outline-none text-slate-600 focus:border-indigo-500 shadow-sm cursor-pointer h-[42px]"
            >
              <option value="all">所有類別</option>
              <option value={TransactionType.INBOUND}>📦 進貨</option>
              <option value={TransactionType.USAGE}>🔧 用料</option>
              <option value={TransactionType.CONSTRUCTION}>🏗️ 建置</option>
            </select>
          )}
        </div>
      </div>

      {/* 搜尋框 */}
      <div className="relative">
        <input 
          type="text" 
          placeholder="搜尋料件、PN、SN 或機台編號..." 
          value={keywordSearch} 
          onChange={e => {setKeywordSearch(e.target.value); setCurrentPage(1);}} 
          className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 outline-none focus:border-indigo-500 shadow-sm transition-all" 
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xl">🔍</span>
      </div>
    </div>
  );

  const renderPagination = () => {
    if (viewScope === 'monthly' || totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-8 py-4 bg-slate-50 border-t border-slate-100">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">共 {filteredList.length} 筆資料</p>
        <div className="flex items-center gap-3">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 rounded-lg bg-white border shadow-sm text-slate-400 hover:text-indigo-600 disabled:opacity-20 transition-colors text-[10px]">◀</button>
          <span className="font-black text-slate-600 text-xs">{currentPage} / {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 rounded-lg bg-white border shadow-sm text-slate-400 hover:text-indigo-600 disabled:opacity-20 transition-colors text-[10px]">▶</button>
        </div>
      </div>
    );
  };

  if (!currentUser) return <LoginScreen onLogin={u => { setCurrentUser(u); sessionStorage.setItem('wms_current_user', u); loadData(); }} />;

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f8fafc] font-['Noto_Sans_TC']">
      <aside className="w-full lg:w-72 bg-[#0f172a] text-white p-8 flex flex-col shrink-0 lg:fixed lg:h-full z-40 shadow-2xl">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-xl shadow-lg">倉</div>
          <h1 className="text-lg font-black tracking-wider">智慧倉儲系統</h1>
        </div>
        <nav className="space-y-1 flex-1">
          {[{ id: 'dashboard', label: '📊 數據總覽' }, { id: 'records', label: '📄 核銷紀錄' }, { id: 'repairs', label: '🛠️ 維修中心' }, { id: 'batch', label: '📥 快速批次' }].map(item => (
            <button key={item.id} onClick={() => { 
              setActiveTab(item.id as any); 
              setStatusFilter('all'); 
              setViewScope('monthly'); 
              setCurrentPage(1); 
            }} className={`w-full text-left px-5 py-4 rounded-xl font-black transition-all ${activeTab === item.id ? 'bg-indigo-600 shadow-xl translate-x-1' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>{item.label}</button>
          ))}
        </nav>
        <button onClick={() => setShowLogoutConfirm(true)} className="mt-6 py-4 bg-rose-600/90 text-white rounded-xl font-black hover:bg-rose-600 transition-all shadow-lg active:scale-95">安全登出</button>
      </aside>

      <main className="flex-1 lg:ml-72 min-h-screen p-6 lg:p-10 flex flex-col gap-10">
        {activeTab === 'dashboard' ? (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="xl:col-span-8"><Dashboard transactions={transactions} /></div>
            <div className="xl:col-span-4"><TransactionForm onSave={handleAction} existingTransactions={transactions} currentUser={currentUser!} /></div>
          </div>
        ) : activeTab === 'repairs' ? (
          <div className="space-y-10">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div className="bg-[#0f172a] rounded-[2.5rem] p-10 flex flex-col h-[500px] shadow-2xl relative overflow-hidden border border-white/5">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <h3 className="text-2xl font-black text-white">維修損耗排行</h3>
                    </div>
                    <div className="flex bg-slate-800 p-1 rounded-xl border border-white/5 shadow-inner">
                      <button onClick={() => setRepairAnalysisScope('standard')} className={`px-4 py-2 text-[11px] font-black rounded-lg transition-all ${repairAnalysisScope === 'standard' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>📅 年/月</button>
                      <button onClick={() => setRepairAnalysisScope('custom')} className={`px-4 py-2 text-[11px] font-black rounded-lg transition-all ${repairAnalysisScope === 'custom' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>⏱️ 自定義</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6 bg-white/5 p-6 rounded-[1.5rem] border border-white/5 mb-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1">顯示筆數</label>
                        <select value={repairStatsLimit} onChange={e => setRepairStatsLimit(Number(e.target.value))} className="w-full bg-slate-800 text-white rounded-xl px-4 py-2 text-sm font-black outline-none border border-white/10 transition-all cursor-pointer">
                            <option value={5}>Top 5 筆</option>
                            <option value={10}>Top 10 筆</option>
                            <option value={-1}>全部顯示</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1">排行時間</label>
                        {repairAnalysisScope === 'standard' ? (
                            <div className="flex gap-2">
                                <select value={selectedRepairAnalysisYear} onChange={e => setSelectedRepairAnalysisYear(e.target.value)} className="flex-1 bg-slate-800 text-emerald-400 rounded-xl px-2 py-2 text-xs font-black outline-none border border-white/10">
                                    <option value="all">歷年</option>
                                    {availableYears.map(y => <option key={y} value={y}>{y}年</option>)}
                                </select>
                                <select value={selectedRepairAnalysisMonth} onChange={e => setSelectedRepairAnalysisMonth(e.target.value)} className="flex-1 bg-slate-800 text-emerald-400 rounded-xl px-2 py-2 text-xs font-black outline-none border border-white/10">
                                    <option value="all">整年</option>
                                    {Array.from({length:12}, (_, i) => String(i+1).padStart(2, '0')).map(m => <option key={m} value={m}>{m}月</option>)}
                                </select>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 bg-slate-800 text-emerald-400 rounded-lg px-2 py-2 text-[10px] font-black border border-white/10 outline-none" />
                                <span className="text-white/20 text-[10px]">~</span>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 bg-slate-800 text-emerald-400 rounded-lg px-2 py-2 text-[10px] font-black border border-white/10 outline-none" />
                            </div>
                        )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {repairStats.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={repairStats} layout="vertical" margin={{ left: -10, right: 30 }}>
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" tick={{fill:'#94a3b8', fontSize:11, fontWeight: 900}} width={140} axisLine={false} tickLine={false} />
                          <RechartsTooltip 
                            cursor={{fill: 'rgba(255,255,255,0.03)'}} 
                            contentStyle={{backgroundColor:'#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px'}} 
                            itemStyle={{color: '#fff', fontWeight: 700}}
                            labelStyle={{color: '#fff', fontWeight: 900, marginBottom: '4px'}}
                          />
                          <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={24} onClick={(d: any) => d && setSelectedRepairMaterial(prev => prev === d.name ? null : d.name)}>
                            {repairStats.map((entry, idx) => <Cell key={`cell-${idx}`} fill="#10b981" opacity={!selectedRepairMaterial || selectedRepairMaterial === entry.name ? 1 : 0.3} className="cursor-pointer transition-all duration-300" />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <div className="h-full flex items-center justify-center text-slate-600 font-black italic">尚無相關數據</div>}
                  </div>
                </div>
              </div>
              <RepairForm onSave={handleAction} existingTransactions={transactions} currentUser={currentUser!} />
            </div>
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200/60 overflow-hidden">
              {renderFilterHeader()}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 font-black text-slate-400 uppercase tracking-widest text-[11px] border-b">
                    <tr><th className="px-8 py-5">序號 / 機台</th><th className="px-8 py-5">維修零件</th><th className="px-8 py-5 text-right">結算金額</th><th className="px-8 py-5 text-center">操作</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold">
                    {displayedList.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-all group/row">
                        <td className="px-8 py-5 text-sm font-black text-slate-800">{t.sn || '--'}<div className="text-[10px] text-slate-400 mt-1">{t.machineNumber || '未指定機台'}</div></td>
                        <td className="px-8 py-5"><div className="text-slate-900 truncate max-w-xs">{t.materialName}</div><div className="flex gap-2 mt-1"><span className="text-[10px] text-rose-500 font-black">{t.faultReason}</span>{t.isScrapped && <span className="bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">報廢</span>}</div></td>
                        <td className="px-8 py-5 text-right font-black text-slate-900">NT$ {t.total.toLocaleString()}</td>
                        <td className="px-8 py-5 text-center"><div className="flex justify-center gap-4 opacity-0 group-hover/row:opacity-100 transition-all"><button onClick={() => setEditingTransaction(t)} className="p-2 hover:bg-white rounded-lg shadow-sm text-slate-400 hover:text-indigo-600">✏️</button><button onClick={() => setPendingDelete(t)} className="p-2 hover:bg-white rounded-lg shadow-sm text-slate-400 hover:text-rose-600">🗑️</button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {renderPagination()}
            </div>
          </div>
        ) : activeTab === 'records' ? (
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200/60 overflow-hidden">
            {renderFilterHeader()}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 font-black text-slate-400 uppercase tracking-widest text-[11px] border-b">
                  <tr><th className="px-8 py-5">日期 / 類別</th><th className="px-8 py-5">料件明細</th><th className="px-8 py-5 text-right">數量</th><th className="px-8 py-5 text-right">金額</th><th className="px-8 py-5 text-center">操作</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold">
                  {displayedList.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-all group/row">
                      <td className="px-8 py-5 text-xs text-slate-500">{t.date}<div className="text-[10px] text-indigo-600 font-black uppercase mt-1">{t.type}</div></td>
                      <td className="px-8 py-5"><div className="text-slate-900 truncate max-w-xs">{t.materialName}</div><div className="text-[10px] text-slate-400 mt-1">{t.materialNumber || 'PN: --'}</div></td>
                      <td className="px-8 py-5 text-right font-black text-slate-700">{t.quantity}</td>
                      <td className="px-8 py-6 text-right font-black text-indigo-600">NT$ {t.total.toLocaleString()}</td>
                      <td className="px-8 py-5 text-center"><div className="flex justify-center gap-4 opacity-0 group-hover/row:opacity-100 transition-all"><button onClick={() => setEditingTransaction(t)} className="p-2 hover:bg-white rounded-lg shadow-sm text-slate-400 hover:text-indigo-600">✏️</button><button onClick={() => setPendingDelete(t)} className="p-2 hover:bg-white rounded-lg shadow-sm text-slate-400 hover:text-rose-600">🗑️</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </div>
        ) : <BatchAddForm onBatchSave={async txList => { const s = await dbService.batchSave(txList); if(s) await loadData(); return s; }} existingTransactions={transactions} onComplete={() => setActiveTab('records')} currentUser={currentUser!} />}
      </main>

      {/* 彈窗部分 */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[3rem] max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-2xl font-black text-slate-900 mb-8">確認刪除紀錄？</h3>
            <div className="flex flex-col gap-2">
              <button onClick={confirmDelete} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black">確定刪除</button>
              <button onClick={() => setPendingDelete(null)} className="w-full py-3 text-slate-400 font-black">取消</button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[3rem] max-sm w-full text-center shadow-2xl">
            <h3 className="text-2xl font-black text-slate-900 mb-8">確定登出嗎？</h3>
            <div className="flex flex-col gap-2">
              <button onClick={handleLogout} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black">登出</button>
              <button onClick={() => setShowLogoutConfirm(false)} className="w-full py-3 text-slate-400 font-black">取消</button>
            </div>
          </div>
        </div>
      )}

      {editingTransaction && (
        <div className="fixed inset-0 z-[500] bg-slate-950/70 flex items-center justify-center p-6 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md my-auto">
            {editingTransaction.type === TransactionType.REPAIR ? 
              <RepairForm onSave={handleAction} initialData={editingTransaction} onCancel={() => setEditingTransaction(null)} currentUser={currentUser!} /> :
              <TransactionForm onSave={handleAction} initialData={editingTransaction} onCancel={() => setEditingTransaction(null)} currentUser={currentUser!} />
            }
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
