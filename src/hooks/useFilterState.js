/**
 * @fileoverview 필터/정렬/그룹화 상태 관리. DB 쿼리를 변경하지 않고 렌더링 레이어에서만 적용.
 *
 * 핵심 함수:
 * - applyFilterSort(items, filters, sort): 필터+정렬 적용된 items 배열 반환
 * - groupItems(items, groupBy): group 필드 기준으로 Map<key, items[]> 반환
 *
 * 필터 구조: [{ field: 'status'|'teams'|'tags'|'assignees', value: string }]
 * 여러 필터는 AND 조건으로 결합.
 */
import { useState, useCallback } from 'react';

const DEFAULT_STATE = {
  filters: [],   // [{ field: 'status'|'teams'|'tags'|'assignees', value: string }]
  sort: null,    // null | { field: 'title'|'status'|'created_at', dir: 'asc'|'desc' }
  group: null,   // null | 'status' | 'assignees' | 'tags'
};

export function useFilterState(initialState = {}) {
  const [state, setState] = useState({ ...DEFAULT_STATE, ...initialState });

  const addFilter = useCallback((field, value) => {
    setState(prev => {
      const exists = prev.filters.some(f => f.field === field && f.value === value);
      if (exists) return prev;
      return { ...prev, filters: [...prev.filters, { field, value }] };
    });
  }, []);

  const removeFilter = useCallback((field, value) => {
    setState(prev => ({
      ...prev,
      filters: prev.filters.filter(f => !(f.field === field && f.value === value)),
    }));
  }, []);

  const setSort = useCallback((field, dir = 'asc') => {
    if (field === null) {
      setState(prev => ({ ...prev, sort: null }));
      return;
    }
    setState(prev => ({
      ...prev,
      sort: prev.sort?.field === field && prev.sort?.dir === dir ? null : { field, dir },
    }));
  }, []);

  const setGroup = useCallback((group) => {
    setState(prev => ({ ...prev, group: prev.group === group ? null : group }));
  }, []);

  const reset = useCallback(() => setState(DEFAULT_STATE), []);

  const hasActiveFilters = state.filters.length > 0 || state.sort !== null;

  return {
    filters: state.filters,
    sort: state.sort,
    group: state.group,
    hasActiveFilters,
    addFilter,
    removeFilter,
    clearFilters: reset,
    setSort,
    setGroup,
    reset,
  };
}

// items 배열에 필터/정렬 적용
export function applyFilterSort(items, filters, sort) {
  let result = [...items];

  // 필터 (AND 조합)
  if (filters && filters.length > 0) {
    result = result.filter(item =>
      filters.every(({ field, value }) => {
        switch (field) {
          case 'status':
            return item.status === value;
          case 'teams':
            return (item.teams || []).includes(value);
          case 'tags':
            return (item.tags || []).includes(value);
          case 'assignees': {
            const assignees = Array.isArray(item.assignees)
              ? item.assignees
              : (item.assignees || '').split(',').map(s => s.trim()).filter(Boolean);
            return assignees.some(a => a.toLowerCase().includes(value.toLowerCase()));
          }
          default:
            return true;
        }
      })
    );
  }

  // 정렬
  if (sort) {
    const STATUS_ORDER = { 'in-progress': 0, 'none': 1, 'done': 2 };
    result.sort((a, b) => {
      let cmp = 0;
      if (sort.field === 'title') {
        cmp = (a.title || '').localeCompare(b.title || '', 'ko');
      } else if (sort.field === 'status') {
        cmp = (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1);
      } else if (sort.field === 'created_at') {
        cmp = new Date(a.created_at || 0) - new Date(b.created_at || 0);
      } else {
        cmp = (a.order_index ?? 0) - (b.order_index ?? 0);
      }
      return sort.dir === 'desc' ? -cmp : cmp;
    });
  }

  return result;
}

// 그룹화: { groupKey: string, items: Item[] }[] 반환
export function groupItems(items, groupBy) {
  if (!groupBy) return null;

  const groups = new Map();

  items.forEach(item => {
    let keys = [];
    if (groupBy === 'status') {
      keys = [item.status || 'none'];
    } else if (groupBy === 'assignees') {
      const assignees = Array.isArray(item.assignees)
        ? item.assignees
        : (item.assignees || '').split(',').map(s => s.trim()).filter(Boolean);
      keys = assignees.length > 0 ? [assignees[0]] : ['미배정'];
    } else if (groupBy === 'tags') {
      keys = (item.tags || []).length > 0 ? [(item.tags || [])[0]] : ['태그 없음'];
    }

    keys.forEach(key => {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
  });

  return Array.from(groups.entries()).map(([key, items]) => ({ groupKey: key, items }));
}
