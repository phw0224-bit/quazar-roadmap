import { useState } from 'react';
import { ShieldCheck, User, Check, Loader2 } from 'lucide-react';

const DEPARTMENTS = ['감정팀', '개발팀', 'AI팀', '기획팀', '지원팀'];

export default function SetupProfileForm({ onComplete }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      return setError('비밀번호가 일치하지 않습니다.');
    }
    if (password.length < 6) {
      return setError('비밀번호는 최소 6자 이상이어야 합니다.');
    }
    if (!department) {
      return setError('소속 부서를 선택해주세요.');
    }

    setLoading(true);
    try {
      await onComplete({ password, name, department });
    } catch (err) {
      setError(err.message || '설정 저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-bg-base flex items-center justify-center p-6 transition-colors duration-200">
      <div className="w-full max-w-[600px] bg-white dark:bg-bg-elevated rounded-[40px] shadow-[0_40px_100px_rgba(0,0,0,0.1)] dark:shadow-[0_40px_100px_rgba(0,0,0,0.4)] border border-gray-100 dark:border-border-subtle p-12 flex flex-col gap-10 animate-scale-in">
        <div className="text-center flex flex-col gap-4">
          <div className="w-20 h-20 bg-emerald-500 rounded-[32px] flex items-center justify-center text-white text-3xl font-black shadow-2xl mx-auto border-4 border-white dark:border-border-strong animate-fade-in">
            <ShieldCheck size={40} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-black text-gray-900 dark:text-text-primary tracking-tight uppercase tracking-[0.1em]">Setup Profile</h1>
            <p className="text-sm text-gray-400 dark:text-text-tertiary font-bold leading-relaxed">최초 로그인 시 비밀번호와 프로필을 설정해야 합니다.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 flex flex-col gap-2">
              <label className="text-[11px] font-black text-gray-400 dark:text-text-tertiary uppercase tracking-[0.3em] ml-1">Real Name</label>
              <div className="relative flex items-center group">
                <User size={18} className="absolute left-4 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  required
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-bg-base border-2 border-transparent dark:border-border-subtle rounded-2xl text-base font-bold text-gray-900 dark:text-text-primary focus:outline-none focus:ring-8 focus:ring-blue-500/5 focus:border-blue-500/30 focus:bg-white dark:focus:bg-bg-base transition-all placeholder:text-gray-300 dark:placeholder:text-text-tertiary"
                  placeholder="본인의 성함을 입력하세요"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="md:col-span-2 flex flex-col gap-3">
              <label className="text-[11px] font-black text-gray-400 dark:text-text-tertiary uppercase tracking-[0.3em] ml-1">Select Department</label>
              <div className="flex flex-wrap gap-2">
                {DEPARTMENTS.map(dept => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setDepartment(dept)}
                    className={`px-5 py-2.5 rounded-xl text-[13px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${
                      department === dept 
                        ? 'bg-gray-900 border-gray-900 text-white dark:bg-white dark:border-white dark:text-gray-900 shadow-lg scale-105' 
                        : 'bg-gray-50 dark:bg-bg-base border-transparent dark:border-border-subtle text-gray-400 dark:text-text-tertiary hover:border-gray-300 dark:hover:border-border-strong'
                    }`}
                  >
                    {department === dept && <Check size={14} strokeWidth={4} />}
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black text-gray-400 dark:text-text-tertiary uppercase tracking-[0.3em] ml-1">New Password</label>
              <input
                type="password"
                required
                className="w-full px-5 py-4 bg-gray-50 dark:bg-bg-base border-2 border-transparent dark:border-border-subtle rounded-2xl text-base font-bold text-gray-900 dark:text-text-primary focus:outline-none focus:ring-8 focus:ring-blue-500/5 focus:border-blue-500/30 focus:bg-white dark:focus:bg-bg-base transition-all placeholder:text-gray-300 dark:placeholder:text-text-tertiary"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black text-gray-400 dark:text-text-tertiary uppercase tracking-[0.3em] ml-1">Confirm Password</label>
              <input
                type="password"
                required
                className="w-full px-5 py-4 bg-gray-50 dark:bg-bg-base border-2 border-transparent dark:border-border-subtle rounded-2xl text-base font-bold text-gray-900 dark:text-text-primary focus:outline-none focus:ring-8 focus:ring-blue-500/5 focus:border-blue-500/30 focus:bg-white dark:focus:bg-bg-base transition-all placeholder:text-gray-300 dark:placeholder:text-text-tertiary"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-[13px] font-bold text-red-600 dark:text-red-400 text-center animate-fade-in">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:bg-black dark:hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 mt-4"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : 'Complete Registration'}
          </button>
        </form>
      </div>
    </div>
  );
}
