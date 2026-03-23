import { useState } from 'react';

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
    <div className="min-h-screen bg-[#fcfbf7] flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-100 p-10 flex flex-col gap-8">
        <div className="text-center flex flex-col gap-2">
          <div className="text-4xl font-serif font-bold tracking-widest text-[#c5a059]">LD</div>
          <h1 className="text-xl font-bold text-gray-800 uppercase tracking-tight">Setup Your Account</h1>
          <p className="text-xs text-gray-400 font-medium">최초 로그인 시 비밀번호와 프로필을 설정해야 합니다.</p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Real Name</label>
            <input
              type="text"
              required
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c5a059]/20"
              placeholder="성함 입력"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="md:col-span-2 flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Department</label>
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.map(dept => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setDepartment(dept)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${department === dept ? 'bg-[#c5a059] border-[#c5a059] text-white shadow-md' : 'bg-white border-gray-200 text-gray-400 hover:border-[#c5a059]'}`}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">New Password</label>
            <input
              type="password"
              required
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c5a059]/20"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Confirm Password</label>
            <input
              type="password"
              required
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c5a059]/20"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && <div className="md:col-span-2 text-xs text-red-500 font-semibold text-center">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="md:col-span-2 py-4 bg-gray-900 text-white rounded-lg font-bold text-sm uppercase tracking-[0.2em] shadow-lg hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Saving Settings...' : 'Complete Registration'}
          </button>
        </form>
      </div>
    </div>
  );
}
