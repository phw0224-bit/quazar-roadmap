import { useContext } from 'react';
import { LayoutContext } from './layoutStateContext.js';

export function useLayoutState() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayoutState must be used within a LayoutProvider');
  }
  return context;
}
