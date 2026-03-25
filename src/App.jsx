import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import KanbanBoard from './components/KanbanBoard';
import LoginForm from './components/Auth/LoginForm';
import SetupProfileForm from './components/Auth/SetupProfileForm';

function App() {
  const { user, loading, needsPasswordSetup, login, updateProfileAndStep } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-bg-base flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 border-4 border-gray-100 dark:border-border-subtle border-t-gray-900 dark:border-t-white rounded-full animate-spin"></div>
          <span className="text-label text-gray-400 dark:text-text-secondary tracking-[0.2em]">세션 확인 중...</span>
        </div>
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
          className="absolute top-8 left-8 z-50 px-5 py-2.5 bg-white dark:bg-bg-elevated border border-gray-200 dark:border-border-subtle rounded-xl text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-text-secondary hover:text-gray-900 dark:hover:text-text-primary hover:border-gray-400 dark:hover:border-border-strong transition-all shadow-sm cursor-pointer"
        >
          ← 보드로 돌아가기
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
