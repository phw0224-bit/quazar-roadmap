/**
 * @fileoverview URL 파라미터 ↔ 앱 상태 양방향 동기화. React Router 없이 URL 기반 라우팅 구현.
 *
 * 지원 파라미터:
 * - view: 'board'|'timeline'|'people'|'personal'|'roadmap'|'repositories' (기본값: 'board')
 * - item: 선택된 아이템 UUID (ItemDetailPanel 열림)
 * - repo: 선택된 레포 full name
 * - fullscreen: '1' (ItemDetailPanel 전체화면)
 * - scrollTo: 'section:{id}' 또는 'project:{id}' (스크롤 대상)
 * - filter: 'status:done,teams:AI팀' (쉼표 구분 AND 조건)
 * - sort: 'title:asc' 또는 'created_at:desc'
 * - group: 'status'|'assignees'|'tags'
 *
 * @returns {[state, setUrlState, replaceUrlState]}
 * setUrlState → pushState (뒤로가기 가능)
 * replaceUrlState → replaceState (히스토리 없음)
 */
import { useState, useEffect, useCallback, useRef } from 'react';

// filter 파라미터 형식: "status:done,teams:AI팀"
// sort 파라미터 형식: "title:asc"
// group 파라미터 형식: "status"

function parseFilters(str) {
  if (!str) return [];
  return str.split(',').map(s => {
    const idx = s.indexOf(':');
    if (idx === -1) return null;
    return { field: s.slice(0, idx).trim(), value: s.slice(idx + 1).trim() };
  }).filter(Boolean).filter(f => f.field && f.value);
}

function serializeFilters(filters) {
  if (!filters || filters.length === 0) return null;
  return filters.map(f => `${f.field}:${f.value}`).join(',');
}

function parseSort(str) {
  if (!str) return null;
  const idx = str.lastIndexOf(':');
  if (idx === -1) return null;
  const field = str.slice(0, idx);
  const dir = str.slice(idx + 1);
  return field ? { field, dir: dir === 'desc' ? 'desc' : 'asc' } : null;
}

const VALID_VIEWS = ['board', 'timeline', 'people', 'personal', 'roadmap', 'repositories'];

function parseUrlState() {
  const params = new URLSearchParams(window.location.search);
  const rawView = params.get('view') || 'board';
  return {
    view: VALID_VIEWS.includes(rawView) ? rawView : 'board',
    itemId: params.get('item') || null,
    repoFullName: params.get('repo') || null,
    fullscreen: params.get('fullscreen') === '1',
    scrollTo: params.get('scrollTo') || null,
    filters: parseFilters(params.get('filter')),
    sort: parseSort(params.get('sort')),
    group: params.get('group') || null,
  };
}

function buildSearch(state) {
  const params = new URLSearchParams();
  if (state.view && state.view !== 'board') params.set('view', state.view);
  if (state.itemId) params.set('item', state.itemId);
  if (state.repoFullName) params.set('repo', state.repoFullName);
  if (state.fullscreen) params.set('fullscreen', '1');
  if (state.scrollTo) params.set('scrollTo', state.scrollTo);
  const filterStr = serializeFilters(state.filters);
  if (filterStr) params.set('filter', filterStr);
  if (state.sort) params.set('sort', `${state.sort.field}:${state.sort.dir}`);
  if (state.group) params.set('group', state.group);
  const search = params.toString();
  return search ? `?${search}` : window.location.pathname;
}

export function useUrlState() {
  const [state, setState] = useState(parseUrlState);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setUrlState = useCallback((partial) => {
    const next = { ...stateRef.current, ...partial };
    const nextSearch = buildSearch(next);
    const currentSearch = window.location.search || window.location.pathname;

    if (nextSearch !== currentSearch) {
      window.history.pushState({}, '', nextSearch);
    }

    stateRef.current = next;
    setState(next);
  }, []);

  const replaceUrlState = useCallback((partial) => {
    const next = { ...stateRef.current, ...partial };
    const nextSearch = buildSearch(next);
    const currentSearch = window.location.search || window.location.pathname;

    if (nextSearch !== currentSearch) {
      window.history.replaceState({}, '', nextSearch);
    }

    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    const handlePopState = () => setState(parseUrlState());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return [state, setUrlState, replaceUrlState];
}
