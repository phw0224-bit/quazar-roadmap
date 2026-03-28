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
