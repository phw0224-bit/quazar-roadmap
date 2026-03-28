import { useState, useEffect } from 'react';
import { PanelLeft } from 'lucide-react';
import Sidebar from './Sidebar';

export default function AppLayout({
  sections,
  phases,
  activeView,
  activeItemId,
  onNavigate,
  onOpenItem,
  onAddChildPage,
  onShowPrompt,
  isReadOnly,
  children,
}) {
  const [isOpen, setIsOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sidebar-open') ?? 'false'); } catch { return false; }
  });
  const [hoverMode, setHoverMode] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sidebar-hover-mode') ?? 'false'); } catch { return false; }
  });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => { localStorage.setItem('sidebar-open', JSON.stringify(isOpen)); }, [isOpen]);
  useEffect(() => { localStorage.setItem('sidebar-hover-mode', JSON.stringify(hoverMode)); }, [hoverMode]);

  const handleHoverModeToggle = () => {
    setHoverMode(v => !v);
    setIsHovering(false);
  };

  const sidebarProps = {
    sections, phases, activeView, activeItemId,
    onNavigate, onOpenItem, onAddChildPage, onShowPrompt, isReadOnly,
    hoverMode,
    onHoverModeToggle: handleHoverModeToggle,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[color:var(--color-bg-base)]">

      {/*
        Left hover zone: always-visible slim bar (28px).
        In hover mode, this container also anchors the floating sidebar.
        onMouseLeave fires only when mouse leaves BOTH the bar AND the floating sidebar
        (because the floating sidebar is an absolute DOM child of this container).
      */}
      <div
        className="flex-shrink-0 relative"
        style={{ height: '100%' }}
        onMouseEnter={() => hoverMode && setIsHovering(true)}
        onMouseLeave={() => hoverMode && setIsHovering(false)}
      >
        {/* Slim toggle bar */}
        <button
          className="w-7 h-full flex items-center justify-center
                     bg-[color:var(--color-bg-elevated)] border-r border-[color:var(--color-border-subtle)]
                     hover:bg-[color:var(--color-bg-hover)] transition-colors
                     text-[color:var(--color-text-tertiary)] hover:text-[color:var(--color-text-secondary)]
                     cursor-pointer"
          onClick={() => !hoverMode && setIsOpen(v => !v)}
          title={hoverMode ? '호버 모드 활성 — 마우스를 올려 사이드바 열기' : isOpen ? '사이드바 닫기' : '사이드바 열기'}
        >
          <PanelLeft size={14} />
        </button>

        {/* Hover mode: floating sidebar (absolute child — keeps container's onMouseLeave from firing) */}
        {hoverMode && isHovering && (
          <div
            className="absolute left-7 top-0 w-56 z-30
                       border-r border-[color:var(--color-border-subtle)] shadow-2xl overflow-hidden"
            style={{ height: '100vh' }}
          >
            <Sidebar {...sidebarProps} />
          </div>
        )}
      </div>

      {/* Docked sidebar — click mode only, pushes main content */}
      {!hoverMode && isOpen && (
        <div className="w-56 flex-shrink-0 border-r border-[color:var(--color-border-subtle)] overflow-hidden">
          <Sidebar {...sidebarProps} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
