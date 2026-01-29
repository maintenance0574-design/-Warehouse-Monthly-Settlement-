
import React, { useMemo, useState } from 'react';
import { Transaction, TransactionType } from '../types';
import { 
  ResponsiveContainer, 
  XAxis, YAxis, Tooltip,
  CartesianGrid,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area
} from 'recharts';

interface Props {
  transactions: Transaction[];
}

const CATEGORY_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#94a3b8'];

const Dashboard: React.FC<Props> = ({ transactions }) => {
  // --- 狀態管理 ---
  const [selectedYear, setSelectedYear] = useState<string>(() => String(new Date().getFullYear()));
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | TransactionType.INBOUND | TransactionType.REPAIR>('ALL');

  // 1. 提取現有資料中所有的年份供選擇
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(String(new Date().getFullYear()));
    years.add(String(new Date().getFullYear() + 1));
    transactions.forEach(t => {
      const y = t.date.split('-')[0];
      if (y) years.add(y);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  // 2. 過濾用於計算的交易 (包含進貨與維修)
  const costTransactions = useMemo(() => 
    transactions.filter(t => t.type === TransactionType.INBOUND || t.type === TransactionType.REPAIR),
  [transactions]);

  // 3. 根據篩選器進一步過濾
  const filteredCostTransactions = useMemo(() => {
    return costTransactions.filter(t => {
      if (selectedTypeFilter === 'ALL') return true;
      return t.type === selectedTypeFilter;
    });
  }, [costTransactions, selectedTypeFilter]);

  // 4. 核心指標計算
  const stats = useMemo(() => {
    const today = new Date();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const isCurrentYear = selectedYear === String(today.getFullYear());

    return filteredCostTransactions.reduce((acc, curr) => {
      const [y, m] = curr.date.split('-');
      if (y === selectedYear) {
        acc.yearAmount += (curr.total || 0);
        acc.yearCount += 1;
        if (isCurrentYear && m === currentMonth) {
          acc.monthAmount += (curr.total || 0);
          acc.monthCount += 1;
        }
      }
      return acc;
    }, { monthAmount: 0, monthCount: 0, yearAmount: 0, yearCount: 0 });
  }, [filteredCostTransactions, selectedYear]);

  // 5. 趨勢數據
  const annualTrendData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: `${i + 1}月`,
      amount: 0
    }));
    filteredCostTransactions.forEach(t => {
      const [y, m] = t.date.split('-');
      if (y === selectedYear) {
        const mIdx = parseInt(m) - 1;
        if (months[mIdx]) months[mIdx].amount += (t.total || 0);
      }
    });
    return months;
  }, [filteredCostTransactions, selectedYear]);

  // 6. 機台分佈
  const machineCategoryData = useMemo(() => {
    const map = new Map<string, number>();
    filteredCostTransactions.forEach(t => {
      const [y] = t.date.split('-');
      if (y === selectedYear) {
        const cat = t.machineCategory || '未分類';
        map.set(cat, (map.get(cat) || 0) + (t.total || 0));
      }
    });
    const totalValue = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map.entries())
      .map(([name, value]) => ({ 
        name, 
        value,
        percent: totalValue > 0 ? (value / totalValue) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredCostTransactions, selectedYear]);

  const isCurrentYear = selectedYear === String(new Date().getFullYear());

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-wrap items-end justify-between px-2 gap-6">
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">💰 倉儲成本分析看板</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-2"> {selectedYear} Financial Analytics</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">年份</span>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-transparent text-sm font-black text-indigo-600 outline-none">
                {availableYears.map(year => <option key={year} value={year}>{year} 年</option>)}
              </select>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-1 shadow-sm flex items-center">
              <button onClick={() => setSelectedTypeFilter('ALL')} className={`px-4 py-1.5 rounded-xl text-[11px] font-black transition-all ${selectedTypeFilter === 'ALL' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>全部</button>
              <button onClick={() => setSelectedTypeFilter(TransactionType.INBOUND)} className={`px-4 py-1.5 rounded-xl text-[11px] font-black transition-all ${selectedTypeFilter === TransactionType.INBOUND ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-indigo-600'}`}>僅進貨</button>
              <button onClick={() => setSelectedTypeFilter(TransactionType.REPAIR)} className={`px-4 py-1.5 rounded-xl text-[11px] font-black transition-all ${selectedTypeFilter === TransactionType.REPAIR ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-emerald-600'}`}>僅維修</button>
            </div>
          </div>
        </div>
        
        <div className="flex gap-4">
          {isCurrentYear && (
            <div className="bg-white border border-slate-200 px-8 py-4 rounded-[2rem] shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">本月累計成本</p>
              <p className="text-2xl font-black text-indigo-600">NT$ {stats.monthAmount.toLocaleString()}</p>
            </div>
          )}
          <div className="bg-slate-900 px-8 py-4 rounded-[2rem] shadow-xl shadow-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{selectedYear} 年度累計總額</p>
            <p className="text-2xl font-black text-white">NT$ {stats.yearAmount.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm group hover:border-indigo-500 transition-all duration-500">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">💸</div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">年度結算對帳</p>
          <p className="text-4xl font-black text-slate-900">NT$ {stats.yearAmount.toLocaleString()}</p>
          <div className="mt-3">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[11px] font-black">含 {stats.yearCount} 筆交易紀錄</span>
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm group hover:border-emerald-500 transition-all duration-500">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-all">📊</div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">分析範圍</p>
          <p className="text-4xl font-black text-slate-900 truncate">
            {selectedTypeFilter === 'ALL' ? '全項目結算' : selectedTypeFilter === TransactionType.INBOUND ? '單項: 進貨' : '單項: 維修'}
          </p>
          <p className="text-xs text-emerald-500 font-bold mt-3">當前數據僅包含有費用之項目</p>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm group hover:border-indigo-500 transition-all duration-500">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">🏗️</div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">最高支出機台</p>
          <p className="text-4xl font-black text-slate-900 truncate pr-2">{machineCategoryData[0]?.name || '--'}</p>
          <div className="mt-3">
            <span className="text-xs text-slate-400 font-bold italic">佔年度支出比例 {machineCategoryData[0]?.percent.toFixed(1) || 0}%</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-10">
        <div className="w-full bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-12">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-4">
              <span className="w-2.5 h-10 bg-indigo-600 rounded-full"></span>
              {selectedYear} 月度支出走勢分析
            </h3>
          </div>
          <div className="h-[450px] w-full">
            {annualTrendData.some(d => d.amount > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={annualTrendData} margin={{ top: 10, right: 30, left: 60, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 13, fontWeight: 900, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 800, fill: '#94a3b8' }} tickFormatter={(val) => `NT$${(val/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1) padding: 20px' }}
                    formatter={(value: number) => [`NT$ ${value.toLocaleString()}`, '結算金額']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={5} fill="url(#colorAmt)" dot={{ r: 6, fill: '#4f46e5', strokeWidth: 3, stroke: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 opacity-30">
                <span className="text-5xl mb-4">📭</span>
                <p className="text-sm font-black uppercase tracking-widest text-slate-400">尚無相關數據</p>
              </div>
            )}
          </div>
        </div>

        <div className="w-full bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-4">
              <span className="w-2.5 h-10 bg-emerald-500 rounded-full"></span>
              支出佔比 (依機台類別)
            </h3>
          </div>
          <div className="h-[450px] w-full">
            {machineCategoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={machineCategoryData} innerRadius="40%" outerRadius="65%" paddingAngle={8} dataKey="value" label={({ name, percent }) => `${name} (${percent.toFixed(1)}%)`}>
                    {machineCategoryData.map((_, index) => <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} stroke="#fff" strokeWidth={6} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => `NT$ ${value.toLocaleString()}`} />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontWeight: 900, fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-300 font-black italic text-lg opacity-30">暫無類別數據</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
