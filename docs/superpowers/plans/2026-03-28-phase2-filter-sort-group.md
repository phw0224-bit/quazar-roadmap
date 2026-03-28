# Phase 2 — 필터 / 정렬 / 그룹화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 칸반 데이터를 직접 변경하지 않고 렌더링 레이어에서 필터·정렬·그룹화를 적용한다. 기존 팀/상태 하이라이트 필터는 새 시스템으로 통합한다.

**Architecture:** `useFilterState` 훅이 filters/sort/group 상태를 관리하고 URL에 동기화. KanbanBoard에서 `filteredAndSortedPhases` 파생 변수를 만들어 렌더링에 사용. FilterBar는 순수 UI 컴포넌트. 기존 `selectedTeam`/`selectedStatus` state는 제거하고 새 시스템으로 교체.

**Tech Stack:** React 19, useReducer, URL SearchParams, Tailwind v4, 기존 constants.js (TEAMS, GLOBAL_TAGS, STATUS_MAP)

---

## 파일 맵

| 액션 | 경로 | 역할 |
|------|------|------|
| 생성 | `src/hooks/useFilterState.js` | 필터/정렬/그룹 상태 + URL 동기화 |
| 생성 | `src/components/FilterBar.jsx` | 필터바 UI (칩 + 드롭다운) |
| 수정 | `src/hooks/useUrlState.js` | filter/sort/group 파라미터 추가 |
| 수정 | `src/components/KanbanBoard.jsx` | FilterBar 통합, filteredAndSortedPhases 파생, 기존 필터 제거 |
| 수정 | `src/components/ProjectColumn.jsx` | selectedTeam/selectedTag/selectedStatus prop 제거, 그룹화 지원 |
| 수정 | `src/components/KanbanCard.jsx` | highlight props 제거 또는 단순화 |

---

## Task 1: useFilterState 훅 생성

**Files:**
- Create: `src/hooks/useFilterState.js`

- [ ] **Step 1: useFilterState.js 생성**

```javascript
// src/hooks/useFilterState.js
import { useState, useCallback, useMemo } from 'react';

// 필터 구조: { field: 'status'|'teams'|'tags'|'assignees', value: string }
// 여러 필터는 AND 조합
const DEFAULT_STATE = {
  filters: [],           // [{ field, value }]
  sort: null,            // null | { field: 'title'|'status'|'created_at', dir: 'asc'|'desc' }
  group: null,           // null | 'status' | 'assignees' | 'tags'
};

export function useFilterState(initialState = {}) {
  const [state, setState] = useState({ ...DEFAULT_STATE, ...initialState });

  const addFilter = useCallback((field, value) => {
    setState(prev => {
      // 같은 field+value 중복 방지
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

  const clearFilters = useCallback(() => {
    setState(prev => ({ ...prev, filters: [] }));
  }, []);

  const setSort = useCallback((field, dir = 'asc') => {
    setState(prev => ({
      ...prev,
      sort: prev.sort?.field === field && prev.sort?.dir === dir ? null : { field, dir },
    }));
  }, []);

  const setGroup = useCallback((group) => {
    setState(prev => ({ ...prev, group: prev.group === group ? null : group }));
  }, []);

  const reset = useCallback(() => setState(DEFAULT_STATE), []);

  const hasActiveFilters = state.filters.length > 0 || state.sort !== null || state.group !== null;

  return {
    filters: state.filters,
    sort: state.sort,
    group: state.group,
    hasActiveFilters,
    addFilter,
    removeFilter,
    clearFilters,
    setSort,
    setGroup,
    reset,
  };
}

// items 배열에 필터/정렬/그룹 적용 후 반환
export function applyFilterSortGroup(items, filters, sort, group) {
  let result = [...items];

  // 필터 (AND 조합)
  if (filters.length > 0) {
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

  // 그룹화: { groupKey: string, items: Item[] }[] 형태로 반환 (group이 있을 때만)
  if (group) {
    return groupItems(result, group);
  }

  return result;
}

function groupItems(items, groupBy) {
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
      keys = (item.tags || []).length > 0 ? [item.tags[0]] : ['태그 없음'];
    }

    keys.forEach(key => {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
  });

  return Array.from(groups.entries()).map(([key, items]) => ({ groupKey: key, items }));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useFilterState.js
git commit -m "feat(filter): add useFilterState hook with applyFilterSortGroup"
```

---

## Task 2: useUrlState 확장

**Files:**
- Modify: `src/hooks/useUrlState.js`

- [ ] **Step 1: useUrlState.js 수정**

`src/hooks/useUrlState.js`를 아래 내용으로 교체:

```javascript
import { useState, useEffect, useCallback } from 'react';

// filter 파라미터 형식: "status:done,teams:AI팀,tags:AI핵심"
// sort 파라미터 형식: "title:asc"
// group 파라미터 형식: "status"

function parseFilters(str) {
  if (!str) return [];
  return str.split(',').map(s => {
    const [field, ...rest] = s.split(':');
    return { field: field.trim(), value: rest.join(':').trim() };
  }).filter(f => f.field && f.value);
}

function serializeFilters(filters) {
  if (!filters || filters.length === 0) return null;
  return filters.map(f => `${f.field}:${f.value}`).join(',');
}

function parseSort(str) {
  if (!str) return null;
  const [field, dir] = str.split(':');
  return field ? { field, dir: dir === 'desc' ? 'desc' : 'asc' } : null;
}

function parseUrlState() {
  const params = new URLSearchParams(window.location.search);
  return {
    view: params.get('view') || 'board',
    itemId: params.get('item') || null,
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

  const setUrlState = useCallback((partial) => {
    setState(prev => {
      const next = { ...prev, ...partial };
      window.history.pushState({}, '', buildSearch(next));
      return next;
    });
  }, []);

  const replaceUrlState = useCallback((partial) => {
    setState(prev => {
      const next = { ...prev, ...partial };
      window.history.replaceState({}, '', buildSearch(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const handlePopState = () => setState(parseUrlState());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return [state, setUrlState, replaceUrlState];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useUrlState.js
git commit -m "feat(filter): extend useUrlState with filter/sort/group params"
```

---

## Task 3: FilterBar 컴포넌트 생성

**Files:**
- Create: `src/components/FilterBar.jsx`

- [ ] **Step 1: FilterBar.jsx 생성**

```jsx
// src/components/FilterBar.jsx
import { useState, useRef, useEffect } from 'react';
import { Filter, ChevronDown, X, ArrowUpDown, Group } from 'lucide-react';
import { TEAMS, GLOBAL_TAGS, STATUS_MAP } from '../lib/constants';

const FILTER_FIELDS = [
  { key: 'status',    label: '상태',    options: Object.entries(STATUS_MAP).map(([v, s]) => ({ value: v, label: s.label })) },
  { key: 'teams',     label: '팀',      options: TEAMS.map(t => ({ value: t.name, label: t.name })) },
  { key: 'tags',      label: '태그',    options: GLOBAL_TAGS.map(t => ({ value: t.name, label: t.name })) },
  { key: 'assignees', label: '담당자',  options: null }, // 자유 입력
];

const SORT_OPTIONS = [
  { field: 'order_index', label: '기본 순서' },
  { field: 'title',       label: '이름 순' },
  { field: 'status',      label: '상태 순' },
  { field: 'created_at',  label: '생성일 순' },
];

const GROUP_OPTIONS = [
  { value: null,          label: '그룹 없음' },
  { value: 'status',      label: '상태별' },
  { value: 'assignees',   label: '담당자별' },
  { value: 'tags',        label: '태그별' },
];

function Dropdown({ trigger, children, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(o => !o)}>{trigger}</div>
      {open && (
        <div
          className={`absolute top-full mt-1 z-50 bg-white dark:bg-bg-elevated border border-gray-200 dark:border-border-subtle rounded-xl shadow-xl min-w-[160px] py-1 ${align === 'right' ? 'right-0' : 'left-0'}`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({ onClick, children, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-sm transition-colors ${active ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-text-secondary hover:bg-gray-50 dark:hover:bg-bg-hover'}`}
    >
      {children}
    </button>
  );
}

export default function FilterBar({
  filters, sort, group, hasActiveFilters,
  onAddFilter, onRemoveFilter, onClearFilters, onSetSort, onSetGroup,
}) {
  const [addingField, setAddingField] = useState(null);
  const [assigneeInput, setAssigneeInput] = useState('');

  const handleAddFilter = (field, value) => {
    onAddFilter(field, value);
    setAddingField(null);
    setAssigneeInput('');
  };

  return (
    <div className="flex items-center gap-2 flex-wrap px-10 py-2.5 border-b border-gray-100 dark:border-border-subtle bg-white dark:bg-bg-base min-h-[48px]">

      {/* 필터 추가 버튼 */}
      <Dropdown
        trigger={
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-bg-hover rounded-lg transition-colors border border-dashed border-gray-300 dark:border-border-strong cursor-pointer"
          >
            <Filter size={13} />
            <span>필터 추가</span>
          </button>
        }
      >
        {FILTER_FIELDS.map(field => (
          <DropdownItem
            key={field.key}
            onClick={(e) => { e.stopPropagation(); setAddingField(addingField === field.key ? null : field.key); }}
          >
            {field.label}
          </DropdownItem>
        ))}
      </Dropdown>

      {/* 선택한 필드의 값 선택 팝업 */}
      {addingField && (() => {
        const fieldDef = FILTER_FIELDS.find(f => f.key === addingField);
        return (
          <div className="relative">
            <div className="absolute left-0 top-0 z-50 bg-white dark:bg-bg-elevated border border-gray-200 dark:border-border-subtle rounded-xl shadow-xl min-w-[200px] p-2">
              <div className="text-xs font-semibold text-gray-400 dark:text-text-tertiary px-2 pb-1.5">{fieldDef.label} 선택</div>
              {fieldDef.options ? (
                fieldDef.options.map(opt => (
                  <DropdownItem
                    key={opt.value}
                    onClick={() => handleAddFilter(addingField, opt.value)}
                    active={filters.some(f => f.field === addingField && f.value === opt.value)}
                  >
                    {opt.label}
                  </DropdownItem>
                ))
              ) : (
                <div className="px-2 pb-1">
                  <input
                    autoFocus
                    type="text"
                    value={assigneeInput}
                    onChange={e => setAssigneeInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && assigneeInput.trim()) {
                        handleAddFilter(addingField, assigneeInput.trim());
                      }
                      if (e.key === 'Escape') setAddingField(null);
                    }}
                    placeholder="담당자 이름 입력 후 Enter"
                    className="w-full text-sm border border-gray-200 dark:border-border-subtle rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400 bg-white dark:bg-bg-base text-gray-900 dark:text-text-primary placeholder-gray-400"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => setAddingField(null)}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-400 dark:text-text-tertiary hover:text-gray-600 dark:hover:text-text-secondary transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        );
      })()}

      {/* 활성 필터 칩 */}
      {filters.map((filter, i) => {
        const fieldDef = FILTER_FIELDS.find(f => f.key === filter.field);
        const optLabel = fieldDef?.options?.find(o => o.value === filter.value)?.label ?? filter.value;
        return (
          <div
            key={i}
            className="flex items-center gap-1.5 px-2.5 py-1 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800"
          >
            <span className="text-blue-400 dark:text-blue-500 text-xs font-medium">{fieldDef?.label}</span>
            <span className="font-medium">{optLabel}</span>
            <button
              type="button"
              onClick={() => onRemoveFilter(filter.field, filter.value)}
              className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-200 transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}

      {/* 정렬 드롭다운 */}
      <Dropdown
        trigger={
          <button
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors border cursor-pointer ${sort ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' : 'text-gray-500 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-bg-hover border-gray-200 dark:border-border-subtle'}`}
          >
            <ArrowUpDown size={13} />
            <span>{sort ? `${SORT_OPTIONS.find(s => s.field === sort.field)?.label} ${sort.dir === 'asc' ? '↑' : '↓'}` : '정렬'}</span>
          </button>
        }
        align="left"
      >
        {SORT_OPTIONS.map(opt => (
          <div key={opt.field}>
            <DropdownItem onClick={() => onSetSort(opt.field, 'asc')} active={sort?.field === opt.field && sort?.dir === 'asc'}>
              {opt.label} ↑
            </DropdownItem>
            {opt.field !== 'order_index' && (
              <DropdownItem onClick={() => onSetSort(opt.field, 'desc')} active={sort?.field === opt.field && sort?.dir === 'desc'}>
                {opt.label} ↓
              </DropdownItem>
            )}
          </div>
        ))}
      </Dropdown>

      {/* 그룹화 드롭다운 */}
      <Dropdown
        trigger={
          <button
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors border cursor-pointer ${group ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'text-gray-500 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-bg-hover border-gray-200 dark:border-border-subtle'}`}
          >
            <Group size={13} />
            <span>{group ? `그룹: ${GROUP_OPTIONS.find(g => g.value === group)?.label}` : '그룹화'}</span>
          </button>
        }
        align="left"
      >
        {GROUP_OPTIONS.map(opt => (
          <DropdownItem key={String(opt.value)} onClick={() => onSetGroup(opt.value)} active={group === opt.value}>
            {opt.label}
          </DropdownItem>
        ))}
      </Dropdown>

      {/* 초기화 버튼 */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-gray-400 dark:text-text-tertiary hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors cursor-pointer"
        >
          <X size={13} />
          <span>초기화</span>
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FilterBar.jsx
git commit -m "feat(filter): add FilterBar component with filter/sort/group UI"
```

---

## Task 4: KanbanBoard 통합

**Files:**
- Modify: `src/components/KanbanBoard.jsx`

- [ ] **Step 1: KanbanBoard import 추가**

`src/components/KanbanBoard.jsx` 상단 import 섹션에 추가:

```javascript
import FilterBar from './FilterBar';
import { useFilterState, applyFilterSortGroup } from '../hooks/useFilterState';
```

- [ ] **Step 2: 기존 selectedTeam/selectedTag/selectedStatus state 제거**

아래 3줄 제거:
```javascript
const [selectedTeam, setSelectedTeam] = useState(null);
// (selectedTag가 있다면)
const [selectedStatus, setSelectedStatus] = useState(null);
```

- [ ] **Step 3: useFilterState 훅 사용 추가**

`useUrlState` 사용 직후에 추가:
```javascript
const { filters, sort, group, hasActiveFilters, addFilter, removeFilter, clearFilters, setSort, setGroup, reset: resetFilters } = useFilterState();
```

- [ ] **Step 4: filteredAndSortedPhases 파생 변수 추가**

DnD 핸들러 정의 직전에 추가:
```javascript
// 필터/정렬/그룹 적용된 phases 파생
const filteredAndSortedPhases = useMemo(() => {
  if (!filters.length && !sort && !group) return phases;
  return phases.map(phase => {
    const result = applyFilterSortGroup(phase.items || [], filters, sort, group);
    // group이 있으면 result는 [{groupKey, items}], 없으면 Item[]
    return { ...phase, items: Array.isArray(result) && result[0]?.groupKey !== undefined ? result.flatMap(g => g.items) : result, groups: Array.isArray(result) && result[0]?.groupKey !== undefined ? result : null };
  });
}, [phases, filters, sort, group]);
```

`useMemo` import에 추가 필요: `import { useState, useEffect, useRef, useMemo, useCallback } from 'react';`

- [ ] **Step 5: 기존 FilterBar HTML 교체**

기존 `{/* Filter Bar (Notion Style) */}` 블록 전체를 아래로 교체:

```jsx
{/* Filter Bar */}
{activeView === 'board' && (
  <FilterBar
    filters={filters}
    sort={sort}
    group={group}
    hasActiveFilters={hasActiveFilters}
    onAddFilter={addFilter}
    onRemoveFilter={removeFilter}
    onClearFilters={resetFilters}
    onSetSort={setSort}
    onSetGroup={setGroup}
  />
)}
```

- [ ] **Step 6: phases → filteredAndSortedPhases 로 교체**

BoardSection 및 ProjectColumn에 `phases` prop을 넘기는 부분을 `filteredAndSortedPhases`로 변경:

```javascript
// 변경 전
const boardPhases = phases.filter(p => ...)
// 변경 후
const boardPhases = filteredAndSortedPhases.filter(p => ...)
```

BoardSection 컴포넌트에 phases prop 전달 시:
```javascript
// 변경 전
phases={boardPhases.filter(p => p.section_id === section.id)}
// 변경 후
phases={boardPhases.filter(p => p.section_id === section.id)}
// (boardPhases 자체가 이미 filteredAndSortedPhases 기반이므로 변경 완료)
```

- [ ] **Step 7: selectedTeam/selectedStatus prop 제거**

ProjectColumn/KanbanCard에 `selectedTeam`, `selectedTag`, `selectedStatus` prop 전달하는 부분 제거.

검색: `selectedTeam, selectedTag, selectedStatus` → 해당 props 전달 줄 삭제.

- [ ] **Step 8: Commit**

```bash
git add src/components/KanbanBoard.jsx
git commit -m "feat(filter): integrate FilterBar and filteredAndSortedPhases into KanbanBoard"
```

---

## Task 5: KanbanCard highlight props 정리

**Files:**
- Modify: `src/components/KanbanCard.jsx`
- Modify: `src/components/ProjectColumn.jsx`

- [ ] **Step 1: KanbanCard.jsx에서 사용하지 않는 highlight props 제거**

`KanbanCard.jsx`에서 `selectedTeam`, `selectedTag`, `selectedStatus`를 받아 하이라이트를 적용하는 로직 확인 후 제거:

```bash
grep -n "selectedTeam\|selectedTag\|selectedStatus\|isHighlight\|highlight" src/components/KanbanCard.jsx
```

해당 props를 받는 destructuring과 사용 부분 제거.

- [ ] **Step 2: ProjectColumn.jsx에서 highlight props 제거**

```bash
grep -n "selectedTeam\|selectedTag\|selectedStatus" src/components/ProjectColumn.jsx
```

KanbanCard에 해당 props 전달하는 부분 제거.

- [ ] **Step 3: Commit**

```bash
git add src/components/KanbanCard.jsx src/components/ProjectColumn.jsx
git commit -m "feat(filter): remove legacy highlight filter props from KanbanCard/ProjectColumn"
```

---

## Task 6: 빌드 확인 및 최종 커밋

- [ ] **Step 1: 빌드 확인**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ built"
```

Expected: `✓ built`

- [ ] **Step 2: 동작 확인 체크리스트**

```bash
npm run dev
```

- [ ] 필터 추가 버튼 → 상태/팀/태그/담당자 선택 가능
- [ ] 필터 칩 표시 → X 클릭으로 제거
- [ ] 필터 적용 시 해당 카드만 남음 (숨김 처리)
- [ ] 정렬: 이름 ↑↓, 상태 순, 생성일 순 동작
- [ ] 그룹화: 상태별 / 담당자별 / 태그별 그룹 표시
- [ ] 초기화 버튼으로 전체 해제
- [ ] URL에 filter/sort/group 파라미터 반영
- [ ] 필터 없을 때 기존 칸반 동작 완전 동일

- [ ] **Step 3: 최종 커밋**

```bash
git add -A
git commit -m "feat: Phase 2 — filter/sort/group complete"
```
