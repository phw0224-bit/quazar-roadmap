import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import KanbanBoard from './components/KanbanBoard';
import LoginForm from './components/Auth/LoginForm';
import SetupProfileForm from './components/Auth/SetupProfileForm';
import './App.css';

function App() {
  const { user, loading, needsPasswordSetup, login, updateProfileAndStep } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fcfbf7] flex items-center justify-center font-serif text-[#c5a059] tracking-widest uppercase">
        Verifying Session...
      </div>
    );
  }

  // 1. 로그인은 됐으나 비밀번호/프로필 설정이 필요한 경우
  if (user && needsPasswordSetup) {
    return <SetupProfileForm onComplete={updateProfileAndStep} />;
  }

  // 2. 로그인 버튼을 눌렀거나, 로그인이 안 된 상태에서 로그인이 필요한 경우
  if (!user && showLogin) {
    return (
      <div className="relative">
        <button 
          onClick={() => setShowLogin(false)}
          className="absolute top-8 left-8 z-50 px-4 py-2 bg-white border border-gray-200 rounded-lg text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-800 transition-all shadow-sm cursor-pointer"
        >
          ← Back to Board
        </button>
        <LoginForm onLogin={async (email, password) => {
          await login(email, password);
          setShowLogin(false);
        }} />
      </div>
    );
  }

  // 3. 기본적으로 칸반 보드 렌더링 (비로그인 사용자 포함)
  return <KanbanBoard onShowLogin={() => setShowLogin(true)} />;
}

export default App;
