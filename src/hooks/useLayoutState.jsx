/**
 * @fileoverview 사이드바 열림/닫힘과 너비를 관리하는 전역 UI 상태 저장소.
 *
 * AppLayout과 KanbanBoard가 같은 레이아웃 상태를 공유할 수 있도록 Context로 노출한다.
 * `sidebar-open`, `sidebar-width`를 localStorage에 저장해 새로고침 후에도 유지한다.
 *
 * @returns {{ isOpen, setIsOpen, toggleSidebar, sidebarWidth, setSidebarWidth, collapsedWidth }}
 */
import { createContext, useContext, useState, useEffect } from 'react';
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  clampSidebarWidth,
} from './layoutStateUtils.js';

const LayoutContext = createContext(null);

export function LayoutProvider({ children }) {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sidebar-open') ?? 'true');
    } catch {
      return true;
    }
  });

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const raw = Number(localStorage.getItem('sidebar-width'));
      return clampSidebarWidth(raw);
    } catch {
      return SIDEBAR_DEFAULT_WIDTH;
    }
  });

  useEffect(() => {
    localStorage.setItem('sidebar-open', JSON.stringify(isOpen));
  }, [isOpen]);

  useEffect(() => {
    localStorage.setItem('sidebar-width', String(sidebarWidth));
  }, [sidebarWidth]);

  const toggleSidebar = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <LayoutContext.Provider
      value={{
        isOpen,
        setIsOpen,
        toggleSidebar,
        sidebarWidth,
        setSidebarWidth: (nextWidth) => setSidebarWidth(clampSidebarWidth(nextWidth)),
        collapsedWidth: SIDEBAR_COLLAPSED_WIDTH,
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
