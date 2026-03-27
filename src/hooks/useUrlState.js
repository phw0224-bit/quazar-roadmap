import { useState, useEffect, useCallback } from 'react';

function parseUrlState() {
  const params = new URLSearchParams(window.location.search);
  return {
    view: params.get('view') || 'board',
    itemId: params.get('item') || null,
    fullscreen: params.get('fullscreen') === '1',
  };
}

function buildSearch(state) {
  const params = new URLSearchParams();
  if (state.view && state.view !== 'board') params.set('view', state.view);
  if (state.itemId) params.set('item', state.itemId);
  if (state.fullscreen) params.set('fullscreen', '1');
  const search = params.toString();
  return search ? `?${search}` : window.location.pathname;
}

export function useUrlState() {
  const [state, setState] = useState(parseUrlState);

  const setUrlState = useCallback((partial) => {
    setState(prev => {
      const next = { ...prev, ...partial };
      window.history.pushState({}, '', buildSearch(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const handlePopState = () => setState(parseUrlState());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return [state, setUrlState];
}
