/**
 * @fileoverview Markdown source editor용 슬래시 명령 팔레트.
 *
 * CodeMirror 아래에 떠서 `/query` 검색 결과를 보여주고, 방향키/Enter/마우스 선택과
 * 같은 상호작용은 상위 Editor.jsx가 제어한다.
 */
import { useEffect, useRef } from 'react';

export default function SlashCommandMenu({
  items,
  selectedIndex = 0,
  position = { top: 0, left: 0 },
  title = 'Slash Commands',
  onSelect,
}) {
  const activeItemRef = useRef(null);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!items?.length) return null;

  return (
    <div
      className="absolute z-30 w-72 max-h-80 overflow-y-auto rounded-2xl border border-gray-200 bg-white/95 p-1 shadow-2xl backdrop-blur dark:border-border-subtle dark:bg-bg-elevated/95"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 pb-2 pt-2 text-[10px] font-black uppercase tracking-[0.25em] text-gray-400 dark:text-text-tertiary">
        {title}
      </div>
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          data-active={index === selectedIndex}
          ref={index === selectedIndex ? activeItemRef : null}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect?.(item);
          }}
          className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
            index === selectedIndex
              ? 'bg-gray-100 text-gray-900 dark:bg-bg-hover dark:text-text-primary'
              : 'text-gray-600 hover:bg-gray-50 dark:text-text-secondary dark:hover:bg-bg-hover'
          }`}
        >
          <span className="mt-0.5 inline-flex min-w-0 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-gray-500 dark:bg-[#17191d] dark:text-text-tertiary">
            /{item.id}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold">{item.label}</span>
            <span className="mt-0.5 block text-xs text-gray-400 dark:text-text-tertiary">
              {item.description || item.keywords?.join(' · ')}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
