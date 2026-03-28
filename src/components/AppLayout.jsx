import { useState, useEffect } from 'react';
import { PanelLeft } from 'lucide-react';
import Sidebar from './Sidebar';

export default function AppLayout({
  // Sidebar에 전달할 데이터
  sections,
  phases,
  activeView,
  activeItemId,
  onNavigate,
  onOpenItem,
  onAddChildPage,
  onShowPrompt,
  isReadOnly,
  // 레이아웃
  children,
}) {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar-open');
      return saved ? JSON.parse(saved) : false; // 기본값: 닫힘
    } catch { return false; }
  });

  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar-mode');
      return saved || 'docked'; // 기본값: docked
    } catch { return 'docked'; }
  });

  // 변경 시 localStorage 동기화
  useEffect(() => {
    localStorage.setItem('sidebar-open', JSON.stringify(isOpen));
  }, [isOpen]);

  useEffect(() => {
    localStorage.setItem('sidebar-mode', mode);
  }, [mode]);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg-base)]">

      {/* 항상 보이는 슬림 토글 바 (28px) */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-7 flex-shrink-0 flex items-center justify-center
                   bg-[var(--color-bg-elevated)] border-r border-[var(--color-border-subtle)]
                   hover:bg-[var(--color-bg-hover)] transition-colors
                   text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
        title={isOpen ? '사이드바 닫기' : '사이드바 열기'}
      >
        <PanelLeft size={14} />
      </button>

      {/* Docked 모드: flex에서 사이드바가 공간 차지 → 보드 밀기 */}
      {mode === 'docked' && isOpen && (
        <div className="w-56 flex-shrink-0 border-r border-[var(--color-border-subtle)] overflow-hidden">
          <Sidebar
            sections={sections}
            phases={phases}
            activeView={activeView}
            activeItemId={activeItemId}
            onNavigate={onNavigate}
            onOpenItem={onOpenItem}
            onAddChildPage={onAddChildPage}
            onShowPrompt={onShowPrompt}
            isReadOnly={isReadOnly}
            mode={mode}
            onModeToggle={() => setMode(m => m === 'docked' ? 'floating' : 'docked')}
          />
        </div>
      )}

      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 overflow-hidden relative">

        {/* Floating 모드: 보드 위에 absolute로 떠서 렌더링 */}
        {mode === 'floating' && isOpen && (
          <div className="absolute left-0 top-0 w-56 h-full z-30
                          border-r border-[var(--color-border-subtle)]
                          shadow-2xl">
            <Sidebar
              sections={sections}
              phases={phases}
              activeView={activeView}
              activeItemId={activeItemId}
              onNavigate={onNavigate}
              onOpenItem={onOpenItem}
              onAddChildPage={onAddChildPage}
              onShowPrompt={onShowPrompt}
              isReadOnly={isReadOnly}
              mode={mode}
              onModeToggle={() => setMode(m => m === 'docked' ? 'floating' : 'docked')}
            />
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
