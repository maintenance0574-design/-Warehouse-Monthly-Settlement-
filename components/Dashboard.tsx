
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
  const [selectedYear, setSelectedYear] = useState<string>(() => String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | TransactionType.INBOUND | TransactionType.REPAIR>('ALL');

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(String(new Date().getFullYear()));
    years.add(String(new Date().getFullYear() + 1));
    transactions.forEach(t => {
      const y = t.date.split('-')[0];
      if (y && y.length === 4) years.add(y);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const costTransactions = useMemo(() => 
    transactions.filter(t => t.type === TransactionType.INBOUND || t.type === TransactionType.REPAIR),
  [transactions]);

  const filteredCostTransactions = useMemo(() => {
    return costTransactions.filter(t => {
      if (selectedTypeFilter === 'ALL') return true;
      return t.type === selectedTypeFilter;
    });
  }, [costTransactions, selectedTypeFilter]);

  const stats = useMemo(() => {
    const today = new Date();
    const currentMonthStr = String(today.getMonth() + 1).padStart(2, '0');
    const isCurrentYear = selectedYear === String(today.getFullYear());

    return filteredCostTransactions.reduce((acc, curr) => {
      const [y, m] = curr.date.split('-');
      if (y === selectedYear) {
        // 如果選擇了特定月份，則累計該月；否則累計整年
        if (selectedMonth === 'all' || m === selectedMonth) {
          acc.displayAmount += (curr.total || 0);
          acc.displayCount += 1;
        }
        
        // 額外保留「本月(當前真實月份)」的統計用於即時對比卡片
        if (isCurrentYear && m === currentMonthStr) {
          acc.currentRealMonthAmount += (curr.total || 0);
        }
      }
      return acc;
    }, { displayAmount: 0, displayCount: 0, currentRealMonthAmount: 0 });
  }, [filteredCostTransactions, selectedYear, selectedMonth]);

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

  const machineCategoryData = useMemo(() => {
    const map = new Map<string, number>();
    filteredCostTransactions.forEach(t => {
      const [y, m] = t.date.split('-');
      if (y === selectedYear) {
        // 圓餅圖也受月份篩選影響
        if (selectedMonth !== 'all' && m !== selectedMonth) return;
        
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
  }, [filteredCostTransactions, selectedYear, selectedMonth]);

  const isCurrentYear = selectedYear === String(new Date().getFullYear());

  return (
    <div className="space-y-14 pb-20">
      <div className="flex flex-wrap items-end justify-between px-2 gap-8">
        <div className="flex flex-col gap-8">
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <span className="text-4xl">💰</span> 倉儲成本分析看板
            </h3>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mt-3"> {selectedYear} Financial Analytics</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl px-5 py-2.5 shadow-sm flex items-center gap-4">
              <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">篩選</span>
              <div className="flex items-center gap-2">
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-transparent text-base font-black text-indigo-600 outline-none cursor-pointer">
                  {availableYears.map(year => <option key={year} value={year}>{year} 年</option>)}
                </select>
                <div className="w-px h-4 bg-slate-200"></div>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent text-base font-black text-indigo-600 outline-none cursor-pointer">
                  <option value="all">整年度</option>
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = String(i + 1).padStart(2, '0');
                    return <option key={m} value={m}>{m} 月</option>;
                  })}
                </select>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm flex items-center">
              <button onClick={() => setSelectedTypeFilter('ALL')} className={`px-5 py-2 rounded-xl text-sm font-black transition-all ${selectedTypeFilter === 'ALL' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>全部</button>
              <button onClick={() => setSelectedTypeFilter(TransactionType.INBOUND)} className={`px-5 py-2 rounded-xl text-sm font-black transition-all ${selectedTypeFilter === TransactionType.INBOUND ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-indigo-600'}`}>僅進貨</button>
              <button onClick={() => setSelectedTypeFilter(TransactionType.REPAIR)} className={`px-5 py-2 rounded-xl text-sm font-black transition-all ${selectedTypeFilter === TransactionType.REPAIR ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-emerald-600'}`}>僅維修</button>
            </div>
          </div>
        </div>
        
        <div className="flex gap-6">
          {isCurrentYear && selectedMonth === 'all' && (
            <div className="bg-white border border-slate-200 px-10 py-6 rounded-[2.5rem] shadow-sm">
              <p className="text-[12px] font-black text-slate-400 uppercase mb-2">本月累計成本 (真實月份)</p>
              <p className="text-3xl font-black text-indigo-600">NT$ {stats.currentRealMonthAmount.toLocaleString()}</p>
            </div>
          )}
          <div className="bg-slate-900 px-10 py-6 rounded-[2.5rem] shadow-xl shadow-slate-200">
            <p className="text-[12px] font-black text-slate-400 uppercase mb-2">
              {selectedMonth === 'all' ? `${selectedYear} 年度累計總額` : `${selectedYear}年 ${selectedMonth}月 累計總額`}
            </p>
            <p className="text-3xl font-black text-white">NT$ {stats.displayAmount.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
        <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm group hover:border-indigo-500 transition-all duration-500">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-4xl mb-8 group-hover:bg-indigo-600 group-hover:text-white transition-all">💸</div>
          <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-3">
            {selectedMonth === 'all' ? '年度結算對帳' : '月份結算對帳'}
          </p>
          <p className="text-4xl font-black text-slate-900">NT$ {stats.displayAmount.toLocaleString()}</p>
          <div className="mt-4">
            <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[13px] font-black">含 {stats.displayCount} 筆交易紀錄</span>
          </div>
        </div>
        
        <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm group hover:border-emerald-500 transition-all duration-500">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-4xl mb-8 group-hover:bg-emerald-600 group-hover:text-white transition-all">📊</div>
          <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-3">分析範圍</p>
          <p className="text-3xl font-black text-slate-900 truncate">
            {selectedTypeFilter === 'ALL' ? '全項目結算' : selectedTypeFilter === TransactionType.INBOUND ? '單項: 進貨' : '單項: 維修'}
          </p>
          <p className="text-sm text-emerald-500 font-bold mt-4">
            {selectedMonth === 'all' ? '統計範圍：整年度' : `統計範圍：${selectedMonth} 月份`}
          </p>
        </div>

        <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm group hover:border-indigo-500 transition-all duration-500">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-4xl mb-8 group-hover:bg-indigo-600 group-hover:text-white transition-all">🏗️</div>
          <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-3">最高支出機台</p>
          <p className="text-3xl font-black text-slate-900 truncate pr-2">{machineCategoryData[0]?.name || '--'}</p>
          <div className="mt-4">
            <span className="text-sm text-slate-400 font-bold italic">佔此區間支出比例 {machineCategoryData[0]?.percent.toFixed(1) || 0}%</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-12">
        <div className="w-full bg-white p-14 rounded-[4rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-14">
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-5">
              <span className="w-3 h-12 bg-indigo-600 rounded-full"></span>
              {selectedYear} 月度支出走勢分析
            </h3>
          </div>
          <div className="h-[500px] w-full">
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
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 14, fontWeight: 900, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 800, fill: '#94a3b8' }} tickFormatter={(val) => `NT$${(val/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', padding: '20px' }}
                    formatter={(value: number) => [`NT$ ${value.toLocaleString()}`, '結算金額']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#4f46e5" 
                    strokeWidth={6} 
                    fill="url(#colorAmt)" 
                    dot={(props: any) => {
                      const { cx, cy, payload, index } = props;
                      const isSelectedMonth = selectedMonth !== 'all' && (index + 1) === parseInt(selectedMonth);
                      return (
                        <circle 
                          key={`dot-${index}`} 
                          cx={cx} cy={cy} 
                          r={isSelectedMonth ? 10 : 7} 
                          fill={isSelectedMonth ? '#f43f5e' : '#4f46e5'} 
                          strokeWidth={4} 
                          stroke="#fff" 
                        />
                      );
                    }} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-[4rem] border-2 border-dashed border-slate-200 opacity-30">
                <span className="text-6xl mb-4">📭</span>
                <p className="text-base font-black uppercase tracking-widest text-slate-400">尚無相關數據</p>
              </div>
            )}
          </div>
        </div>

        <div className="w-full bg-white p-14 rounded-[4rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-12">
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-5">
              <span className="w-3 h-12 bg-emerald-500 rounded-full"></span>
              支出佔比 (依機台類別 - {selectedMonth === 'all' ? '整年度' : `${selectedMonth}月份`})
            </h3>
          </div>
          <div className="h-[500px] w-full">
            {machineCategoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={machineCategoryData} innerRadius="40%" outerRadius="65%" paddingAngle={8} dataKey="value" label={({ name, percent }) => `${name} (${percent.toFixed(1)}%)`}>
                    {machineCategoryData.map((_, index) => <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} stroke="#fff" strokeWidth={8} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => `NT$ ${value.toLocaleString()}`} />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontWeight: 900, fontSize: '14px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-300 font-black italic text-xl opacity-30">此期間暫無類別數據</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
