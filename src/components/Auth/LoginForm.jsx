import { useState } from 'react';
import { Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message || '로그인에 실패했습니다. 정보를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-bg-base flex items-center justify-center p-6 transition-colors duration-200">
      <div className="w-full max-w-[440px] bg-white dark:bg-bg-elevated rounded-[40px] shadow-[0_40px_100px_rgba(0,0,0,0.1)] dark:shadow-[0_40px_100px_rgba(0,0,0,0.4)] border border-gray-100 dark:border-border-subtle p-12 flex flex-col gap-10 animate-scale-in">
        <div className="text-center flex flex-col gap-4">
          <div className="w-20 h-20 bg-gray-900 dark:bg-white rounded-[32px] flex items-center justify-center text-white dark:text-gray-900 text-3xl font-black shadow-2xl mx-auto border-4 border-white dark:border-border-strong animate-fade-in">LD</div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-black text-gray-900 dark:text-text-primary tracking-tight uppercase tracking-[0.1em]">Roadmap Board</h1>
            <p className="text-sm text-gray-400 dark:text-text-tertiary font-bold leading-relaxed">워크스페이스에 로그인하여 업무를 관리하세요.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black text-gray-400 dark:text-text-tertiary uppercase tracking-[0.3em] ml-1">Email Address</label>
            <div className="relative flex items-center group">
              <Mail size={18} className="absolute left-4 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="email"
                required
                className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-bg-base border-2 border-transparent dark:border-border-subtle rounded-2xl text-base font-bold text-gray-900 dark:text-text-primary focus:outline-none focus:ring-8 focus:ring-blue-500/5 focus:border-blue-500/30 focus:bg-white dark:focus:bg-bg-base transition-all placeholder:text-gray-300 dark:placeholder:text-text-tertiary"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black text-gray-400 dark:text-text-tertiary uppercase tracking-[0.3em] ml-1">Password</label>
            <div className="relative flex items-center group">
              <Lock size={18} className="absolute left-4 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="password"
                required
                className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-bg-base border-2 border-transparent dark:border-border-subtle rounded-2xl text-base font-bold text-gray-900 dark:text-text-primary focus:outline-none focus:ring-8 focus:ring-blue-500/5 focus:border-blue-500/30 focus:bg-white dark:focus:bg-bg-base transition-all placeholder:text-gray-300 dark:placeholder:text-text-tertiary"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-[13px] font-bold text-red-600 dark:text-red-400 text-center animate-fade-in">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:bg-black dark:hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 mt-4"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <><ArrowRight size={20} strokeWidth={3} /> Sign In</>}
          </button>
        </form>
      </div>
    </div>
  );
}
