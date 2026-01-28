
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, TransactionType } from './types';
import TransactionForm from './components/TransactionForm';
import RepairForm from './components/RepairForm';
import BatchAddForm from './components/BatchAddForm';
import Dashboard from './components/Dashboard';
import LoginScreen from './components/LoginScreen';
import { dbService } from './services/dbService';
import { exportToExcel } from './services/reportService';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

const getTaipeiDate = (dateInput?: string | Date): string => {
  const d = dateInput ? new Date(dateInput) : new Date();
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
};

const NEW_TARGET_URL = "https://script.google.com/macros/s/AKfycbxVOAngs14SNyrD0r87zzstVm1xAWGV9wbRemzNP1h-comr4yO52iSs1Fx92lbSk6eg/exec";

const App: React.FC = () => {
  // --- 狀態管理 ---
  const [currentUser, setCurrentUser] = useState<string | null>(() => sessionStorage.getItem('wms_current_user'));
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('wms_cache_data');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'records' | 'repairs' | 'batch' | 'settings'>(
    (localStorage.getItem('ui_active_tab') as any) || 'dashboard'
  );
  
  const [recordCategoryFilter, setRecordCategoryFilter] = useState<'all' | TransactionType.INBOUND | TransactionType.USAGE | TransactionType.CONSTRUCTION>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [viewScope, setViewScope] = useState<'monthly' | 'all'>('monthly');
  const [searchMode, setSearchMode] = useState<'keyword' | 'date'>('keyword');
  const [selectedYear, setSelectedYear] = useState<string>(() => String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [specificDate, setSpecificDate] = useState<string>('');
  const [keywordSearch, setKeywordSearch] = useState<string>('');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<Transaction | null>(null);

  useEffect(() => {
    const currentStoredUrl = localStorage.getItem('google_sheet_script_url');
    if (currentStoredUrl !== NEW_TARGET_URL) {
      dbService.forceUpdateUrl(NEW_TARGET_URL);
    }
  }, []);

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return dateDiff !== 0 ? dateDiff : b.id.localeCompare(a.id);
    });
  }, [transactions]);

  const repairStats = useMemo(() => {
    const repairData = transactions.filter(t => t.type === TransactionType.REPAIR);
    const map = new Map<string, number>();
    repairData.forEach(t => {
      map.set(t.materialName, (map.get(t.materialName) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [transactions]);

  const loadData = useCallback(async (silent = false) => {
    if (!currentUser) return;
    if (!silent) setIsLoading(true);
    try {
      const data = await dbService.fetchAll();
      const formatted = (data || []).map(t => ({ 
        ...t, 
        date: getTaipeiDate(t.date) 
      }));
      setTransactions(formatted);
      localStorage.setItem('wms_cache_data', JSON.stringify(formatted));
    } catch (e: any) {
      console.error("Fetch Error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  const handleLogin = (username: string) => {
    sessionStorage.setItem('wms_current_user', username);
    setCurrentUser(username);
    loadData(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('wms_current_user');
    localStorage.removeItem('wms_cache_data');
    localStorage.removeItem('ui_active_tab');
    setCurrentUser(null);
    setTransactions([]);
    setActiveTab('dashboard');
    setShowLogoutConfirm(false);
  };

  useEffect(() => {
    if (currentUser) {
      if (transactions.length === 0) loadData(false);
      localStorage.setItem('ui_active_tab', activeTab);
    }
  }, [activeTab, currentUser]);

  const handleAction = async (tx: Transaction) => {
    const isUpdate = transactions.some(t => t.id === tx.id);
    setTransactions(prev => {
      const newItems = isUpdate ? prev.map(t => t.id === tx.id ? tx : t) : [tx, ...prev];
      localStorage.setItem('wms_cache_data', JSON.stringify(newItems));
      return newItems;
    });
    const ok = isUpdate ? await dbService.update(tx) : await dbService.save(tx);
    return ok;
  };

  const handleDelete = async (target: Transaction) => {
    setTransactions(prev => {
      const newItems = prev.filter(t => t.id !== target.id);
      localStorage.setItem('wms_cache_data', JSON.stringify(newItems));
      return newItems;
    });
    setConfirmDeleteTarget(null);
    await dbService.delete(target.id, target.type);
  };

  const filteredList = useMemo(() => {
    return sortedTransactions.filter(t => {
      if (activeTab === 'repairs' && t.type !== TransactionType.REPAIR) return false;
      if (activeTab === 'records') {
        if (t.type === TransactionType.REPAIR) return false;
        if (recordCategoryFilter !== 'all' && t.type !== recordCategoryFilter) return false;
      }
      if (searchMode === 'date') {
        if (specificDate) return t.date === specificDate;
        const [y, m] = t.date.split('-');
        const yearMatch = !selectedYear || y === selectedYear;
        const monthMatch = selectedMonth === 'all' || m === selectedMonth;
        return yearMatch && monthMatch;
      } else {
        const k = keywordSearch.toLowerCase().trim();
        if (!k) return true;
        return t.materialName.toLowerCase().includes(k) || 
               t.materialNumber.toLowerCase().includes(k) ||
               (t.sn && t.sn.toLowerCase().includes(k)) ||
               (t.operator && t.operator.toLowerCase().includes(k)) ||
               (t.machineNumber && t.machineNumber.toLowerCase().includes(k));
      }
    });
  }, [sortedTransactions, activeTab, recordCategoryFilter, keywordSearch, specificDate, searchMode, selectedYear, selectedMonth]);

  const currentListStats = useMemo(() => ({
    count: filteredList.length,
    total: filteredList.reduce((sum, t) => sum + (t.total || 0), 0)
  }), [filteredList]);

  const displayedList = useMemo(() => {
    const isSearching = keywordSearch || specificDate || (searchMode === 'date' && selectedMonth !== 'all');
    if (viewScope === 'all' || isSearching) return filteredList;
    return filteredList.slice(0, 10);
  }, [filteredList, viewScope, keywordSearch, specificDate, searchMode, selectedMonth]);

  const generateExportFilename = () => {
    let filename = "";
    if (searchMode === 'date') {
      filename += specificDate ? `${specificDate}_` : `${selectedYear}年${selectedMonth === 'all' ? '全年' : selectedMonth + '月'}_`;
    } else if (keywordSearch) {
      filename += `搜尋_${keywordSearch}_`;
    }
    filename += activeTab === 'repairs' ? "維修紀錄報表" : `${recordCategoryFilter === 'all' ? '核銷全類別' : recordCategoryFilter}_報表`;
    return filename;
  };

  const renderFilterHeader = () => (
    <div className="p-8 border-b border-slate-100 bg-slate-50/30 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-6">
        <div className="flex items-center gap-6">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
            <span className={`w-1.5 h-6 rounded-full ${activeTab === 'repairs' ? 'bg-emerald-500' : 'bg-indigo-600'}`}></span>
            {activeTab === 'repairs' ? '維修數據管理' : '核銷明細管理'}
          </h2>
          <div className="flex bg-slate-200 p-1 rounded-xl shadow-inner">
            <button onClick={() => setViewScope('monthly')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${viewScope === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>最近 10 筆</button>
            <button onClick={() => setViewScope('all')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${viewScope === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>顯示全部</button>
          </div>
        </div>

        {activeTab === 'records' && (
          <div className="flex bg-white border border-slate-200 p-1 rounded-2xl shadow-sm">
            <button onClick={() => setRecordCategoryFilter('all')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${recordCategoryFilter === 'all' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>全部</button>
            <button onClick={() => setRecordCategoryFilter(TransactionType.INBOUND)} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${recordCategoryFilter === TransactionType.INBOUND ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-indigo-600'}`}>進貨</button>
            <button onClick={() => setRecordCategoryFilter(TransactionType.USAGE)} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${recordCategoryFilter === TransactionType.USAGE ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400 hover:text-amber-600'}`}>用料</button>
            <button onClick={() => setRecordCategoryFilter(TransactionType.CONSTRUCTION)} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${recordCategoryFilter === TransactionType.CONSTRUCTION ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-purple-600'}`}>建置</button>
          </div>
        )}

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setSearchMode('keyword')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${searchMode === 'keyword' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500'}`}>🔍 關鍵字搜尋</button>
          <button onClick={() => setSearchMode('date')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${searchMode === 'date' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500'}`}>📅 按日期篩選</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          {searchMode === 'keyword' ? (
            <div className="relative flex-1 min-w-[300px]">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              <input type="text" placeholder="搜尋料件、SN、機台、人員..." value={keywordSearch} onChange={e => setKeywordSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm" />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-1 shadow-sm">
                <span className="text-[9px] font-black text-slate-400 uppercase">年份</span>
                <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="bg-transparent py-2 text-sm font-black outline-none min-w-[80px]">
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-1 shadow-sm">
                <span className="text-[9px] font-black text-slate-400 uppercase">月份</span>
                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent py-2 text-sm font-black outline-none min-w-[80px]">
                  <option value="all">全部月份</option>
                  {Array.from({length: 12}).map((_, i) => (
                    <option key={i+1} value={String(i+1).padStart(2, '0')}>{i+1} 月</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-1 shadow-sm">
                <span className="text-[9px] font-black text-slate-400 uppercase">特定日</span>
                <input type="date" value={specificDate} onChange={e => setSpecificDate(e.target.value)} className="bg-transparent py-2 text-sm font-black outline-none" />
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right px-4 py-2 bg-slate-100 rounded-2xl border border-slate-200">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">目前篩選總額</p>
            <p className="text-sm font-black text-indigo-600">NT$ {currentListStats.total.toLocaleString()}</p>
          </div>
          <button 
            onClick={() => exportToExcel(filteredList, generateExportFilename())} 
            className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-black shadow-lg hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-2"
          >
             <span>📥 匯出 Excel</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f8fafc] text-black font-medium overflow-x-hidden">
      {/* 彈窗部分 */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl">
          <div className="bg-white rounded-[3rem] p-12 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-4xl mx-auto mb-8 animate-bounce">🚪</div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">確定要登出嗎？</h3>
            <p className="text-xs font-bold text-slate-400 mb-8">登出後將清空本地快取以確保安全</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleLogout} className="w-full py-5 bg-rose-600 text-white rounded-2xl font-black shadow-xl hover:bg-rose-700 transition-all">確認登出</button>
              <button onClick={() => setShowLogoutConfirm(false)} className="w-full py-4 text-slate-400 font-black hover:text-slate-600">取消</button>
            </div>
          </div>
        </div>
      )}

      {editingTransaction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg">
            {editingTransaction.type === TransactionType.REPAIR ? (
              <RepairForm onSave={handleAction} initialData={editingTransaction} onCancel={() => setEditingTransaction(null)} existingTransactions={transactions} currentUser={currentUser} />
            ) : (
              <TransactionForm onSave={handleAction} initialData={editingTransaction} onCancel={() => setEditingTransaction(null)} existingTransactions={transactions} currentUser={currentUser} />
            )}
          </div>
        </div>
      )}

      {confirmDeleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm text-center shadow-2xl">
            <h3 className="text-xl font-black mb-4">確認刪除？</h3>
            <div className="flex gap-4">
              <button onClick={() => setConfirmDeleteTarget(null)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold">取消</button>
              <button onClick={() => handleDelete(confirmDeleteTarget!)} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold">刪除</button>
            </div>
          </div>
        </div>
      )}

      {/* 側邊欄 */}
      <aside className="w-full lg:w-80 bg-slate-900 text-white p-8 flex flex-col shrink-0 lg:fixed lg:h-full z-40 shadow-2xl overflow-y-auto">
        <div className="flex items-center gap-4 mb-14">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-2xl shadow-lg -rotate-6">倉</div>
          <div>
            <h1 className="text-xl font-black leading-none mb-1">倉管智慧月結</h1>
            <p className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase opacity-70">WMS PRO v6.9</p>
          </div>
        </div>

        <nav className="space-y-2 flex-1 font-black">
          {[
            { id: 'dashboard', label: '📊 營運總覽', desc: '核心成本數據' },
            { id: 'records', label: '📄 核銷日誌', desc: '進貨/用料/建置' },
            { id: 'repairs', label: '🛠️ 維修紀錄', desc: '專用設備維護' },
            { id: 'batch', label: '📥 批次新增', desc: '大量資料同步' }
          ].map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id as any); setKeywordSearch(''); setSpecificDate(''); setRecordCategoryFilter('all'); }} className={`w-full text-left px-6 py-5 rounded-2xl transition-all ${activeTab === item.id ? 'bg-indigo-600 shadow-xl scale-[1.02]' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <p className="text-sm">{item.label}</p>
              <p className={`text-[10px] mt-1 ${activeTab === item.id ? 'text-indigo-200' : 'text-slate-500'}`}>{item.desc}</p>
            </button>
          ))}
        </nav>

        <div className="mt-10 pt-6 border-t border-white/5">
          <div className="bg-gradient-to-br from-white/5 to-transparent rounded-[1.75rem] border border-white/10 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xl">👤</div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">當前操作員</p>
              <p className="text-sm font-black truncate text-white">{currentUser}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 lg:ml-80 min-h-screen flex flex-col bg-[#f8fafc]">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 lg:px-12 py-5 flex items-center justify-between shadow-sm">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            {activeTab === 'dashboard' ? '📊 營運數據分析' : activeTab === 'records' ? '📄 核銷日誌明細' : activeTab === 'repairs' ? '🛠️ 設備維護紀錄' : '📥 批次快速新增'}
          </h2>
          <div className="flex items-center gap-4">
             {isLoading ? (
               <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
             ) : (
               <button 
                onClick={() => loadData(false)} 
                title="重新整理雲端資料" 
                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
               >
                 🔄
               </button>
             )}
             <button onClick={() => setShowLogoutConfirm(true)} className="px-5 py-3 bg-rose-50 text-rose-600 rounded-xl font-black text-xs uppercase tracking-widest border border-rose-100 hover:bg-rose-600 hover:text-white transition-all">🚪 登出系統</button>
          </div>
        </header>

        <div className="p-6 lg:p-12">
          {activeTab === 'dashboard' ? (
            <div className="max-w-[1400px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-10">
              <div className="xl:col-span-8"><Dashboard transactions={transactions} /></div>
              <div className="xl:col-span-4"><TransactionForm onSave={handleAction} existingTransactions={transactions} currentUser={currentUser!} /></div>
            </div>
          ) : activeTab === 'repairs' ? (
            <div className="max-w-[1400px] mx-auto space-y-12">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 items-start">
                 <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl h-full min-h-[420px] flex flex-col">
                    <div className="mb-8">
                      <h3 className="text-lg font-black text-white flex items-center gap-3">
                        <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
                        維修件損耗頻率排行 (Top 5)
                      </h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Fault Frequency Analytics</p>
                    </div>
                    <div className="flex-1">
                      {repairStats.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={repairStats} layout="vertical" margin={{ left: 20, right: 30 }}>
                            <XAxis type="number" hide />
                            <YAxis 
                              dataKey="name" 
                              type="category" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 11, fontWeight: 900, fill: '#cbd5e1' }}
                              width={100}
                            />
                            <Tooltip 
                              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', color: '#fff' }}
                            />
                            <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={24}>
                              {repairStats.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === 1 ? '#059669' : '#047857'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-20">
                          <span className="text-4xl mb-2">🛠️</span>
                          <p className="text-xs font-black text-white uppercase tracking-widest">尚無維修數據</p>
                        </div>
                      )}
                    </div>
                 </div>

                 <div className="xl:sticky xl:top-24">
                   <RepairForm onSave={handleAction} existingTransactions={transactions} currentUser={currentUser!} />
                 </div>
              </div>
              
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 overflow-hidden">
                {renderFilterHeader()}
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <tr>
                        <th className="px-8 py-5">設備資訊 (SN/機台)</th>
                        <th className="px-8 py-5">維修項目</th>
                        <th className="px-8 py-5">進度節點</th>
                        <th className="px-8 py-5 text-center">管理</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {displayedList.map(t => (
                        <tr key={t.id} className="group hover:bg-slate-50/50">
                          <td className="px-8 py-6">
                            <p className="text-sm font-black text-emerald-600">{t.sn || '無 SN'}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">機台: {t.machineNumber || '--'}</p>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-sm font-black text-slate-900">{t.materialName}</p>
                            <p className="text-[10px] text-rose-500 font-black mt-1">原因: {t.faultReason || '未標註'}</p>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex gap-4 text-[10px] font-black">
                              <div><span className="text-slate-400">送:</span> {t.sentDate || '--'}</div>
                              <div><span className="text-slate-400">完:</span> {t.repairDate || '--'}</div>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-center">
                            <div className="flex gap-2 justify-center opacity-0 group-hover:opacity-100">
                              <button onClick={() => setEditingTransaction(t)} className="p-2 border border-slate-200 rounded-lg">✏️</button>
                              <button onClick={() => setConfirmDeleteTarget(t)} className="p-2 border border-slate-200 rounded-lg">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                   </table>
                </div>
              </div>
            </div>
          ) : activeTab === 'records' ? (
            <div className="max-w-[1400px] mx-auto space-y-8">
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 overflow-hidden">
                {renderFilterHeader()}
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <tr>
                        <th className="px-8 py-5">日期/類別</th>
                        <th className="px-8 py-5">設備/料件</th>
                        <th className="px-8 py-5 text-right">數量</th>
                        <th className="px-8 py-5 text-right">總額</th>
                        <th className="px-8 py-5 text-center">管理</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {displayedList.map(t => (
                        <tr key={t.id} className="group hover:bg-slate-50/50">
                          <td className="px-8 py-6">
                            <p className="text-sm font-black text-slate-900">{t.date}</p>
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black border ${t.type === TransactionType.INBOUND ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : t.type === TransactionType.USAGE ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                              {t.type}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-sm font-black text-slate-900">{t.materialName}</p>
                            <p className="text-[10px] text-slate-400">機台 ID: {t.machineNumber} / {t.machineCategory}</p>
                          </td>
                          <td className="px-8 py-6 text-right font-black text-slate-900">{t.quantity}</td>
                          <td className="px-8 py-6 text-right font-black text-indigo-600">NT$ {t.total.toLocaleString()}</td>
                          <td className="px-8 py-6 text-center">
                            <div className="flex gap-2 justify-center opacity-0 group-hover:opacity-100">
                              <button onClick={() => setEditingTransaction(t)} className="p-2 border border-slate-200 rounded-lg">✏️</button>
                              <button onClick={() => setConfirmDeleteTarget(t)} className="p-2 border border-slate-200 rounded-lg">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === 'batch' ? (
            <div className="max-w-[1400px] mx-auto">
              <BatchAddForm onSave={handleAction} existingTransactions={transactions} onComplete={() => setActiveTab('records')} currentUser={currentUser!} />
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default App;
