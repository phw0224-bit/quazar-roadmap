/**
 * @fileoverview 인증 분기와 전역 오버레이를 관리하는 앱 진입점.
 *
 * 로그인/프로필 설정/보드 화면을 전환하고, 릴리즈 노트는 현재 릴리즈 ID와
 * localStorage에 저장된 마지막 확인 버전을 비교해 자동 노출한다.
 */

import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import KanbanBoard from './components/KanbanBoard';
import LoginForm from './components/Auth/LoginForm';
import SetupProfileForm from './components/Auth/SetupProfileForm';
import ReleaseNotesModal from './components/ReleaseNotesModal';
import {
  RELEASE_NOTES,
  RELEASE_NOTES_STORAGE_KEY,
} from './lib/releaseNotes';

function App() {
  const { user, loading, needsPasswordSetup, login, updateProfileAndStep } = useAuth();
  const currentReleaseNote = RELEASE_NOTES?.[0] || null;
  const [showReleaseNotes, setShowReleaseNotes] = useState(() => {
    if (!currentReleaseNote) return false;
    try {
      const lastSeenReleaseId = localStorage.getItem(RELEASE_NOTES_STORAGE_KEY);
      return lastSeenReleaseId !== currentReleaseNote.id;
    } catch {
      return false;
    }
  });

  const handleCloseReleaseNotes = () => {
    if (!currentReleaseNote) {
      setShowReleaseNotes(false);
      return;
    }
    try {
      localStorage.setItem(RELEASE_NOTES_STORAGE_KEY, currentReleaseNote.id);
    } catch {
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
            releases={RELEASE_NOTES}
            initialId={currentReleaseNote?.id}
            onClose={handleCloseReleaseNotes}
          />
        )}
      </>
    );
  }

  // 2. 로그인 필수: 비로그인 사용자는 로그인 화면만 접근 가능
  if (!user) {
    return (
      <div className="relative">
        <LoginForm onLogin={async (email, password) => {
          await login(email, password);
        }} />
        {showReleaseNotes && (
          <ReleaseNotesModal
            releases={RELEASE_NOTES}
            initialId={currentReleaseNote?.id}
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
        onShowLogin={() => {}}
        onShowReleaseNotes={() => setShowReleaseNotes(true)}
      />
      {showReleaseNotes && (
        <ReleaseNotesModal
          release={currentReleaseNote}
          onClose={handleCloseReleaseNotes}
        />
      )}
    </>
  );
}

export default App;
