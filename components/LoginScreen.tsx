
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
      const response = await dbService.verifyLogin(selectedUser, password);
      if (response.authorized) {
        onLogin(selectedUser);
      } else {
        setError(response.message || '密碼錯誤');
        setPassword('');
      }
    } catch (err) {
      setError('系統連線異常');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 flex items-center justify-center p-4 font-['Noto_Sans_TC'] overflow-y-auto">
      <div className="w-full max-w-3xl bg-white/95 backdrop-blur-xl rounded-[3rem] shadow-2xl p-6 md:p-10 border border-white/20 relative z-10 my-auto">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center font-black text-3xl text-white mx-auto mb-4 -rotate-3 shadow-lg">倉</div>
          <h1 className="text-2xl font-black text-slate-900 mb-1">倉管智慧月結系統</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Warehouse Intelligence Protocol</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 text-center">選擇操作人員</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {AUTHORIZED_USERS.map((user) => (
                <button
                  key={user.name}
                  type="button"
                  disabled={isVerifying}
                  onClick={() => { setSelectedUser(user.name); setError(''); }}
                  className={`relative p-3.5 rounded-[1.5rem] border-2 transition-all flex flex-col items-center gap-1.5 ${
                    selectedUser === user.name ? 'border-indigo-600 bg-indigo-50/50 scale-105' : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <span className="text-2xl">{user.emoji}</span>
                  <span className={`text-xs font-black ${selectedUser === user.name ? 'text-indigo-600' : 'text-slate-600'}`}>{user.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="max-w-sm mx-auto space-y-4">
            <div className="relative">
              <div className="relative group">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="請輸入身分密碼..."
                  required
                  disabled={isVerifying}
                  className="w-full px-5 py-3.5 bg-slate-100 border-2 border-slate-100 rounded-[1.25rem] font-black text-center focus:border-indigo-600 outline-none transition-all"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPassword ? '🔒' : '👁️'}
                </button>
              </div>
              {error && <p className="text-xs font-bold text-rose-600 mt-2 text-center">⚠️ {error}</p>}
            </div>
            
            <button 
              type="submit" 
              disabled={isVerifying}
              className={`w-full py-4.5 ${isVerifying ? 'bg-indigo-400' : 'bg-slate-900 hover:bg-indigo-600'} text-white rounded-[1.5rem] font-black text-lg transition-all flex items-center justify-center gap-3`}
            >
              {isVerifying ? '驗證中...' : `以 ${selectedUser} 身分進入 ➔`}
            </button>
          </div>
        </form>

        <div className="mt-8 pt-4 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Secure Verified Session • Protocol v6.2</p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
