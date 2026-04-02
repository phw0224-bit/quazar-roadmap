/**
 * @fileoverview 사이드바 열림/닫힘과 hover 모드의 전역 UI 상태 저장소.
 *
 * AppLayout과 KanbanBoard가 같은 레이아웃 상태를 공유할 수 있도록 Context로 노출한다.
 * `sidebar-open`, `sidebar-hover-mode`를 localStorage에 저장해 새로고침 후에도 유지한다.
 *
 * @returns {{ isOpen, setIsOpen, toggleSidebar, hoverMode, setHoverMode, toggleHoverMode }}
 */
import { createContext, useContext, useState, useEffect } from 'react';

const LayoutContext = createContext(null);

export function LayoutProvider({ children }) {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sidebar-open') ?? 'false');
    } catch {
      return false;
    }
  });

  const [hoverMode, setHoverMode] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sidebar-hover-mode') ?? 'false');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem('sidebar-open', JSON.stringify(isOpen));
  }, [isOpen]);

  useEffect(() => {
    localStorage.setItem('sidebar-hover-mode', JSON.stringify(hoverMode));
  }, [hoverMode]);

  const toggleSidebar = () => {
    setIsOpen((prev) => !prev);
  };

  const toggleHoverMode = () => {
    setHoverMode((prev) => !prev);
  };

  return (
    <LayoutContext.Provider
      value={{
        isOpen,
        setIsOpen,
        toggleSidebar,
        hoverMode,
        setHoverMode,
        toggleHoverMode,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayoutState() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayoutState must be used within a LayoutProvider');
  }
  return context;
}
