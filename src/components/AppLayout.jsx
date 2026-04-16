import { useEffect, useState } from 'react';
import { PanelLeftOpen, Search, LayoutGrid, Clock, StickyNote, Users, BellDot, Sun, Moon } from 'lucide-react';
import { useLayoutState } from '../hooks/useLayoutState.js';
import { SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from '../hooks/layoutStateUtils.js';
import ProfileAvatar from './ProfileAvatar';
import Sidebar from './Sidebar';

export default function AppLayout({
  sections,
  projects,
  activeView,
  activeItemId,
  onNavigate,
  onOpenItem,
  onAddChildPage,
  onShowPrompt,
  onShowConfirm,
  onShowReleaseNotes,
  isReadOnly,
  user,
  theme,
  mounted,
  onToggleTheme,
  onLogout,
  children,
  onSetBoardType,
  generalDocs,
  onShowToast,
  onMoveSidebarItem,
  onMoveSidebarProject,
  onOpenProfileSettings,
  profileCustomization,
  onOpenSearch,
}) {
  const {
    isOpen,
    toggleSidebar,
    sidebarWidth,
    setSidebarWidth,
    collapsedWidth,
  } = useLayoutState();
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleSidebar]);

  useEffect(() => {
    if (!isResizing || !isOpen) return undefined;

    const onMouseMove = (event) => {
      setSidebarWidth(event.clientX);
    };

    const onMouseUp = () => setIsResizing(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing, isOpen, setSidebarWidth]);

  const sidebarProps = {
    sections, projects, activeView, activeItemId,
    onNavigate, onOpenItem, onAddChildPage, onShowPrompt, onShowConfirm, onShowReleaseNotes, isReadOnly,
    user, theme, mounted, onToggleTheme, onLogout,
    onToggleSidebar: toggleSidebar,
    onSetBoardType,
    generalDocs,
    onShowToast,
    onMoveSidebarItem,
    onMoveSidebarProject,
    onOpenProfileSettings,
    profileCustomization,
    onOpenSearch,
  };

  const collapsedNavItems = [
    { view: 'board', label: '팀 보드', icon: LayoutGrid },
    { view: 'timeline', label: '타임라인', icon: Clock },
    { view: 'personal', label: '개인 메모', icon: StickyNote, requiresUser: true },
    { view: 'people', label: '피플 보드', icon: Users },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[color:var(--color-bg-base)] relative transition-colors duration-200">
      {isOpen ? (
        <div
          className="flex-shrink-0 border-r border-[color:var(--color-border-subtle)] overflow-hidden relative z-10 bg-[color:var(--color-bg-elevated)]"
          style={{ width: `${sidebarWidth}px`, minWidth: `${SIDEBAR_MIN_WIDTH}px`, maxWidth: `${SIDEBAR_MAX_WIDTH}px` }}
        >
          <Sidebar {...sidebarProps} />
          <div
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[color:var(--color-border-strong)]/40 transition-colors"
            onMouseDown={(event) => {
              event.preventDefault();
              setIsResizing(true);
            }}
          />
        </div>
      ) : (
        <div
          className="flex-shrink-0 border-r border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-elevated)] flex flex-col items-center py-2"
          style={{ width: `${collapsedWidth}px` }}
        >
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-bg-hover)] transition-colors cursor-pointer"
              onClick={toggleSidebar}
              title="사이드바 열기 (Ctrl/Cmd+B)"
            >
              <PanelLeftOpen size={18} />
            </button>
            <button
              type="button"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-bg-hover)] transition-colors cursor-pointer"
              onClick={onOpenSearch}
              title="검색"
            >
              <Search size={16} />
            </button>
          </div>

          <div className="w-7 h-px bg-[color:var(--color-border-subtle)] my-2" />

          <div className="flex flex-col items-center gap-1">
            {collapsedNavItems
              .filter((item) => !item.requiresUser || Boolean(user))
              .map((item) => {
                const isActive = activeView === item.view;
                return (
                  <button
                    key={item.view}
                    type="button"
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[color:var(--color-bg-hover)] text-[color:var(--color-text-primary)]'
                        : 'text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-bg-hover)]'
                    }`}
                    onClick={() => onNavigate?.(item.view)}
                    title={item.label}
                  >
                    <item.icon size={16} />
                  </button>
                );
              })}
          </div>

          <div className="w-7 h-px bg-[color:var(--color-border-subtle)] my-2" />

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-bg-hover)] transition-colors cursor-pointer"
              onClick={onShowReleaseNotes}
              title="업데이트 내역"
            >
              <BellDot size={16} />
            </button>
            {mounted && (
              <button
                type="button"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-bg-hover)] transition-colors cursor-pointer"
                onClick={onToggleTheme}
                title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            )}
          </div>

          <div className="mt-auto pt-2">
            {user ? (
              <button
                type="button"
                className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[color:var(--color-bg-hover)] transition-colors cursor-pointer"
                onClick={onOpenProfileSettings}
                title={user?.user_metadata?.name || user?.email?.split('@')[0] || '프로필'}
              >
                <ProfileAvatar
                  name={user?.user_metadata?.name || user?.email || 'U'}
                  customization={profileCustomization}
                  size="sm"
                />
              </button>
            ) : (
              <button
                type="button"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-bg-hover)] transition-colors cursor-pointer"
                onClick={toggleSidebar}
                title="메뉴 열기"
              >
                <span className="text-xs font-semibold">Q</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </div>
  );
}
