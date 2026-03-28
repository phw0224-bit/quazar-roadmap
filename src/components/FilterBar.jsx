import { useState, useRef, useEffect } from 'react';
import { Filter, X, ArrowUpDown } from 'lucide-react';
import { TEAMS, GLOBAL_TAGS, STATUS_MAP } from '../lib/constants';

const FILTER_FIELDS = [
  { key: 'status',    label: '상태',   options: Object.entries(STATUS_MAP).map(([v, s]) => ({ value: v, label: s.label })) },
  { key: 'teams',     label: '팀',     options: TEAMS.map(t => ({ value: t.name, label: t.name })) },
  { key: 'tags',      label: '태그',   options: GLOBAL_TAGS.map(t => ({ value: t.name, label: t.name })) },
  { key: 'assignees', label: '담당자', options: null },
];

const SORT_OPTIONS = [
  { field: 'order_index', label: '기본 순서', allowDesc: false },
  { field: 'title',       label: '이름 순',   allowDesc: true },
  { field: 'status',      label: '상태 순',   allowDesc: true },
  { field: 'created_at',  label: '생성일 순', allowDesc: true },
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
      className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
        active
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium'
          : 'text-gray-700 dark:text-text-secondary hover:bg-gray-50 dark:hover:bg-bg-hover'
      }`}
    >
      {children}
    </button>
  );
}

export default function FilterBar({
  filters, sort, hasActiveFilters,
  onAddFilter, onRemoveFilter, onClearFilters, onSetSort,
}) {
  const [addingField, setAddingField] = useState(null);
  const [assigneeInput, setAssigneeInput] = useState('');
  const addingRef = useRef(null);

  // addingField 팝업 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e) => {
      if (addingField && !addingRef.current?.contains(e.target)) {
        setAddingField(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addingField]);

  const handleAddFilter = (field, value) => {
    onAddFilter(field, value);
    setAddingField(null);
    setAssigneeInput('');
  };

  const currentSort = sort ? `${SORT_OPTIONS.find(s => s.field === sort.field)?.label ?? sort.field} ${sort.dir === 'asc' ? '↑' : '↓'}` : null;

  return (
    <div className="flex items-center gap-2 flex-wrap px-10 py-2.5 border-b border-gray-100 dark:border-border-subtle bg-white dark:bg-bg-base min-h-[48px]">

      {/* 필터 추가 버튼 */}
      <Dropdown
        trigger={
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-bg-hover rounded-lg transition-colors border border-dashed border-gray-300 dark:border-border-strong cursor-pointer whitespace-nowrap"
          >
            <Filter size={13} />
            <span>필터 추가</span>
          </button>
        }
      >
        {FILTER_FIELDS.map(field => (
          <DropdownItem
            key={field.key}
            onClick={(e) => {
              e.stopPropagation();
              setAddingField(prev => prev === field.key ? null : field.key);
            }}
            active={addingField === field.key}
          >
            {field.label}
          </DropdownItem>
        ))}
      </Dropdown>

      {/* 필드 값 선택 팝업 */}
      {addingField && (() => {
        const fieldDef = FILTER_FIELDS.find(f => f.key === addingField);
        return (
          <div ref={addingRef} className="relative">
            <div className="absolute left-0 top-0 z-50 bg-white dark:bg-bg-elevated border border-gray-200 dark:border-border-subtle rounded-xl shadow-xl min-w-[200px] p-2">
              <div className="text-xs font-semibold text-gray-400 dark:text-text-tertiary px-2 pb-1.5 uppercase tracking-wide">
                {fieldDef.label} 선택
              </div>
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
                      if (e.key === 'Enter' && assigneeInput.trim()) handleAddFilter(addingField, assigneeInput.trim());
                      if (e.key === 'Escape') setAddingField(null);
                    }}
                    placeholder="이름 입력 후 Enter"
                    className="w-full text-sm border border-gray-200 dark:border-border-subtle rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400 bg-white dark:bg-bg-base text-gray-900 dark:text-text-primary placeholder-gray-400"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => setAddingField(null)}
                className="w-full text-left px-3 py-1 text-xs text-gray-400 dark:text-text-tertiary hover:text-gray-600 transition-colors cursor-pointer"
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
            key={`${filter.field}-${filter.value}-${i}`}
            className="flex items-center gap-1.5 px-2.5 py-1 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800 whitespace-nowrap"
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

      {/* 구분선 (필터 칩이 있을 때) */}
      {filters.length > 0 && <div className="w-px h-4 bg-gray-200 dark:bg-border-subtle" />}

      {/* 정렬 드롭다운 */}
      <Dropdown
        trigger={
          <button
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors border cursor-pointer whitespace-nowrap ${
              sort
                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                : 'text-gray-500 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-bg-hover border-gray-200 dark:border-border-subtle'
            }`}
          >
            <ArrowUpDown size={13} />
            <span>{currentSort ?? '정렬'}</span>
          </button>
        }
      >
        {SORT_OPTIONS.map(opt => (
          <div key={opt.field}>
            <DropdownItem
              onClick={() => onSetSort(opt.field, 'asc')}
              active={sort?.field === opt.field && sort?.dir === 'asc'}
            >
              {opt.label} ↑
            </DropdownItem>
            {opt.allowDesc && (
              <DropdownItem
                onClick={() => onSetSort(opt.field, 'desc')}
                active={sort?.field === opt.field && sort?.dir === 'desc'}
              >
                {opt.label} ↓
              </DropdownItem>
            )}
          </div>
        ))}
        {sort && (
          <DropdownItem onClick={() => onSetSort(null)}>
            정렬 해제
          </DropdownItem>
        )}
      </Dropdown>

      {/* 초기화 */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-gray-400 dark:text-text-tertiary hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <X size={13} />
          <span>초기화</span>
        </button>
      )}
    </div>
  );
}
