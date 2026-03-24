import { useState } from 'react';

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
    <div className="min-h-screen bg-[#191919] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#252525] rounded-xl shadow-2xl border border-[#373737] p-10 flex flex-col gap-8">
        <div className="text-center flex flex-col gap-2">
          <div className="text-4xl font-serif font-bold tracking-widest text-gray-200">LD</div>
          <h1 className="text-xl font-bold text-gray-100 uppercase tracking-tight">Luxury Detective Login</h1>
          <p className="text-xs text-gray-400 font-medium">관리자에게 부여받은 계정으로 로그인하세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
            <input
              type="email"
              required
              className="w-full p-3.5 bg-[#1f1f1f] border border-[#3a3a3a] rounded-lg text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
            <input
              type="password"
              required
              className="w-full p-3.5 bg-[#1f1f1f] border border-[#3a3a3a] rounded-lg text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-red-500 font-semibold text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gray-100 text-gray-900 rounded-lg font-bold text-sm uppercase tracking-[0.2em] shadow-lg hover:bg-white transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
