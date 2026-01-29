
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Transaction, TransactionType } from './types';
import TransactionForm from './components/TransactionForm';
import RepairForm from './components/RepairForm';
import BatchAddForm from './components/BatchAddForm';
import Dashboard from './components/Dashboard';
import LoginScreen from './components/LoginScreen';
import { dbService } from './services/dbService';
import { exportToExcel } from './services/reportService';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell } from 'recharts';

const getTaipeiDate = (dateInput?: string | Date): string => {
  const d = dateInput ? new Date(dateInput) : new Date();
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
};

const NEW_TARGET_URL = "https://script.google.com/macros/s/AKfycbxuogDxnNZUkS8A4d7nU0enJjYxWd9r1ll9NNGquwEsytgxNIZhb1HkG4AFmNEbIQs5/exec";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; 
const WARNING_THRESHOLD_MS = 4 * 60 * 1000;
const ITEMS_PER_PAGE = 15;
const AUTO_REFRESH_INTERVAL = 30000; // 30秒自動輪詢

const DetailTooltip: React.FC<{ tx: Transaction; x: number; y: number }> = ({ tx, x, y }) => {
  const isRepair = tx.type === TransactionType.REPAIR;
  const isScrapped = tx.isScrapped;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const tooltipWidth = 320;
  const tooltipHeight = 350;
  let leftPos = x + 20;
  let topPos = y + 20;
  if (leftPos + tooltipWidth > windowWidth) leftPos = x - tooltipWidth - 20;
  if (topPos + tooltipHeight > windowHeight) topPos = y - tooltipHeight - 20;

  return (
    <div className="fixed z-[500] pointer-events-none transition-opacity duration-200 animate-in fade-in zoom-in-95" style={{ left: leftPos, top: topPos }}>
      <div className={`w-80 glass-card rounded-[2rem] shadow-[0_30px_70px_rgba(0,0,0,0.15)] border p-6 overflow-hidden ${isScrapped ? 'border-rose-200 bg-rose-50/95' : 'border-white/40 bg-white/95'}`}>
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200/50">
          <div>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${isScrapped ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'}`}>{tx.type}</span>
            <h4 className="text-sm font-black text-slate-900 mt-2 truncate max-w-[180px]">{tx.materialName}</h4>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400">ID: {tx.id.slice(-6)}</p>
            <p className="text-[10px] font-black text-slate-400 mt-0.5">{tx.date}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-5">
          <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">料號 PN</p><p className="text-[11px] font-bold text-slate-700">{tx.materialNumber || '--'}</p></div>
          <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">機台 / 類別</p><p className="text-[11px] font-bold text-slate-700">{tx.machineNumber || '--'} ({tx.machineCategory})</p></div>
          
          {isRepair ? (
            <>
              <div className="col-span-2 bg-rose-500/5 p-2.5 rounded-xl border border-rose-500/10"><p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">故障原因</p><p className="text-[11px] font-bold text-slate-700 leading-tight">{tx.faultReason || '未標註'}</p></div>
              <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">維修費用</p><p className="text-[11px] font-black text-emerald-600">NT$ {(tx.total || 0).toLocaleString()}</p></div>
              <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">完修日期</p><p className={`text-[11px] font-bold ${tx.repairDate ? 'text-emerald-600' : 'text-amber-500'}`}>{tx.isScrapped ? '已報廢' : (tx.repairDate || '維修中...')}</p></div>
              <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">序號 SN</p><p className="text-[11px] font-bold text-slate-700">{tx.sn || '--'}</p></div>
            </>
          ) : (
            <>
              <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">數量 / 單價</p><p className="text-[11px] font-bold text-slate-700">{tx.quantity} / NT$ {tx.unitPrice.toLocaleString()}</p></div>
              <div className="col-span-2"><p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1">結算總額</p><p className="text-[11px] font-black text-indigo-600">NT$ {tx.total.toLocaleString()}</p></div>
            </>
          )}
        </div>
        <div className="bg-slate-50 p-3 rounded-xl"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><span>📝</span> 備註說明</p><p className="text-[11px] font-bold text-slate-600 italic leading-relaxed">{tx.note || '無備註'}</p></div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<string | null>(() => sessionStorage.getItem('wms_current_user'));
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(60);
  
  const showIdleWarningRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [hoveredTx, setHoveredTx] = useState<{ data: Transaction; x: number; y: number } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('wms_cache_data');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'records' | 'repairs' | 'batch' | 'settings'>(
    (localStorage.getItem('ui_active_tab') as any) || 'dashboard'
  );
  
  const [recordCategoryFilter, setRecordCategoryFilter] = useState<'all' | TransactionType.INBOUND | TransactionType.USAGE | TransactionType.CONSTRUCTION>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'scrapped' | 'repairing' | 'pending_inbound'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('尚未同步');
  const [viewScope, setViewScope] = useState<'monthly' | 'all'>(() => (localStorage.getItem('ui_view_scope') as any) || 'monthly');
  const [searchMode, setSearchMode] = useState<'keyword' | 'date'>('keyword');
  const [selectedYear, setSelectedYear] = useState<string>(() => String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [specificDate, setSpecificDate] = useState<string>('');
  const [keywordSearch, setKeywordSearch] = useState<string>('');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<Transaction | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = useCallback(async (silent = false) => {
    if (!currentUser) return;
    if (!silent) setIsLoading(true);
    try {
      const data = await dbService.fetchAll();
      const formatted = (data || []).map(t => ({ ...t, date: getTaipeiDate(t.date) }));
      setTransactions(formatted);
      localStorage.setItem('wms_cache_data', JSON.stringify(formatted));
      setLastSyncTime(new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e: any) {
      console.error("Fetch Error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('wms_current_user');
    localStorage.removeItem('wms_cache_data');
    localStorage.removeItem('ui_active_tab');
    localStorage.removeItem('ui_view_scope');
    localStorage.removeItem('wms_last_activity');
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    setCurrentUser(null);
    setTransactions([]);
    setActiveTab('dashboard');
    setShowLogoutConfirm(false);
    setShowIdleWarning(false);
    showIdleWarningRef.current = false;
    setHoveredTx(null);
  }, []);

  const updateActivity = useCallback(() => {
    if (!currentUser || showIdleWarningRef.current) return;
    const now = Date.now();
    lastActivityRef.current = now;
    localStorage.setItem('wms_last_activity', now.toString());
  }, [currentUser]);

  // 背景輪詢與焦點同步
  useEffect(() => {
    if (!currentUser) return;

    // 定義自動重新整理
    autoRefreshRef.current = setInterval(() => {
      // 只有在非閒置且非警示狀態下才背景同步
      if (!showIdleWarningRef.current) {
        loadData(true);
      }
    }, AUTO_REFRESH_INTERVAL);

    // 當視窗獲得焦點時同步
    const handleFocus = () => {
      loadData(true);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser, loadData]);

  useEffect(() => {
    if (!currentUser) return;
    const initialNow = Date.now();
    lastActivityRef.current = initialNow;
    localStorage.setItem('wms_last_activity', initialNow.toString());
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, updateActivity, { passive: true }));
    checkIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const lastActivity = lastActivityRef.current;
      const diff = now - lastActivity;
      if (diff >= IDLE_TIMEOUT_MS) {
        handleLogout();
      } else if (diff >= WARNING_THRESHOLD_MS) {
        if (!showIdleWarningRef.current) {
          setShowIdleWarning(true);
          showIdleWarningRef.current = true;
        }
        const remaining = Math.max(0, Math.ceil((IDLE_TIMEOUT_MS - diff) / 1000));
        setWarningCountdown(remaining);
      } else if (showIdleWarningRef.current) {
        setShowIdleWarning(false);
        showIdleWarningRef.current = false;
      }
    }, 1000);
    return () => {
      events.forEach(evt => window.removeEventListener(evt, updateActivity));
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [currentUser, updateActivity, handleLogout]);

  useEffect(() => {
    dbService.forceUpdateUrl(NEW_TARGET_URL);
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

  const handleLogin = (username: string) => {
    sessionStorage.setItem('wms_current_user', username);
    lastActivityRef.current = Date.now();
    localStorage.setItem('wms_last_activity', lastActivityRef.current.toString());
    setCurrentUser(username);
    loadData(false);
  };

  useEffect(() => {
    if (currentUser) {
      if (transactions.length === 0) loadData(false);
      localStorage.setItem('ui_active_tab', activeTab);
      localStorage.setItem('ui_view_scope', viewScope);
    }
  }, [activeTab, currentUser, viewScope, loadData, transactions.length]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, recordCategoryFilter, statusFilter, keywordSearch, specificDate, searchMode, selectedYear, selectedMonth]);

  const handleAction = async (tx: Transaction) => {
    const isUpdate = transactions.some(t => t.id === tx.id);
    // 樂觀更新
    setTransactions(prev => {
      const newItems = isUpdate ? prev.map(t => t.id === tx.id ? tx : t) : [tx, ...prev];
      localStorage.setItem('wms_cache_data', JSON.stringify(newItems));
      return newItems;
    });
    const ok = isUpdate ? await dbService.update(tx) : await dbService.save(tx);
    if (ok) {
      // 操作成功後立即從雲端同步一次完整資料
      loadData(true);
    }
    return ok;
  };

  const handleDelete = async (target: Transaction) => {
    setTransactions(prev => {
      const newItems = prev.filter(t => t.id !== target.id);
      localStorage.setItem('wms_cache_data', JSON.stringify(newItems));
      return newItems;
    });
    setConfirmDeleteTarget(null);
    const ok = await dbService.delete(target.id, target.type);
    if (ok) loadData(true);
  };

  const filteredList = useMemo(() => {
    return sortedTransactions.filter(t => {
      const isStatusFiltering = statusFilter !== 'all';

      if (isStatusFiltering) {
        if (statusFilter === 'scrapped') return t.isScrapped === true;
        if (statusFilter === 'repairing') return t.type === TransactionType.REPAIR && !t.repairDate && !t.isScrapped;
        if (statusFilter === 'pending_inbound') return t.type === TransactionType.INBOUND && t.isReceived === false;
        return true;
      }

      if (activeTab === 'records') {
        if (t.type === TransactionType.REPAIR) return false;
        if (t.isScrapped === true) return false;
        if (recordCategoryFilter !== 'all' && t.type !== recordCategoryFilter) return false;
      }

      if (activeTab === 'repairs') {
        if (t.type !== TransactionType.REPAIR) return false;
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
  }, [sortedTransactions, activeTab, recordCategoryFilter, statusFilter, keywordSearch, specificDate, searchMode, selectedYear, selectedMonth]);

  const quickStats = useMemo(() => {
    return sortedTransactions.reduce((acc, t) => {
      if (t.isScrapped === true) acc.scrapped++;
      if (t.type === TransactionType.REPAIR && !t.repairDate && !t.isScrapped) acc.repairing++;
      if (t.type === TransactionType.INBOUND && t.isReceived === false) acc.pending++;
      return acc;
    }, { scrapped: 0, repairing: 0, pending: 0 });
  }, [sortedTransactions]);

  const totalPages = useMemo(() => Math.ceil(filteredList.length / ITEMS_PER_PAGE), [filteredList]);

  const displayedList = useMemo(() => {
    if (viewScope === 'monthly') return filteredList.slice(0, 10);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredList.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredList, viewScope, currentPage]);

  const currentListStats = useMemo(() => ({
    count: filteredList.length,
    total: filteredList.reduce((sum, t) => sum + (t.total || 0), 0)
  }), [filteredList]);

  const generateExportFilename = () => {
    let filename = "";
    if (searchMode === 'date') {
      filename += specificDate ? `${specificDate}_` : `${selectedYear}年${selectedMonth === 'all' ? '全年' : selectedMonth + '月'}_`;
    } else if (keywordSearch) {
      filename += `搜尋_${keywordSearch.trim()}_`;
    }
    if (statusFilter === 'scrapped') filename += "[報廢清單]_";
    else if (statusFilter === 'repairing') filename += "[維修中追蹤]_";
    else if (statusFilter === 'pending_inbound') filename += "[待收貨追蹤]_";
    filename += activeTab === 'repairs' ? "維修數據報表" : `${recordCategoryFilter === 'all' ? '核銷全類別' : recordCategoryFilter}_報表`;
    return filename;
  };

  const handleRowMouseEnter = (e: React.MouseEvent, tx: Transaction) => {
    const { clientX, clientY } = e;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredTx({ data: tx, x: clientX, y: clientY });
    }, 150);
  };

  const handleRowMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredTx(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (hoveredTx) {
      setHoveredTx(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    }
  };

  const renderPagination = () => {
    if (viewScope === 'monthly' || totalPages <= 1) return null;
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredList.length);
    return (
      <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
          顯示第 <span className="text-slate-900">{startIndex} - {endIndex}</span> 筆，共 <span className="text-indigo-600">{filteredList.length}</span> 筆
        </div>
        <div className="flex items-center gap-1.5">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 disabled:opacity-30 font-black text-xs">«</button>
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="px-4 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-sm font-black text-slate-600 hover:text-indigo-600 disabled:opacity-30">上一頁</button>
          <div className="flex items-center gap-1 mx-2">
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              let pageNum = currentPage <= 3 ? i + 1 : (currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i);
              if (pageNum <= 0 || pageNum > totalPages) return null;
              return (<button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-10 h-10 rounded-xl text-sm font-black transition-all ${currentPage === pageNum ? 'bg-indigo-600 text-white shadow-lg scale-110' : 'bg-white text-slate-400'}`}>{pageNum}</button>);
            })}
          </div>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} className="px-4 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-sm font-black text-slate-600 hover:text-indigo-600 disabled:opacity-30">下一頁</button>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 disabled:opacity-30 font-black text-xs">»</button>
        </div>
      </div>
    );
  };

  const renderFilterHeader = () => (
    <div className="p-8 border-b border-slate-100 bg-slate-50/30 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-6">
        <div className="flex items-center gap-6">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
            <span className={`w-1.5 h-6 rounded-full ${activeTab === 'repairs' ? 'bg-emerald-500' : 'bg-indigo-600'}`}></span>
            {statusFilter !== 'all' ? `🔍 全局篩選: ${statusFilter === 'scrapped' ? '報廢項目' : statusFilter === 'repairing' ? '維修中' : '待進貨'}` : (activeTab === 'repairs' ? '維修數據管理' : '核銷日誌明細')}
          </h2>
          <div className="flex bg-slate-200 p-1 rounded-xl shadow-inner">
            <button onClick={() => setViewScope('monthly')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${viewScope === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>最近 10 筆</button>
            <button onClick={() => setViewScope('all')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${viewScope === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>全部紀錄</button>
          </div>
        </div>
        {activeTab === 'records' && statusFilter === 'all' && (
          <div className="flex bg-white border border-slate-200 p-1 rounded-2xl shadow-sm">
            <button onClick={() => setRecordCategoryFilter('all')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${recordCategoryFilter === 'all' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>全部</button>
            <button onClick={() => setRecordCategoryFilter(TransactionType.INBOUND)} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${recordCategoryFilter === TransactionType.INBOUND ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-indigo-600'}`}>進貨</button>
            <button onClick={() => setRecordCategoryFilter(TransactionType.USAGE)} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${recordCategoryFilter === TransactionType.USAGE ? 'bg-amber-50 text-amber-600 shadow-lg' : 'text-slate-400 hover:text-amber-600'}`}>用料</button>
            <button onClick={() => setRecordCategoryFilter(TransactionType.CONSTRUCTION)} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${recordCategoryFilter === TransactionType.CONSTRUCTION ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-purple-600'}`}>建置</button>
          </div>
        )}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setSearchMode('keyword')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${searchMode === 'keyword' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500'}`}>🔍 關鍵字搜尋</button>
          <button onClick={() => setSearchMode('date')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${searchMode === 'date' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500'}`}>📅 日期篩選</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">快速狀態篩選:</span>
        <button onClick={() => setStatusFilter('all')} className={`px-4 py-2 rounded-full text-xs font-black border transition-all ${statusFilter === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>全部</button>
        
        {activeTab !== 'records' && (
          <>
            <button onClick={() => setStatusFilter('scrapped')} className={`px-4 py-2 rounded-full text-xs font-black border transition-all flex items-center gap-2 ${statusFilter === 'scrapped' ? 'bg-rose-600 text-white border-rose-600 shadow-md' : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100'}`}>
              <span>💀 已報廢</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${statusFilter === 'scrapped' ? 'bg-white/20' : 'bg-rose-600 text-white'}`}>{quickStats.scrapped}</span>
            </button>
            <button onClick={() => setStatusFilter('repairing')} className={`px-4 py-2 rounded-full text-xs font-black border transition-all flex items-center gap-2 ${statusFilter === 'repairing' ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100'}`}>
              <span>🛠️ 維修中</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${statusFilter === 'repairing' ? 'bg-white/20' : 'bg-amber-600 text-white'}`}>{quickStats.repairing}</span>
            </button>
          </>
        )}

        {activeTab !== 'repairs' && (
          <button onClick={() => setStatusFilter('pending_inbound')} className={`px-4 py-2 rounded-full text-xs font-black border transition-all flex items-center gap-2 ${statusFilter === 'pending_inbound' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'}`}>
            <span>⏳ 尚未收貨</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${statusFilter === 'pending_inbound' ? 'bg-white/20' : 'bg-indigo-600 text-white'}`}>{quickStats.pending}</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          {searchMode === 'keyword' ? (
            <div className="relative flex-1 min-w-[300px]">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              <input type="text" placeholder="搜尋料件、SN、機台..." value={keywordSearch} onChange={e => setKeywordSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm" />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-1 shadow-sm"><span className="text-[11px] font-black text-slate-400 uppercase">年份</span><select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="bg-transparent py-2 text-sm font-black outline-none min-w-[80px]">{[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}</select></div>
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-1 shadow-sm"><span className="text-[11px] font-black text-slate-400 uppercase">月份</span><select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent py-2 text-sm font-black outline-none min-w-[80px]"><option value="all">全部</option>{Array.from({length: 12}).map((_, i) => (<option key={i+1} value={String(i+1).padStart(2, '0')}>{i+1} 月</option>))}</select></div>
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-1 shadow-sm"><span className="text-[11px] font-black text-slate-400 uppercase">特定日</span><input type="date" value={specificDate} onChange={e => setSpecificDate(e.target.value)} className="bg-transparent py-2 text-sm font-black outline-none" /></div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right px-4 py-2 bg-slate-100 rounded-2xl border border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">目前篩選總額</p>
            <p className="text-sm font-black text-indigo-600">NT$ {currentListStats.total.toLocaleString()}</p>
          </div>
          <button 
            onClick={() => exportToExcel(filteredList, generateExportFilename())} 
            className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-black shadow-lg hover:bg-emerald-700 transition-all active:scale-95 flex flex-col items-center leading-tight min-w-[140px]"
          >
            <span>📥 匯出 Excel</span>
            <span className="text-[10px] opacity-70 font-bold">(共 {filteredList.length} 筆資料)</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f8fafc] text-black font-medium overflow-x-hidden" onMouseMove={handleMouseMove}>
      {hoveredTx && <DetailTooltip tx={hoveredTx.data} x={hoveredTx.x} y={hoveredTx.y} />}

      {showIdleWarning && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl">
          <div className="bg-white rounded-[3rem] p-12 max-w-md w-full text-center shadow-[0_32px_128px_rgba(0,0,0,0.8)] border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center text-5xl mx-auto mb-8 relative">⏳<div className="absolute inset-0 border-4 border-amber-500/20 rounded-full animate-ping"></div></div>
            <h3 className="text-2xl font-black text-slate-900 mb-4">閒置登出提醒</h3>
            <p className="text-sm font-bold text-slate-500 mb-8 leading-relaxed">系統偵測到您已長時間未操作。<br />為了您的數據安全，將於 <span className="text-rose-600 font-black text-xl tabular-nums mx-1">{warningCountdown}</span> 秒後自動登出。</p>
            <div className="w-full h-2 bg-slate-100 rounded-full mb-10 overflow-hidden"><div className="h-full bg-indigo-600 transition-all duration-1000 ease-linear" style={{ width: `${(warningCountdown / 60) * 100}%` }}></div></div>
            <div className="flex flex-col gap-3">
              <button onClick={() => { 
                lastActivityRef.current = Date.now();
                localStorage.setItem('wms_last_activity', lastActivityRef.current.toString());
                setShowIdleWarning(false); 
                showIdleWarningRef.current = false;
              }} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all">繼續操作</button>
              <button onClick={handleLogout} className="w-full py-4 text-slate-400 font-black hover:text-rose-600 transition-colors">立即登出</button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl">
          <div className="bg-white rounded-[3rem] p-12 max-sm w-full text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-4xl mx-auto mb-8 animate-bounce">門</div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">確定要登出嗎？</h3>
            <p className="text-xs font-bold text-slate-400 mb-8">登出後將清空本地快取以確保安全</p>
            <div className="flex flex-col gap-3"><button onClick={handleLogout} className="w-full py-5 bg-rose-600 text-white rounded-2xl font-black shadow-xl hover:bg-rose-700 transition-all">確認登出</button><button onClick={() => setShowLogoutConfirm(false)} className="w-full py-4 text-slate-400 font-black hover:text-slate-600">取消</button></div>
          </div>
        </div>
      )}

      {editingTransaction && (
        <div className="fixed inset-0 z-[100] flex justify-center p-4 md:p-8 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md my-auto">
            {editingTransaction.type === TransactionType.REPAIR ? (
              <RepairForm onSave={handleAction} initialData={editingTransaction} onCancel={() => setEditingTransaction(null)} existingTransactions={transactions} currentUser={currentUser!} />
            ) : (
              <TransactionForm onSave={handleAction} initialData={editingTransaction} onCancel={() => setEditingTransaction(null)} existingTransactions={transactions} currentUser={currentUser!} />
            )}
          </div>
        </div>
      )}

      {confirmDeleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm text-center shadow-2xl"><h3 className="text-xl font-black mb-4">確認刪除？</h3><div className="flex gap-4"><button onClick={() => setConfirmDeleteTarget(null)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold">取消</button><button onClick={() => handleDelete(confirmDeleteTarget!)} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold">刪除</button></div></div>
        </div>
      )}

      <aside className="w-full lg:w-80 bg-slate-900 text-white p-8 flex flex-col shrink-0 lg:fixed lg:h-full z-40 shadow-2xl overflow-y-auto">
        <div className="flex items-center gap-4 mb-14"><div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-2xl shadow-lg -rotate-6">倉</div><div><h1 className="text-xl font-black leading-none mb-1">倉管智慧月結</h1><p className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase opacity-70">WMS PRO v6.9</p></div></div>
        <nav className="space-y-2 flex-1 font-black">{[{ id: 'dashboard', label: '📊 成本分析看板', desc: '核心成本數據' }, { id: 'records', label: '📄 核銷日誌', desc: '進貨/用料/建置' }, { id: 'repairs', label: '🛠️ 維修紀錄', desc: '專用設備維護' }, { id: 'batch', label: '📥 批次新增', desc: '大量資料同步' }].map(item => (<button key={item.id} onClick={() => { setActiveTab(item.id as any); setKeywordSearch(''); setSpecificDate(''); setRecordCategoryFilter('all'); setStatusFilter('all'); }} className={`w-full text-left px-6 py-5 rounded-2xl transition-all ${activeTab === item.id ? 'bg-indigo-600 shadow-xl scale-[1.02]' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><p className="text-sm">{item.label}</p><p className={`text-[10px] mt-1 ${activeTab === item.id ? 'text-indigo-200' : 'text-slate-500'}`}>{item.desc}</p></button>))}</nav>
        <div className="mt-10 pt-6 border-t border-white/5"><div className="bg-gradient-to-br from-white/5 to-transparent rounded-[1.75rem] border border-white/10 p-5 flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xl">👤</div><div className="flex-1 overflow-hidden"><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">操作員</p><p className="text-sm font-black truncate text-white">{currentUser}</p></div></div></div>
      </aside>

      <main className="flex-1 lg:ml-80 min-h-screen flex flex-col bg-[#f8fafc]">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 lg:px-12 py-5 flex items-center justify-between shadow-sm">
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">{activeTab === 'dashboard' ? '📊 成本分析看板' : activeTab === 'records' ? '📄 核銷日誌明細' : activeTab === 'repairs' ? '🛠️ 設備維護紀錄' : '📥 批次快速新增'}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {isLoading ? '雲端同步中...' : `最後同步: ${lastSyncTime}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isLoading ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-lg">
                <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[10px] font-black text-amber-600 uppercase">Syncing</span>
              </div>
            ) : (
              <button onClick={() => loadData(false)} title="立即重新整理" className="p-2 text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1.5 bg-slate-50 rounded-lg border border-slate-200 hover:border-indigo-200">
                <span className="text-xs font-black">🔄 Refresh</span>
              </button>
            )}
            <button onClick={() => setShowLogoutConfirm(true)} className="px-5 py-3 bg-rose-50 text-rose-600 rounded-xl font-black text-xs uppercase tracking-widest border border-rose-100 hover:bg-rose-600 hover:text-white transition-all">🚪 登出</button>
          </div>
        </header>

        <div className="p-6 lg:p-12">
          {activeTab === 'dashboard' ? (
            <div className="max-w-[1400px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-10 items-start">
              <div className="xl:col-span-8"><Dashboard transactions={transactions} /></div>
              <div className="xl:col-span-4 max-w-md mx-auto xl:mx-0 w-full xl:sticky xl:top-24"><TransactionForm onSave={handleAction} existingTransactions={transactions} currentUser={currentUser!} /></div>
            </div>
          ) : activeTab === 'repairs' ? (
            <div className="max-w-[1400px] mx-auto space-y-12">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 items-start">
                 <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl h-full min-h-[420px] flex flex-col">
                    <div className="mb-8"><h3 className="text-lg font-black text-white flex items-center gap-3"><span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>維修損耗頻率排行</h3><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Fault Frequency Analytics</p></div>
                    <div className="flex-1">{repairStats.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><BarChart data={repairStats} layout="vertical" margin={{ left: 20, right: 30 }}><XAxis type="number" hide /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900, fill: '#cbd5e1' }} width={100}/><RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', fontSize: '12px', color: '#fff' }}/><Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={24}>{repairStats.map((entry, index) => (<Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === 1 ? '#059669' : '#047857'} />))}</Bar></BarChart></ResponsiveContainer>) : <div className="h-full flex flex-col items-center justify-center opacity-20"><span className="text-4xl mb-2">🛠️</span><p className="text-xs font-black text-white uppercase tracking-widest">尚無維修數據</p></div>}</div>
                 </div>
                 <div className="xl:sticky xl:top-24 max-w-md mx-auto xl:mx-0 w-full"><RepairForm onSave={handleAction} existingTransactions={transactions} currentUser={currentUser!} /></div>
              </div>
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 overflow-hidden">
                <div>{renderFilterHeader()}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <tr><th className="px-8 py-5">設備資訊 (SN/機台)</th><th className="px-8 py-5">維修項目</th><th className="px-8 py-5 text-right">數量 / 費用</th><th className="px-8 py-5 text-center">狀態 / 管理</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {displayedList.map(t => (
                        <tr key={t.id} onMouseEnter={(e) => handleRowMouseEnter(e, t)} onMouseLeave={handleRowMouseLeave} className={`group hover:bg-indigo-50/40 transition-colors cursor-help ${t.isScrapped ? 'bg-rose-50/20' : ''}`}>
                          <td className="px-8 py-6"><p className={`text-lg font-black leading-tight mb-1 ${t.isScrapped ? 'text-rose-600' : 'text-emerald-600'}`}>{t.sn || '無 SN'} {t.isScrapped && '💀'}</p><p className="text-sm text-slate-400 font-bold uppercase">機台: {t.machineNumber || '--'}</p></td>
                          <td className="px-8 py-6"><p className="text-base font-black text-slate-900">{t.materialName}</p><p className="text-xs text-rose-500 font-black mt-1">原因: {t.faultReason || '未標註'}</p></td>
                          <td className="px-8 py-6 text-right">
                             <p className="text-base font-black text-slate-900">{t.quantity} 件</p>
                             <p className="text-xs font-black text-emerald-600">NT$ {(t.total || 0).toLocaleString()}</p>
                          </td>
                          <td className="px-8 py-6 text-center">
                            <div className="flex flex-col items-center gap-2">
                              {t.isScrapped ? <span className="inline-flex items-center px-3 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-black">💀 已報廢</span> : !t.repairDate ? <span className="inline-flex items-center px-3 py-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-black animate-pulse">🛠️ 維修中</span> : <span className="inline-flex items-center px-3 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-black">✅ 完修</span>}
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); setEditingTransaction(t); }} className="p-1.5 border border-slate-200 rounded-lg hover:bg-white transition-all">✏️</button>
                                <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteTarget(t); }} className="p-1.5 border border-slate-200 rounded-lg hover:bg-rose-50 transition-all">🗑️</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {renderPagination()}
              </div>
            </div>
          ) : activeTab === 'records' ? (
            <div className="max-w-[1400px] mx-auto space-y-8">
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 overflow-hidden">
                <div>{renderFilterHeader()}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <tr><th className="px-8 py-5">日期/類別</th><th className="px-8 py-5">設備/料件</th><th className="px-8 py-5 text-right">數量</th><th className="px-8 py-5 text-right">總額</th><th className="px-8 py-5 text-center">管理</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {displayedList.map(t => (
                        <tr key={t.id} onMouseEnter={(e) => handleRowMouseEnter(e, t)} onMouseLeave={handleRowMouseLeave} className={`group hover:bg-indigo-50/40 transition-colors cursor-help ${t.isScrapped ? 'bg-rose-50/20' : ''}`}>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              {t.type === TransactionType.INBOUND && (
                                <div className={`relative flex items-center justify-center w-2 h-2 rounded-full ${t.isReceived === false ? 'bg-amber-400' : 'bg-emerald-500 opacity-30'}`}>
                                  {t.isReceived === false && <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75"></span>}
                                </div>
                              )}
                              <div><p className="text-base font-black text-slate-900">{t.date} {t.isScrapped && '💀'}</p><span className={`px-2.5 py-1 rounded-md text-[10px] font-black border mt-1 inline-block ${t.isScrapped ? 'bg-rose-50 text-rose-600 border-rose-100' : t.type === TransactionType.INBOUND ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : t.type === TransactionType.USAGE ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>{t.type}</span></div>
                            </div>
                          </td>
                          <td className="px-8 py-6"><p className={`text-base font-black ${t.isScrapped ? 'text-rose-600' : 'text-slate-900'}`}>{t.materialName}</p><p className="text-xs text-slate-400 font-bold">機台: {t.machineNumber}</p></td>
                          <td className="px-8 py-6 text-right font-black text-slate-900 text-base">{t.quantity}</td>
                          <td className="px-8 py-6 text-right font-black text-indigo-600 text-base">NT$ {t.total.toLocaleString()}</td>
                          <td className="px-8 py-6 text-center"><div className="flex gap-2 justify-center opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => { e.stopPropagation(); setEditingTransaction(t); }} className="p-2.5 border border-slate-200 rounded-lg hover:bg-white shadow-sm transition-all">✏️</button><button onClick={(e) => { e.stopPropagation(); setConfirmDeleteTarget(t); }} className="p-2.5 border border-slate-200 rounded-lg hover:bg-rose-50 hover:border-rose-200 transition-all">🗑️</button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {renderPagination()}
              </div>
            </div>
          ) : activeTab === 'batch' ? (
            <div className="max-w-[1400px] mx-auto"><BatchAddForm onSave={handleAction} existingTransactions={transactions} onComplete={() => setActiveTab('records')} currentUser={currentUser!} /></div>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default App;
