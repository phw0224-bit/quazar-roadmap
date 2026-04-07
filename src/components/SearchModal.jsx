/**
 * @fileoverview 전역 검색 모달 (Cmd+K).
 *
 * 모든 보드의 아이템을 제목, 본문, 담당자 이름으로 검색.
 * 결과 클릭 시 해당 아이템의 상세 패널을 오픈.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, FileText } from 'lucide-react';
import { STATUS_MAP } from '../lib/constants';
import { buildEntityContext, getEntityLabel } from '../lib/entityModel';

export default function SearchModal({ phases = [], additionalItems = [], onOpenDetail, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /**
   * @description 로컬 캐시된 phases 데이터를 기반으로 검색 수행.
   * 제목(title), 부제목(content), 담당자(assignees) 필드를 포함하여 검색.
   * @param {string} q - 검색어
   */
  const search = useCallback((q) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    
    const lowerQ = q.toLowerCase();
    const phaseItems = phases.flatMap(p =>
      (p.items || []).map(item => ({
        ...item,
        projects: { title: p.title },
        _entityContext: buildEntityContext({ item, phase: p }),
      }))
    );
    const indexedAdditionalItems = additionalItems.map(item => ({
      ...item,
      _entityContext: buildEntityContext({ item }),
    }));
    const allItems = [...phaseItems, ...indexedAdditionalItems].filter(item => {
      const matchTitle = item.title?.toLowerCase().includes(lowerQ);
      const matchContent = item.content?.toLowerCase().includes(lowerQ);
      const matchAssignee = item.assignees?.some(a => a.toLowerCase().includes(lowerQ));
      return matchTitle || matchContent || matchAssignee;
    });

    const uniqueItems = Array.from(new Map(allItems.map(i => [i.id, i])).values());

    setResults(uniqueItems.slice(0, 15));
    setLoading(false);
  }, [phases, additionalItems]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  const handleSelect = (item) => {
    onOpenDetail(item.id);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (results[selectedIdx]) handleSelect(results[selectedIdx]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-xl mx-4 bg-white dark:bg-bg-elevated rounded-2xl shadow-2xl border border-gray-100 dark:border-border-strong overflow-hidden animate-scale-in"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* 입력창 */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-border-subtle">
          <Search size={17} className="text-gray-400 dark:text-text-tertiary shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 text-base bg-transparent border-none outline-none text-gray-900 dark:text-text-primary placeholder:text-gray-400 dark:placeholder:text-text-tertiary"
            placeholder="업무 검색..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              onMouseDown={e => { e.preventDefault(); setQuery(''); }}
              className="text-gray-400 hover:text-gray-600 dark:text-text-tertiary dark:hover:text-text-secondary cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* 결과 목록 */}
        {query.trim() && (
          <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
            {loading && (
              <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-text-tertiary">
                검색 중...
              </div>
            )}
            {!loading && results.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-text-tertiary">
                <FileText size={28} className="mx-auto mb-2 opacity-30" />
                검색 결과가 없습니다.
              </div>
            )}
            {!loading && results.map((item, idx) => {
              const status = STATUS_MAP[item.status];
              const projectTitle = item.projects?.title
                || getEntityLabel(item._entityContext);
              return (
                <button
                  key={item.id}
                  className={`w-full text-left px-4 py-3 flex flex-col gap-1 border-b border-gray-50 dark:border-border-subtle/50 last:border-0 transition-colors cursor-pointer ${
                    idx === selectedIdx
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-bg-hover'
                  }`}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  onClick={() => handleSelect(item)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-gray-900 dark:text-text-primary truncate flex-1">
                      {item.title || item.content}
                    </span>
                    {item.status && item.status !== 'none' && status && (
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide shrink-0 ${status.color}`}>
                        {status.label}
                      </span>
                    )}
                  </div>
                  {(projectTitle || item.content) && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-text-tertiary truncate">
                      {projectTitle && <span>{projectTitle}</span>}
                      {projectTitle && item.title && item.content && <span>·</span>}
                      {item.title && item.content && <span className="truncate">{item.content}</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 바닥 힌트 */}
        <div className="px-4 py-2 border-t border-gray-100 dark:border-border-subtle flex items-center gap-4 text-[11px] text-gray-400 dark:text-text-tertiary select-none">
          <span>↑↓ 이동</span>
          <span>Enter 열기</span>
          <span>ESC 닫기</span>
        </div>
      </div>
    </div>
  );
}
