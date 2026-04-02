import { useState, useEffect } from 'react';
import { ChevronRight, LayoutGrid, Clock, Users, PanelLeft, MousePointer2, Ellipsis, BellDot } from 'lucide-react';
import { 
  DndContext, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  closestCenter,
  DragOverlay
} from '@dnd-kit/core';
import { usePageTree } from '../hooks/usePageTree';
import SidebarTree from './SidebarTree';
import kanbanAPI from '../api/kanbanAPI';

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
  onShowReleaseNotes,
  isReadOnly,
  hoverMode,
  onHoverModeToggle,
  onRefresh, // 데이터 갱신을 위한 콜백
}) {
  const [expandedIds, setExpandedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar-expanded');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch {
      return new Set();
    }
  });
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  useEffect(() => {
    localStorage.setItem('sidebar-expanded', JSON.stringify([...expandedIds]));
  }, [expandedIds]);

  useEffect(() => {
    if (!showMoreMenu) return;

    const handleWindowClick = () => {
      setShowMoreMenu(false);
    };

    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, [showMoreMenu]);

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

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // 1. 모든 아이템 평면화하여 위치 찾기
    const allItems = phases.flatMap(p => p.items || []);
    const activeItem = allItems.find(i => i.id === active.id);
    const overItem = allItems.find(i => i.id === over.id);

    // over 아이템이 phase(프로젝트)인 경우 처리
    const overPhase = phases.find(p => p.id === over.id);

    if (!activeItem) return;

    // 방어 로직: 드롭 대상이 유효한 아이템도 아니고 프로젝트도 아니면 무시
    if (!overPhase && !overItem) return;

    let targetParentId = null;
    let targetProjectId = activeItem.project_id;
    let targetIndex = 0;

    if (overPhase) {
      // 프로젝트(Phase) 위로 드롭한 경우 -> 해당 프로젝트의 루트로 이동
      targetProjectId = overPhase.id;
      targetParentId = null;
      targetIndex = 0;
    } else if (overItem) {
      targetProjectId = overItem.project_id;
      
      // 마우스 위치에 따른 Nesting 여부 판단
      const overRect = over.rect;
      const dragY = event.activatorEvent.clientY;
      const overTop = overRect.top;
      const overHeight = overRect.height;
      const relativeY = (dragY - overTop) / overHeight;

      if (relativeY > 0.25 && relativeY < 0.75) {
        // 중앙에 드롭 -> 자식으로 편입 (Nesting)
        targetParentId = overItem.id;
        targetIndex = 0; // 자식 목록의 맨 앞으로
      } else {
        // 상단 또는 하단에 드롭 -> 형제로 순서 변경
        targetParentId = overItem.parent_item_id;
        const siblings = allItems
          .filter(i => i.project_id === targetProjectId && i.parent_item_id === targetParentId)
          .sort((a, b) => a.order_index - b.order_index);
        
        const overIndex = siblings.findIndex(s => s.id === over.id);
        targetIndex = relativeY <= 0.25 ? overIndex : overIndex + 1;
      }
    }

    try {
      // 3. API 호출
      await kanbanAPI.moveItem(
        activeItem.project_id,
        targetProjectId,
        active.id,
        targetIndex,
        targetParentId
      );
      // 4. 데이터 갱신
      onRefresh?.();
    } catch (err) {
      console.error('Failed to move sidebar item:', err);
    }
  };


  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full h-full flex flex-col bg-[color:var(--color-bg-elevated)] overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-3 border-b border-[color:var(--color-border-subtle)]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg leading-none select-none" aria-hidden="true">Q</span>
            <span className="text-sm font-semibold text-[color:var(--color-text-primary)] truncate">
              Quazar
            </span>
          </div>

          <div className="relative flex items-center">
            <button
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md
                text-[color:var(--color-text-tertiary)] hover:text-[color:var(--color-text-primary)]
                hover:bg-[color:var(--color-bg-hover)] transition-colors duration-100 cursor-pointer"
              onClick={(e) => {
                stopProp(e);
                setShowMoreMenu((prev) => !prev);
              }}
              onPointerDown={stopProp}
              title="더보기"
            >
              <Ellipsis size={15} strokeWidth={2} />
            </button>

            {showMoreMenu && (
              <div
                className="absolute right-0 top-9 z-30 min-w-40 rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-base)] p-1 shadow-xl"
                onClick={stopProp}
                onPointerDown={stopProp}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-hover)] hover:text-[color:var(--color-text-primary)] transition-colors cursor-pointer"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onShowReleaseNotes?.();
                  }}
                >
                  <BellDot size={14} strokeWidth={1.9} className="flex-shrink-0" />
                  <span>업데이트 내역</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-hover)] hover:text-[color:var(--color-text-primary)] transition-colors cursor-pointer"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onHoverModeToggle?.();
                  }}
                >
                  {hoverMode ? (
                    <PanelLeft size={14} strokeWidth={1.9} className="flex-shrink-0" />
                  ) : (
                    <MousePointer2 size={14} strokeWidth={1.9} className="flex-shrink-0" />
                  )}
                  <span>{hoverMode ? '클릭 모드로 전환' : '호버 모드로 전환'}</span>
                </button>
              </div>
            )}
          </div>
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
    </DndContext>
  );
}
