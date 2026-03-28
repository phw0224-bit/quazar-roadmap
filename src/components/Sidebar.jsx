import { useState, useEffect } from 'react';
import { ChevronRight, LayoutGrid, Clock, Users, PanelLeft, MousePointer2 } from 'lucide-react';
import { usePageTree } from '../hooks/usePageTree';
import SidebarTree from './SidebarTree';

const stopProp = (e) => e.stopPropagation();

const NAV_ITEMS = [
  { view: 'board', label: '메인 보드', icon: LayoutGrid },
  { view: 'timeline', label: '타임라인', icon: Clock },
  { view: 'people', label: '피플 보드', icon: Users },
];

export default function Sidebar({
  sections,
  phases,
  activeView,
  activeItemId,
  onNavigate,
  onOpenItem,
  onAddChildPage,
  onShowPrompt,
  isReadOnly,
  hoverMode,
  onHoverModeToggle,
}) {
  const [expandedIds, setExpandedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar-expanded');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem('sidebar-expanded', JSON.stringify([...expandedIds]));
  }, [expandedIds]);

  const pageTree = usePageTree(phases, sections);

  const handleToggle = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddChild = (parentItemId, phaseId) => {
    onShowPrompt?.('하위 페이지 추가', '페이지 제목을 입력하세요', async (title) => {
      if (!title?.trim()) return;
      await onAddChildPage?.(phaseId, parentItemId, title.trim());
    });
  };


  return (
    <div className="w-full h-full flex flex-col bg-[color:var(--color-bg-elevated)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-3 border-b border-[color:var(--color-border-subtle)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg leading-none select-none" aria-hidden="true">Q</span>
          <span className="text-sm font-semibold text-[color:var(--color-text-primary)] truncate">
            Quazar
          </span>
        </div>

        {/* Hover mode toggle button */}
        <button
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md
            text-[color:var(--color-text-tertiary)] hover:text-[color:var(--color-text-primary)]
            hover:bg-[color:var(--color-bg-hover)] transition-colors duration-100 cursor-pointer"
          onClick={onHoverModeToggle}
          onPointerDown={stopProp}
          title={hoverMode ? '클릭 모드로 전환' : '호버 모드로 전환'}
        >
          {hoverMode ? <PanelLeft size={14} strokeWidth={2} /> : <MousePointer2 size={14} strokeWidth={2} />}
        </button>
      </div>

      {/* Fixed nav items */}
      <nav className="flex-shrink-0 px-2 pt-2 pb-1">
        {NAV_ITEMS.map(({ view, label, icon: Icon }) => {
          const isActive = activeView === view;
          return (
            <button
              key={view}
              className={`w-full flex items-center gap-2 px-2 py-[5px] rounded-md text-[13px] font-medium
                transition-colors duration-100 cursor-pointer text-left
                ${isActive
                  ? 'bg-[color:var(--color-bg-hover)] text-[color:var(--color-text-primary)]'
                  : 'text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-hover)] hover:text-[color:var(--color-text-primary)]'
                }`}
              onClick={() => onNavigate?.(view)}
              onPointerDown={stopProp}
            >
              <Icon size={15} strokeWidth={1.75} className="flex-shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="flex-shrink-0 mx-3 border-t border-[color:var(--color-border-subtle)]" />

      {/* Scrollable page tree */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 min-h-0">
        {pageTree.map((board) => (
          <div key={board.id} className="mb-2">
            {/* Board header */}
            <button
              className="group w-full flex items-center gap-1 px-2 py-[3px] rounded-md cursor-pointer
                text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-hover)] transition-colors duration-100 select-none"
              onClick={() => handleToggle(board.id)}
              onPointerDown={stopProp}
            >
              <ChevronRight
                size={12}
                strokeWidth={2.5}
                className={`flex-shrink-0 transition-transform duration-150 opacity-60 group-hover:opacity-100
                  ${expandedIds.has(board.id) ? 'rotate-90' : 'rotate-0'}`}
              />
              <span className="text-[12px] font-bold uppercase tracking-wide truncate">
                {board.title}
              </span>
            </button>

            {/* Board content */}
            {expandedIds.has(board.id) && (
              <div className="ml-1 mt-1 space-y-1">
                {/* Sections */}
                {board.sections.map((section) => (
                  <div key={section.id}>
                    <button
                      className="group w-full flex items-center gap-1 px-2 py-[3px] rounded-md cursor-pointer
                        text-[color:var(--color-text-tertiary)] hover:text-[color:var(--color-text-secondary)]
                        hover:bg-[color:var(--color-bg-hover)] transition-colors duration-100 select-none"
                      onClick={() => handleToggle(`section-${section.id}`)}
                      onPointerDown={stopProp}
                    >
                      <ChevronRight
                        size={11}
                        strokeWidth={2.5}
                        className={`flex-shrink-0 transition-transform duration-150 opacity-60 group-hover:opacity-100
                          ${expandedIds.has(`section-${section.id}`) ? 'rotate-90' : 'rotate-0'}`}
                      />
                      <span className="text-[11px] font-semibold uppercase tracking-wide truncate">
                        {section.title}
                      </span>
                    </button>

                    {/* Section's phases + their page children */}
                    {expandedIds.has(`section-${section.id}`) && section.phases.length > 0 && (
                      <div className="ml-3 border-l border-[color:var(--color-border-subtle)] pl-1">
                        <SidebarTree
                          nodes={section.phases}
                          depth={0}
                          expandedIds={expandedIds}
                          onToggle={handleToggle}
                          activeItemId={activeItemId}
                          onSelectItem={onOpenItem}
                          onAddChild={handleAddChild}
                          isReadOnly={isReadOnly}
                        />
                      </div>
                    )}
                  </div>
                ))}

                {/* Standalone phases */}
                {board.standalone.length > 0 && (
                  <SidebarTree
                    nodes={board.standalone}
                    depth={0}
                    expandedIds={expandedIds}
                    onToggle={handleToggle}
                    activeItemId={activeItemId}
                    onSelectItem={onOpenItem}
                    onAddChild={handleAddChild}
                    isReadOnly={isReadOnly}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
