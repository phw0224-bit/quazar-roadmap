/**
 * @fileoverview 인증 분기와 전역 오버레이를 관리하는 앱 진입점.
 *
 * 로그인/프로필 설정/보드 화면을 전환하고, 릴리즈 노트는 현재 릴리즈 ID와
 * localStorage에 저장된 마지막 확인 버전을 비교해 자동 노출한다.
 */

import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import KanbanBoard from './components/KanbanBoard';
import LoginForm from './components/Auth/LoginForm';
import SetupProfileForm from './components/Auth/SetupProfileForm';
import ReleaseNotesModal from './components/ReleaseNotesModal';
import {
  CURRENT_RELEASE_NOTE,
  RELEASE_NOTES_STORAGE_KEY,
} from './lib/releaseNotes';

function App() {
  const { user, loading, needsPasswordSetup, login, updateProfileAndStep } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  useEffect(() => {
    try {
      const lastSeenReleaseId = localStorage.getItem(RELEASE_NOTES_STORAGE_KEY);
      if (lastSeenReleaseId !== CURRENT_RELEASE_NOTE.id) {
        setShowReleaseNotes(true);
      }
    } catch (e) {
      // Ignore
    }
  }, []);

  const handleCloseReleaseNotes = () => {
    try {
      localStorage.setItem(RELEASE_NOTES_STORAGE_KEY, CURRENT_RELEASE_NOTE.id);
    } catch (e) {
      // Ignore
    }
    setShowReleaseNotes(false);
  };

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
    return (
      <>
        <SetupProfileForm onComplete={updateProfileAndStep} />
        {showReleaseNotes && (
          <ReleaseNotesModal
            release={CURRENT_RELEASE_NOTE}
            onClose={handleCloseReleaseNotes}
          />
        )}
      </>
    );
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
        {showReleaseNotes && (
          <ReleaseNotesModal
            release={CURRENT_RELEASE_NOTE}
            onClose={handleCloseReleaseNotes}
          />
        )}
      </div>
    );
  }

  // 3. 기본적으로 칸반 보드 렌더링 (비로그인 사용자 포함)
  return (
    <>
      <KanbanBoard
        onShowLogin={() => setShowLogin(true)}
        onShowReleaseNotes={() => setShowReleaseNotes(true)}
      />
      {showReleaseNotes && (
        <ReleaseNotesModal
          release={CURRENT_RELEASE_NOTE}
          onClose={handleCloseReleaseNotes}
        />
      )}
    </>
  );
}

export default App;
