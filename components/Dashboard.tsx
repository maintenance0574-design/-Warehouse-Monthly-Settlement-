
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
  // --- 年度狀態管理 ---
  const [selectedYear, setSelectedYear] = useState<string>(() => String(new Date().getFullYear()));

  // 1. 提取現有資料中所有的年份供選擇
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    // 預設加入今年與明年
    years.add(String(new Date().getFullYear()));
    years.add(String(new Date().getFullYear() + 1));
    
    transactions.forEach(t => {
      const y = t.date.split('-')[0];
      if (y) years.add(y);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  // 2. 僅過濾「進貨」紀錄
  const inboundTransactions = useMemo(() => 
    transactions.filter(t => t.type === TransactionType.INBOUND),
  [transactions]);

  // 3. 核心指標計算 (基於所選年度)
  const stats = useMemo(() => {
    const today = new Date();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const isCurrentYear = selectedYear === String(today.getFullYear());

    return inboundTransactions.reduce((acc, curr) => {
      const [y, m] = curr.date.split('-');
      
      if (y === selectedYear) {
        acc.yearAmount += curr.total;
        acc.yearCount += 1;
        
        // 只有在選擇的是今年時，才計算「本月」額度，否則本月沒意義
        if (isCurrentYear && m === currentMonth) {
          acc.monthAmount += curr.total;
          acc.monthCount += 1;
        }
      }
      return acc;
    }, { monthAmount: 0, monthCount: 0, yearAmount: 0, yearCount: 0 });
  }, [inboundTransactions, selectedYear]);

  // 4. 所選年度 12 個月趨勢數據
  const annualTrendData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const monthStr = String(i + 1).padStart(2, '0');
      return {
        month: `${i + 1}月`,
        fullMonth: `${selectedYear}-${monthStr}`,
        amount: 0
      };
    });

    inboundTransactions.forEach(t => {
      const [y, m] = t.date.split('-');
      if (y === selectedYear) {
        const mIdx = parseInt(m) - 1;
        if (months[mIdx]) {
          months[mIdx].amount += t.total;
        }
      }
    });

    return months;
  }, [inboundTransactions, selectedYear]);

  // 5. 所選年度機台種類分佈數據
  const machineCategoryData = useMemo(() => {
    const map = new Map<string, number>();
    inboundTransactions.forEach(t => {
      const [y] = t.date.split('-');
      if (y === selectedYear) {
        const cat = t.machineCategory || '未分類';
        map.set(cat, (map.get(cat) || 0) + t.total);
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
  }, [inboundTransactions, selectedYear]);

  const isCurrentYear = selectedYear === String(new Date().getFullYear());

  return (
    <div className="space-y-12 pb-20">
      {/* 標題與即時摘要 */}
      <div className="flex flex-wrap items-end justify-between px-2 gap-4">
        <div className="flex items-center gap-6">
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">📦 進貨數據智慧看板</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-2"> {selectedYear} Procurement Analytics</p>
          </div>
          {/* 年度切換器 */}
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">分析年度</span>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-sm font-black text-indigo-600 outline-none cursor-pointer"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year} 年</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex gap-4">
          {isCurrentYear && (
            <div className="bg-white border border-slate-200 px-8 py-4 rounded-[2rem] shadow-sm animate-in fade-in slide-in-from-right-4 duration-500">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">本月累計支出</p>
              <p className="text-2xl font-black text-indigo-600">NT$ {stats.monthAmount.toLocaleString()}</p>
            </div>
          )}
          <div className="bg-slate-900 px-8 py-4 rounded-[2rem] shadow-xl shadow-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{selectedYear} 年度累計總額</p>
            <p className="text-2xl font-black text-white">NT$ {stats.yearAmount.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* 核心指標卡組 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm group hover:border-indigo-500 transition-all duration-500">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">📅</div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{selectedYear} 年進貨總結</p>
          <p className="text-4xl font-black text-slate-900">NT$ {stats.yearAmount.toLocaleString()}</p>
          <div className="mt-3">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[11px] font-black">該年度共 {stats.yearCount} 筆單據</span>
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm group hover:border-emerald-500 transition-all duration-500">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-all">📍</div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{isCurrentYear ? '本月交易規模' : `${selectedYear} 平均單據`}</p>
          <p className="text-4xl font-black text-slate-900">{isCurrentYear ? `${stats.monthCount} 筆單據` : `共 ${stats.yearCount} 筆`}</p>
          <p className="text-xs text-emerald-500 font-bold mt-3">{isCurrentYear ? '當前月份數據實時更新' : '歷史年度存檔數據'}</p>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm group hover:border-indigo-500 transition-all duration-500">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">🏗️</div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{selectedYear} 最大支出類別</p>
          <p className="text-4xl font-black text-slate-900 truncate pr-2">{machineCategoryData[0]?.name || '--'}</p>
          <div className="mt-3">
            <span className="text-xs text-slate-400 font-bold italic">佔 {selectedYear} 年度總額 {machineCategoryData[0]?.percent.toFixed(1) || 0}%</span>
          </div>
        </div>
      </div>

      {/* 改為上下堆疊的圖表區 */}
      <div className="flex flex-col gap-10">
        {/* 1. 年度趨勢分析圖 (上方) */}
        <div className="w-full bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-12">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-4">
              <span className="w-2.5 h-10 bg-indigo-600 rounded-full"></span>
              {selectedYear} 年度進貨支出走勢 (1-12月)
            </h3>
            <div className="px-5 py-2 bg-slate-50 border border-slate-100 rounded-full text-[11px] font-black text-slate-500 uppercase tracking-widest">Monthly Trend Analysis</div>
          </div>
          <div className="h-[550px] w-full">
            {annualTrendData.some(d => d.amount > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={annualTrendData} margin={{ top: 30, right: 30, left: 100, bottom: 50 }}>
                  <defs>
                    <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 13, fontWeight: 900, fill: '#64748b' }} 
                    dy={20} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fontWeight: 800, fill: '#94a3b8' }} 
                    tickFormatter={(val) => `NT$ ${val.toLocaleString()}`}
                  />
                  <Tooltip 
                    cursor={{ stroke: '#4f46e5', strokeWidth: 2, strokeDasharray: '6 6' }} 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', padding: '20px', fontSize: '14px', fontWeight: 'bold' }}
                    formatter={(value: number) => [`NT$ ${value.toLocaleString()}`, '進貨金額']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#4f46e5" 
                    strokeWidth={6} 
                    fillOpacity={1} 
                    fill="url(#colorAmt)" 
                    dot={{ r: 7, fill: '#4f46e5', strokeWidth: 4, stroke: '#fff' }} 
                    activeDot={{ r: 11, fill: '#4f46e5', strokeWidth: 5, stroke: '#fff' }} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                <span className="text-7xl mb-6 opacity-20">📊</span>
                <p className="text-base font-black text-slate-300 uppercase tracking-widest">目前 {selectedYear} 年度尚無進貨紀錄</p>
              </div>
            )}
          </div>
        </div>

        {/* 2. 類別分佈圖 (下方) */}
        <div className="w-full bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-4">
              <span className="w-2.5 h-10 bg-emerald-500 rounded-full"></span>
              {selectedYear} 機台種類支出分佈
            </h3>
            <div className="px-5 py-2 bg-slate-50 border border-slate-100 rounded-full text-[11px] font-black text-slate-500 uppercase tracking-widest">Category Distribution</div>
          </div>
          <div className="h-[550px] w-full">
            {machineCategoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={machineCategoryData}
                    innerRadius="45%"
                    outerRadius="65%"
                    paddingAngle={10}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${percent.toFixed(1)}%)`}
                    labelLine={false}
                    cx="50%"
                    cy="50%"
                    isAnimationActive={true}
                  >
                    {machineCategoryData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} 
                        stroke="#fff" 
                        strokeWidth={8} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', padding: '20px', fontSize: '14px' }}
                    formatter={(value: number) => `NT$ ${value.toLocaleString()}`}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    align="center" 
                    iconType="circle" 
                    iconSize={14}
                    layout="horizontal"
                    wrapperStyle={{ fontSize: '13px', fontWeight: '900', color: '#64748b', paddingTop: '40px' }}
                  />
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
