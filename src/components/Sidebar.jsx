import { useState, useEffect, createElement, useMemo, useCallback } from 'react';
import { ChevronRight, LayoutGrid, Clock, Users, Ellipsis, BellDot, Moon, Sun, LogOut, Map, Settings, Search, StickyNote, PanelLeftClose, Bell } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
  DragOverlay
} from '@dnd-kit/core';
import { usePageTree } from '../hooks/usePageTree';
import { useNewItems } from '../hooks/useNewItems';
import ProfileAvatar from './ProfileAvatar';
import SidebarTree from './SidebarTree';
import { getDropTypeFromRelativeY, getRelativeY } from './sidebarDropZones';

const stopProp = (e) => e.stopPropagation();

const NAV_ITEMS = [
  { view: 'roadmap', label: '전사 로드맵', icon: Map },
  { view: 'board', label: '팀 보드', icon: LayoutGrid },
  { view: 'timeline', label: '타임라인', icon: Clock },
  { view: 'personal', label: '개인 메모', icon: StickyNote },
  { view: 'people', label: '피플 보드', icon: Users },
];

function BoardRootDropZone({ boardId, isActive, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: boardId });

  return (
    <div
      ref={setNodeRef}
      className={isActive || isOver ? 'rounded-md ring-1 ring-green-400/60 bg-green-50/30 dark:bg-green-900/10' : ''}
    >
      {children}
    </div>
  );
}

export default function Sidebar({
  sections,
  projects,
  activeView,
  activeItemId,
  onNavigate,
  onOpenItem,
  onAddChildPage,
  onShowPrompt,
  onShowReleaseNotes,
  isReadOnly,
  user,
  theme,
  mounted,
  onToggleTheme,
  onLogout,
  onToggleSidebar,
  onSetBoardType,  // 보드 선택 시 호출
  generalDocs = [],  // 신규: 독립 폴더/문서
  onShowToast,
  onMoveSidebarItem,
  onMoveSidebarProject,
  onOpenProfileSettings,
  profileCustomization,
  onOpenSearch,
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
  const [dragOverInfo, setDragOverInfo] = useState(null);
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // 새 아이템 알림 (사용자 팀에만)
  const userDepartment = user?.user_metadata?.department || null;
  const { newItems, markAsRead } = useNewItems(projects, userDepartment, isReadOnly);

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

  const pageTree = usePageTree(projects, sections, generalDocs);
  const profileName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Quazar';
  const allItems = useMemo(() => projects.flatMap((p) => p.items || []), [projects]);
  const projectIdSet = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);
  const projectItemIdSet = useMemo(() => new Set(allItems.map((i) => i.id)), [allItems]);
  const generalDocIdSet = useMemo(() => new Set(generalDocs.map((d) => d.id)), [generalDocs]);

  const getNodeKind = useCallback((nodeId) => {
    const id = String(nodeId);
    if (id.startsWith('board-root-')) return 'board-root';
    if (projectIdSet.has(id)) return 'project';
    if (generalDocIdSet.has(id)) return 'general-doc';
    if (projectItemIdSet.has(id)) return 'project-item';
    return 'unknown';
  }, [projectIdSet, generalDocIdSet, projectItemIdSet]);

  const canDropByKind = useCallback((activeKind, overKind) => {
    if (activeKind === 'project') return overKind === 'project' || overKind === 'board-root';
    if (activeKind === 'general-doc') return overKind === 'general-doc';
    if (activeKind === 'project-item') return overKind === 'project-item' || overKind === 'project';
    return false;
  }, []);

  const handleToggle = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAddChild = useCallback((parentItemId, projectId) => {
    onShowPrompt?.('하위 페이지 추가', '페이지 제목을 입력하세요', async (title) => {
      if (!title?.trim()) return;
      await onAddChildPage?.(projectId, parentItemId, title.trim());
    });
  }, [onAddChildPage, onShowPrompt]);

  // 보드 토글 시 board type 업데이트
  const handleBoardToggle = useCallback((id) => {
    handleToggle(id);
    // board id format: 'board-main', 'board-개발팀' 등
    if (id?.startsWith('board-')) {
      const boardType = id.replace('board-', '');
      onSetBoardType?.(boardType);
    }
  }, [handleToggle, onSetBoardType]);

  const handleDragStart = useCallback((event) => {
    const draggedProject = projects.find(p => p.id === event.active.id);
    const draggedItem = allItems.find(i => i.id === event.active.id);
    setActiveDragItem(draggedProject || draggedItem || null);
  }, [allItems, projects]);

  const handleDragOver = useCallback((event) => {
    const { over, active } = event;
    if (!over || !active) {
      setDragOverInfo((prev) => (prev === null ? prev : null));
      return;
    }
    const activeKind = getNodeKind(active.id);
    const overKind = getNodeKind(over.id);
    if (!canDropByKind(activeKind, overKind)) {
      setDragOverInfo((prev) => (prev === null ? prev : null));
      return;
    }

    const relativeY = getRelativeY({
      overRect: over.rect,
      draggedRect: active.rect?.current?.translated,
      fallbackY: event.activatorEvent?.clientY ?? 0,
    });
    const nextInfo = { id: over.id, type: getDropTypeFromRelativeY(relativeY) };

    setDragOverInfo((prev) => (
      prev?.id === nextInfo.id && prev?.type === nextInfo.type ? prev : nextInfo
    ));
  }, [canDropByKind, getNodeKind]);

  const handleDragEnd = useCallback(async (event) => {
    setDragOverInfo(null);
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeKind = getNodeKind(active.id);
    const overKind = getNodeKind(over.id);
    if (!canDropByKind(activeKind, overKind)) return;

    const draggedProject = projects.find(p => p.id === active.id);

    // === Project 드래그 처리 ===
    if (draggedProject) {
      const overIdString = String(over.id);
      const rootBoardPrefix = 'board-root-';
      if (overIdString.startsWith(rootBoardPrefix)) {
        const targetBoardType = overIdString.slice(rootBoardPrefix.length);
        const standaloneProjects = projects
          .filter((p) => (p.board_type || 'main') === targetBoardType && !p.section_id)
          .sort((a, b) => a.order_index - b.order_index);

        try {
          await onMoveSidebarProject?.(active.id, null, standaloneProjects.length);
        } catch (err) {
          console.error('Failed to move project to board root:', err);
          onShowToast?.('프로젝트 이동에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
        }
        return;
      }

      const overProject = projects.find(p => p.id === over.id);
      if (!overProject) return;

      const targetSectionId = overProject.section_id;
      const sectionProjects = projects
        .filter(p => p.section_id === targetSectionId)
        .sort((a, b) => a.order_index - b.order_index);
      const overIndex = sectionProjects.findIndex(p => p.id === over.id);

      const relativeY = getRelativeY({
        overRect: over.rect,
        draggedRect: active.rect?.current?.translated,
        fallbackY: event.activatorEvent?.clientY ?? 0,
      });
      const targetIndex = relativeY <= 0.5 ? overIndex : overIndex + 1;

      try {
        await onMoveSidebarProject?.(active.id, targetSectionId, targetIndex);
      } catch (err) {
        console.error('Failed to move project:', err);
        onShowToast?.('프로젝트 이동에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
      }
      return;
    }

    // === Item 드래그 처리 ===
    const activeItem = allItems.find(i => i.id === active.id);
    if (!activeItem) return;

    const overProject = projects.find(p => p.id === over.id);
    const overItem = allItems.find(i => i.id === over.id);
    if (!overProject && !overItem) return;

    let targetParentId = null;
    let targetProjectId = activeItem.project_id;
    let targetIndex = 0;

    if (overProject) {
      targetProjectId = overProject.id;
      targetParentId = null;
      targetIndex = 0;
    } else {
      const relativeY = getRelativeY({
        overRect: over.rect,
        draggedRect: active.rect?.current?.translated,
        fallbackY: event.activatorEvent?.clientY ?? 0,
      });
      targetProjectId = overItem.project_id;

      if (getDropTypeFromRelativeY(relativeY) === 'inside') {
        targetParentId = overItem.id;
        targetIndex = 0;
      } else {
        targetParentId = overItem.parent_item_id;
        const siblings = allItems
          .filter(i => i.project_id === targetProjectId && i.parent_item_id === targetParentId)
          .sort((a, b) => a.order_index - b.order_index);
        const overIdx = siblings.findIndex(s => s.id === over.id);
        targetIndex = relativeY <= 0.5 ? overIdx : overIdx + 1;
      }
    }

    try {
      await onMoveSidebarItem?.(
        activeItem.project_id,
        targetProjectId,
        active.id,
        targetIndex,
        targetParentId
      );
    } catch (err) {
      console.error('Failed to move item:', err);
      onShowToast?.('아이템 이동에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
    }
  }, [allItems, canDropByKind, getNodeKind, onMoveSidebarItem, onMoveSidebarProject, onShowToast, projects]);


  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <DragOverlay>
        {activeDragItem ? (
          <div className="px-2 py-1 rounded-md bg-white dark:bg-bg-elevated shadow-lg text-sm opacity-90">
            {activeDragItem.title || activeDragItem.content || '제목 없음'}
          </div>
        ) : null}
      </DragOverlay>
      <div className="w-full h-full flex flex-col bg-[color:var(--color-bg-elevated)] overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-3 border-b border-[color:var(--color-border-subtle)]">
          <div className="flex items-center gap-2 min-w-0">
            {user ? (
              <ProfileAvatar
                name={profileName}
                customization={profileCustomization}
                size="sm"
                showMood={false}
              />
            ) : (
              <span className="text-lg leading-none select-none" aria-hidden="true">Q</span>
            )}
            <span className="text-sm font-semibold text-[color:var(--color-text-primary)] truncate">{profileName}</span>
          </div>

          <div className="relative flex items-center gap-1">
            <button
              type="button"
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md
                text-[color:var(--color-text-tertiary)] hover:text-[color:var(--color-text-primary)]
                hover:bg-[color:var(--color-bg-hover)] transition-colors duration-100 cursor-pointer"
              onClick={onToggleSidebar}
              onPointerDown={stopProp}
              title="사이드바 접기 (Ctrl/Cmd+B)"
            >
              <PanelLeftClose size={14} strokeWidth={2} />
            </button>
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
                    onOpenSearch?.();
                  }}
                >
                  <Search size={14} strokeWidth={1.9} className="flex-shrink-0" />
                  <span>검색 열기</span>
                </button>
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
                {mounted && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-hover)] hover:text-[color:var(--color-text-primary)] transition-colors cursor-pointer"
                    onClick={() => {
                      setShowMoreMenu(false);
                      onToggleTheme?.();
                    }}
                  >
                    {theme === 'dark' ? (
                      <Sun size={14} strokeWidth={1.9} className="flex-shrink-0" />
                    ) : (
                      <Moon size={14} strokeWidth={1.9} className="flex-shrink-0" />
                    )}
                    <span>{theme === 'dark' ? '라이트 모드' : '다크 모드'}</span>
                  </button>
                )}
                {user && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                    onClick={() => {
                      setShowMoreMenu(false);
                      onLogout?.();
                    }}
                  >
                    <LogOut size={14} strokeWidth={1.9} className="flex-shrink-0" />
                    <span>로그아웃</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Fixed nav items */}
        <nav className="flex-shrink-0 px-2 pt-2 pb-1">
          {NAV_ITEMS.map(({ view, label, icon }) => {
            const isActive = activeView === view;
            const iconNode = createElement(icon, { size: 15, strokeWidth: 1.75, className: 'flex-shrink-0' });
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
                {iconNode}
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="flex-shrink-0 mx-3 border-t border-[color:var(--color-border-subtle)]" />

        {/* Scrollable page tree */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 min-h-0">
          {pageTree.map((board) => {
            const boardRootDropId = `board-root-${board.title}`;
            const isBoardRootOver = dragOverInfo?.id === boardRootDropId;

            return (
              <div key={board.id} className="mb-2">
                <BoardRootDropZone boardId={boardRootDropId} isActive={isBoardRootOver}>
              {/* Board header */}
              <button
                className="group w-full flex items-center gap-1 px-2 py-[3px] rounded-md cursor-pointer
                  text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-hover)] transition-colors duration-100 select-none"
                onClick={() => handleBoardToggle(board.id)}
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

                      {/* Section's projects + their page children */}
                      {expandedIds.has(`section-${section.id}`) && section.projects.length > 0 && (
                        <div className="ml-3 border-l border-[color:var(--color-border-subtle)] pl-1">
                          <SidebarTree
                            nodes={section.projects}
                            depth={0}
                            expandedIds={expandedIds}
                            onToggle={handleToggle}
                            activeItemId={activeItemId}
                            onSelectItem={onOpenItem}
                            onAddChild={handleAddChild}
                            isReadOnly={isReadOnly}
                            dragOverInfo={dragOverInfo}
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Standalone projects */}
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
                      dragOverInfo={dragOverInfo}
                    />
                  )}

                  {/* General docs (폴더/문서) */}
                  {board.generalDocs?.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-[color:var(--color-border-subtle)]">
                      <span className="px-2 text-[11px] font-semibold text-[color:var(--color-text-tertiary)] uppercase tracking-wide">문서</span>
                      <SidebarTree
                        nodes={board.generalDocs}
                        depth={0}
                        expandedIds={expandedIds}
                        onToggle={handleToggle}
                        activeItemId={activeItemId}
                        onSelectItem={onOpenItem}
                        onAddChild={handleAddChild}
                        isReadOnly={isReadOnly}
                        dragOverInfo={dragOverInfo}
                      />
                    </div>
                  )}
                </div>
              )}
                </BoardRootDropZone>
              </div>
            );
          })}
        </div>

        <div className="flex-shrink-0 border-t border-[color:var(--color-border-subtle)] px-2 py-2">
          {user && newItems.length > 0 && (
            <div className="mb-2 pb-2 border-b border-[color:var(--color-border-subtle)]">
              <button
                onClick={() => setShowNotifPanel(!showNotifPanel)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-left hover:bg-[color:var(--color-bg-hover)] transition-colors cursor-pointer relative"
                title="새 아이템"
              >
                <Bell size={16} className="text-red-500 flex-shrink-0" />
                <span className="text-[12px] font-semibold text-[color:var(--color-text-primary)]">새 아이템</span>
                <span className="ml-auto px-1.5 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded text-[10px] font-bold">
                  {newItems.length}
                </span>
              </button>
              {showNotifPanel && (
                <div className="mt-1 max-h-64 overflow-y-auto space-y-0.5 bg-[color:var(--color-bg-elevated)] border border-[color:var(--color-border-strong)] rounded-md p-1 custom-scrollbar">
                  {newItems.map(item => (
                    <div
                      key={item.id}
                      className="px-2 py-1.5 rounded text-left hover:bg-[color:var(--color-bg-hover)] transition-colors group flex gap-1"
                    >
                      <button
                        onClick={() => {
                          onOpenItem(item.id);
                          setShowNotifPanel(false);
                        }}
                        className="flex-1 text-[11px] text-[color:var(--color-text-primary)] hover:underline truncate"
                      >
                        {item.displayName}
                      </button>
                      <button
                        onClick={() => markAsRead(item.id)}
                        className="flex-shrink-0 text-[color:var(--color-text-tertiary)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                        title="읽음 표시"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {user ? (
            <div className="space-y-1">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-left hover:bg-[color:var(--color-bg-hover)] transition-colors cursor-pointer"
                onClick={onOpenProfileSettings}
                title="프로필 설정"
              >
                <ProfileAvatar
                  name={user?.user_metadata?.name || user?.email || 'U'}
                  customization={profileCustomization}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold text-[color:var(--color-text-primary)] truncate">
                    {user?.user_metadata?.name || user?.email?.split('@')[0]}
                  </div>
                  {profileCustomization?.statusMessage && (
                    <div className="text-[11px] text-[color:var(--color-text-tertiary)] truncate">
                      {profileCustomization.statusMessage}
                    </div>
                  )}
                </div>
                <Settings size={14} className="text-[color:var(--color-text-tertiary)] flex-shrink-0" />
              </button>
            </div>
          ) : (
            <div className="px-2 py-1 text-[11px] text-[color:var(--color-text-tertiary)]">
              게스트 모드
            </div>
          )}
        </div>
      </div>
    </DndContext>
  );
}
