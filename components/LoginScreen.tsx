import React, { useState } from 'react';

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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(selectedUser);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 flex items-center justify-center p-6 font-['Noto_Sans_TC']">
      {/* 背景裝飾 */}
      <div className="absolute inset-0 opacity-30 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-900 rounded-full blur-[150px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-900 rounded-full blur-[150px] animate-pulse"></div>
      </div>

      <div className="w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-[3.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden relative z-10 p-12 border border-white/20">
        <div className="text-center mb-12">
          <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center font-black text-5xl text-white shadow-[0_20px_40px_-10px_rgba(79,70,229,0.5)] mx-auto mb-8 -rotate-6 transform hover:rotate-0 transition-transform duration-500">倉</div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">倉管智慧月結系統</h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em]">Warehouse Intelligence Protocol</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-10">
          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-6 text-center">請點擊選擇操作人員</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {AUTHORIZED_USERS.map((user) => (
                <button
                  key={user.name}
                  type="button"
                  onClick={() => setSelectedUser(user.name)}
                  className={`relative p-6 rounded-3xl border-2 transition-all duration-300 flex flex-col items-center gap-3 group ${
                    selectedUser === user.name
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-lg scale-105'
                      : 'border-slate-100 bg-slate-50 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <span className="text-3xl filter grayscale group-hover:grayscale-0 transition-all duration-300 transform group-hover:scale-110">
                    {user.emoji}
                  </span>
                  <span className={`text-sm font-black ${selectedUser === user.name ? 'text-indigo-600' : 'text-slate-600'}`}>
                    {user.name}
                  </span>
                  {selectedUser === user.name && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center shadow-sm">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full py-6 bg-slate-900 hover:bg-indigo-600 text-white rounded-[2rem] font-black text-lg shadow-2xl transition-all active:scale-[0.98] group flex items-center justify-center gap-4"
          >
            <span>以 {selectedUser} 身分進入</span>
            <svg className="w-6 h-6 transform group-hover:translate-x-2 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em]">
            Authorized Personnel Only • Secure Session v5.9
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;