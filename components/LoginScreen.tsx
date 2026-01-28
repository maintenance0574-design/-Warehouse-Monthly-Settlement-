
import React, { useState } from 'react';
import { dbService } from '../services/dbService';

interface Props {
  onLogin: (username: string) => void;
}

const AUTHORIZED_USERS = [
  { name: 'Mountain', emoji: '⛰️' },
  { name: 'Uri', emoji: '🌟' },
  { name: 'Simon', emoji: '🦁' },
  { name: 'George', emoji: '⚓' },
  { name: 'Barry', emoji: '🛡️' },
  { name: 'Jason', emoji: '🏹' },
  { name: 'Nick', emoji: '🐺' }
];

const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const [selectedUser, setSelectedUser] = useState(AUTHORIZED_USERS[0].name);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifying) return;

    setError('');
    setIsVerifying(true);

    try {
      // 呼叫後端保全進行驗證 (屋子內的驗證)
      const response = await dbService.verifyLogin(selectedUser, password);
      
      if (response.authorized) {
        onLogin(selectedUser);
      } else {
        setError(response.message || '密碼驗證失敗，請重新輸入');
        setPassword('');
        // 觸發震動效果
        const form = e.currentTarget as HTMLElement;
        form.classList.add('animate-shake');
        setTimeout(() => form.classList.remove('animate-shake'), 500);
      }
    } catch (err) {
      setError('系統連線異常，請稍後再試');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 flex items-center justify-center p-6 font-['Noto_Sans_TC']">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>

      {/* 背景裝飾 */}
      <div className="absolute inset-0 opacity-30 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-900 rounded-full blur-[150px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-900 rounded-full blur-[150px] animate-pulse"></div>
      </div>

      <div className="w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-[3.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden relative z-10 p-12 border border-white/20">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center font-black text-4xl text-white shadow-[0_20px_40px_-10px_rgba(79,70,229,0.5)] mx-auto mb-6 -rotate-6 transform hover:rotate-0 transition-transform duration-500">倉</div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">倉管智慧月結系統</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">Warehouse Intelligence Protocol</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-8">
          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-6 text-center">選擇操作人員</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {AUTHORIZED_USERS.map((user) => (
                <button
                  key={user.name}
                  type="button"
                  disabled={isVerifying}
                  onClick={() => {
                    setSelectedUser(user.name);
                    setError('');
                  }}
                  className={`relative p-4 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-2 group ${
                    selectedUser === user.name
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-lg scale-105'
                      : 'border-slate-100 bg-slate-50 hover:border-slate-300 hover:bg-white disabled:opacity-50'
                  }`}
                >
                  <span className="text-2xl filter grayscale group-hover:grayscale-0 transition-all duration-300 transform group-hover:scale-110">
                    {user.emoji}
                  </span>
                  <span className={`text-xs font-black ${selectedUser === user.name ? 'text-indigo-600' : 'text-slate-600'}`}>
                    {user.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="max-w-xs mx-auto space-y-3">
            <div className="relative">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">身分驗證密碼</label>
              <div className="relative group">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="請輸入後端密碼..."
                  required
                  disabled={isVerifying}
                  className={`w-full px-5 py-4 bg-slate-100 border-2 rounded-2xl font-black text-sm outline-none transition-all ${
                    error 
                      ? 'border-rose-500 bg-rose-50 text-rose-900 ring-4 ring-rose-500/10' 
                      : 'border-slate-100 focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-500/10'
                  } disabled:opacity-70`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  {showPassword ? '🔒' : '👁️'}
                </button>
              </div>
              {error && (
                <p className="text-[11px] font-bold text-rose-600 mt-2 text-center animate-pulse">
                  ⚠️ {error}
                </p>
              )}
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isVerifying}
            className={`w-full py-5 ${isVerifying ? 'bg-indigo-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-indigo-600'} text-white rounded-[1.75rem] font-black text-base shadow-2xl transition-all active:scale-[0.98] group flex items-center justify-center gap-3`}
          >
            {isVerifying ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>安全性驗證中...</span>
              </>
            ) : (
              <>
                <span>以 {selectedUser} 身分進入</span>
                <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>
        </form>

        <div className="mt-10 pt-6 border-t border-slate-100 text-center">
          <p className="text-[9px] text-slate-300 font-bold uppercase tracking-[0.2em]">
            Backend Verified Session • Secure Protocol v6.2
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
