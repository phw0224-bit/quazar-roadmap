/**
 * @fileoverview 백링크 패널 — 이 페이지를 [[위키링크]]로 참조하는 다른 페이지 목록.
 *
 * 옵시디언의 "Backlinks" 패널과 동일한 역할.
 * getBacklinks API로 description에 |itemId]] 패턴을 포함한 아이템을 자동 감지한다.
 * 수동 related_items와는 별개로 동작한다.
 */
import { useEffect, useState } from 'react';
import { Link2, FileText, CheckSquare } from 'lucide-react';
import { getBacklinks } from '../api/kanbanAPI';

function buildSnippet(description = '', itemTitle = '') {
  const plain = `${description || ''}`
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/[#>*`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plain) return '';
  const query = `${itemTitle || ''}`.trim();
  if (!query) return plain.slice(0, 120);

  const index = plain.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return plain.slice(0, 120);

  const start = Math.max(0, index - 28);
  const end = Math.min(plain.length, index + query.length + 56);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < plain.length ? '…' : '';
  return `${prefix}${plain.slice(start, end)}${suffix}`;
}

export default function BacklinksPanel({ itemId, onOpenDetail, allItems }) {
  const [backlinks, setBacklinks] = useState([]);
  const [loadedItemId, setLoadedItemId] = useState(null);

  useEffect(() => {
    if (!itemId) return;
    let isActive = true;
    getBacklinks(itemId)
      .then((data) => {
        if (!isActive) return;
        setBacklinks(data);
        setLoadedItemId(itemId);
      })
      .catch(() => {
        if (!isActive) return;
        setBacklinks([]);
        setLoadedItemId(itemId);
      });
    return () => {
      isActive = false;
    };
  }, [itemId]);

  const loading = itemId && loadedItemId !== itemId;

  if (loading) {
    return (
      <div className="p-4 text-sm text-gray-400 dark:text-text-tertiary text-center animate-pulse">
        백링크 검색 중…
      </div>
    );
  }

  if (backlinks.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-400 dark:text-text-tertiary text-center">
        <Link2 size={20} className="mx-auto mb-2 opacity-40" />
        <p>이 페이지를 링크하는 곳이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="p-3 overflow-y-auto max-h-full">
      <div className="flex items-center gap-2 mb-3 px-2">
        <Link2 size={16} className="text-gray-400 dark:text-text-tertiary" />
        <h3 className="text-xs font-bold text-gray-500 dark:text-text-tertiary uppercase tracking-wide">
          백링크 <span className="font-normal">({backlinks.length})</span>
        </h3>
      </div>
      <div className="space-y-0.5">
        {backlinks.map((bl) => {
          const Icon = bl.page_type === 'page' ? FileText : CheckSquare;
          const title = bl.title || bl.content || '제목 없음';
          const fullItem = allItems?.find((i) => i.id === bl.id) || bl;
          const snippet = buildSnippet(fullItem?.description || bl.description || '', title);
          return (
            <button
              key={bl.id}
              type="button"
              onClick={() => onOpenDetail?.(fullItem.id)}
              className="w-full rounded-xl px-3 py-2 text-left transition-colors group hover:bg-gray-100 dark:hover:bg-bg-hover"
            >
              <div className="flex items-start gap-2">
                <Icon
                  size={13}
                  className="mt-0.5 flex-shrink-0 text-gray-400 transition-colors group-hover:text-brand-400 dark:text-text-tertiary"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-gray-700 transition-colors group-hover:text-gray-900 dark:text-text-secondary dark:group-hover:text-text-primary">
                      {title}
                    </span>
                    <span className="flex-shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-text-tertiary">
                      열기
                    </span>
                  </div>
                  {snippet && (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-400 dark:text-text-tertiary">
                      {snippet}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
