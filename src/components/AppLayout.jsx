import { useState } from 'react';
import { useLayoutState } from '../hooks/useLayoutState';
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
  onShowReleaseNotes,
  isReadOnly,
  user,
  theme,
  mounted,
  onToggleTheme,
  onLogout,
  children,
}) {
  const { isOpen, hoverMode, toggleHoverMode } = useLayoutState();
  const [isHovering, setIsHovering] = useState(false);
  
  const handleHoverModeToggle = () => {
    toggleHoverMode();
    setIsHovering(false);
  };

  const sidebarProps = {
    sections, phases, activeView, activeItemId,
    onNavigate, onOpenItem, onAddChildPage, onShowPrompt, onShowReleaseNotes, isReadOnly,
    user, theme, mounted, onToggleTheme, onLogout,
    hoverMode,
    onHoverModeToggle: handleHoverModeToggle,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[color:var(--color-bg-base)] relative transition-colors duration-200">
      
      {/* Hover trigger zone & floating sidebar */}
      {hoverMode && (
        <div
          className={`absolute left-0 top-0 h-full z-40 transition-all ${isHovering ? 'w-56' : 'w-4'}`}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {isHovering && (
            <div className="w-full h-full border-r border-[color:var(--color-border-subtle)] shadow-2xl overflow-hidden bg-[color:var(--color-bg-base)]">
              <Sidebar {...sidebarProps} />
            </div>
          )}
        </div>
      )}

      {/* Docked sidebar — click mode only, pushes main content */}
      {!hoverMode && isOpen && (
        <div className="w-56 flex-shrink-0 border-r border-[color:var(--color-border-subtle)] overflow-hidden relative z-10">
          <Sidebar {...sidebarProps} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden relative z-0">
        {children}
      </div>
    </div>
  );
}
