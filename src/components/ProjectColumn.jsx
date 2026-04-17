/**
 * @fileoverview 칸반 컬럼 하나 (Project). DnD droppable + draggable 이중 역할.
 *
 * - 컬럼 자체: useSortable (가로 드래그로 순서 변경)
 * - 컬럼 내부: useDroppable (다른 컬럼에서 카드 드롭 수신)
 * - 컬럼 내 카드들: SortableContext(verticalListSortingStrategy)
 * - 담당자 편집은 AssigneePicker 공용 UI 사용
 *
 * 색상 테마: PROJECT_TINTS 배열에서 projectIndex % 4 로 결정.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreHorizontal, Plus, User, Link, EyeOff, CheckCircle2 } from 'lucide-react';
import KanbanCard from './KanbanCard';
import AssigneePicker from './AssigneePicker';
import { PROJECT_TINTS } from '../lib/constants';
import {
  getProjectMenuPosition,
  PROJECT_MENU_SURFACE_CLASS,
} from './projectColumnMenu';

function getProjectTint(projectId, projectIndex) {
  if (Number.isInteger(projectIndex)) {
    return PROJECT_TINTS[Math.abs(projectIndex) % PROJECT_TINTS.length];
  }

  const hash = String(projectId || '')
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return PROJECT_TINTS[hash % PROJECT_TINTS.length];
}

export default function ProjectColumn({
  project, projectIndex, isDragging: isDraggingProp = false,
  onAddItem, onUpdateItem, onDeleteItem, onUpdateProject,
  onOpenDetail, onShowToast,
  onCompleteProject,
  isCompletedView = false,
  currentUserId = null,
  isReadOnly = false,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditingAssignees, setIsEditingAssignees] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, transformOrigin: 'top right' });
  const menuButtonRef = useRef(null);

  const COLLAPSED_COUNT = 6;
  const [isExpanded, setIsExpanded] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const completedCount = project.items.filter(item => item.status === 'done').length;
  const displayItems = hideCompleted
    ? project.items.filter(item => item.status !== 'done')
    : project.items;
  const hasMore = displayItems.length > COLLAPSED_COUNT;
  const visibleItems = isExpanded ? displayItems : displayItems.slice(0, COLLAPSED_COUNT);

  const { setNodeRef: setDroppableRef } = useDroppable({ id: project.id });
  const { attributes, listeners, setNodeRef: setSortableRef, transform, transition, isDragging: isSortableDragging } = useSortable({
    id: project.id,
    data: { type: 'Project', project },
    disabled: isReadOnly || isEditingAssignees || showAddItem || showMenu,
  });

  const isDragging = isDraggingProp || isSortableDragging;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? transition : 'none',
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 100 : 1,
  };
  const setNodeRef = (node) => { setDroppableRef(node); setSortableRef(node); };

  const [newItemTitle, setNewItemTitle] = useState('');

  useEffect(() => {
    if (isReadOnly) return;
    const kanbanItems = project.items.filter(item => !item.page_type || item.page_type === 'task');
    const allDone = kanbanItems.length > 0 && kanbanItems.every(item => item.status === 'done');
    if (allDone && !project.is_completed) {
      onCompleteProject?.(project.id, true);
    } else if (!allDone && project.is_completed) {
      onCompleteProject?.(project.id, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.items, isReadOnly]);

  useEffect(() => {
    setIsEditingAssignees(false);
    setShowMenu(false);
  }, [project.id, project.title, project.assignees]);

  useEffect(() => {
    if (!showMenu) return undefined;

    const updateMenuPosition = () => {
      if (!menuButtonRef.current || typeof window === 'undefined') return;

      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuPosition(getProjectMenuPosition(rect, {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }));
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowMenu(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMenu]);

  const handleSaveAssignees = async (updatedAssignees, updatedUserIds) => {
    const currentNames = project.assignees || [];
    const currentIds = project.assignee_user_ids || [];

    if (
      JSON.stringify(updatedAssignees) === JSON.stringify(currentNames)
      && JSON.stringify(updatedUserIds) === JSON.stringify(currentIds)
    ) {
      setIsEditingAssignees(false);
      return;
    }
    setIsEditingAssignees(false);
    await onUpdateProject(project.id, {
      assignees: updatedAssignees,
      assignee_user_ids: updatedUserIds,
    });
    onShowToast?.('프로젝트 담당자가 업데이트되었습니다.');
  };

  const projectTint = getProjectTint(project.id, projectIndex);

  const stopProp = (e) => {
    e.stopPropagation();
    if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
  };

  return (
    <div
      id={`project-${project.id}`}
      ref={setNodeRef} style={style}
      className={`flex flex-col min-w-[340px] max-w-[340px] h-full transition-all duration-300 ease-notion rounded-3xl border ${projectTint.column}
      ${isDragging ? 'shadow-2xl ring-2 ring-brand-500 border-brand-400 bg-white dark:bg-bg-elevated scale-[1.02] z-[1000]' : ''}`}
    >
      {/* Column Header */}
      <div
        {...attributes}
        {...listeners}
        className={`group p-5 flex flex-col gap-4 rounded-t-[22px] border-b border-white/40 dark:border-border-subtle ${projectTint.header} backdrop-blur-md ${
          isReadOnly || isEditingAssignees || showMenu ? '' : `cursor-grab active:cursor-grabbing transition-colors duration-200 ${projectTint.headerHover}`
        }`}
      >
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3 overflow-hidden" onClick={stopProp} onPointerDown={stopProp}>
            <button
              type="button"
              className="truncate text-left text-lg font-black tracking-tight text-gray-900 transition-colors hover:text-brand-600 dark:text-text-primary dark:hover:text-brand-400"
              onClick={() => onOpenDetail?.(project.id)}
            >
              {project.title}
            </button>
            <span className="px-2.5 py-0.5 bg-white/60 dark:bg-bg-base border border-white/20 dark:border-border-subtle shadow-sm font-bold text-[13px] text-gray-500 dark:text-text-secondary rounded-full shrink-0 leading-none tabular-nums">
              {project.items.length}
            </span>
          </div>

          <div className="relative flex items-center gap-1" onClick={stopProp} onPointerDown={stopProp}>
            <button
              type="button"
              ref={menuButtonRef}
              className="p-1.5 rounded-lg text-gray-400 transition-all hover:bg-white/60 hover:text-gray-900 dark:text-text-tertiary dark:hover:bg-bg-hover dark:hover:text-text-primary cursor-pointer"
              title="프로젝트 메뉴"
              onClick={() => setShowMenu(prev => !prev)}
            >
              <MoreHorizontal size={15} strokeWidth={2.5} />
            </button>
            {showMenu && typeof document !== 'undefined' && createPortal(
              <>
                <button
                  type="button"
                  aria-label="프로젝트 메뉴 닫기"
                  className="fixed inset-0 z-[1200] bg-transparent"
                  onClick={() => setShowMenu(false)}
                />
                <div
                  className={PROJECT_MENU_SURFACE_CLASS}
                  style={{
                    top: menuPosition.top,
                    left: menuPosition.left,
                    transformOrigin: menuPosition.transformOrigin,
                  }}
                  onClick={stopProp}
                  onPointerDown={stopProp}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-text-secondary dark:hover:bg-bg-hover"
                    onClick={() => {
                      onOpenDetail?.(project.id);
                      setShowMenu(false);
                    }}
                  >
                    프로젝트 상세 보기
                  </button>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium transition-colors ${
                      project.is_completed
                        ? 'text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
                        : 'text-gray-700 hover:bg-gray-50 dark:text-text-secondary dark:hover:bg-bg-hover'
                    }`}
                    onClick={() => {
                      onCompleteProject?.(project.id, !project.is_completed);
                      setShowMenu(false);
                    }}
                  >
                    <CheckCircle2 size={14} strokeWidth={2.2} />
                    {project.is_completed ? '프로젝트 완료 해제' : '프로젝트 완료 처리'}
                  </button>
                  {completedCount > 0 && (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-text-secondary dark:hover:bg-bg-hover"
                      onClick={() => {
                        setHideCompleted(prev => !prev);
                        setShowMenu(false);
                      }}
                    >
                      <EyeOff size={14} strokeWidth={2.2} />
                      {hideCompleted ? `완료 항목 표시 (${completedCount}개)` : `완료 항목 숨기기 (${completedCount}개)`}
                    </button>
                  )}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-text-secondary dark:hover:bg-bg-hover"
                    onClick={() => {
                      const url = `${window.location.origin}${window.location.pathname}?scrollTo=project:${project.id}`;
                      navigator.clipboard.writeText(url).then(() => onShowToast?.('링크 복사됨'));
                      setShowMenu(false);
                    }}
                  >
                    <Link size={14} strokeWidth={2.2} />
                    링크 복사
                  </button>
                </div>
              </>,
              document.body,
            )}
          </div>
        </div>

        <div className="px-1" onClick={stopProp} onPointerDown={stopProp}>
          <div
            className={`flex items-center gap-2.5 min-h-[38px] px-3 py-1.5 rounded-xl border border-white/40 dark:border-border-subtle bg-white/30 dark:bg-bg-base/50 transition-all duration-200 ${
              !isReadOnly ? 'hover:bg-white/60 dark:hover:bg-bg-hover cursor-pointer hover:shadow-sm' : ''
            } ${isEditingAssignees ? 'bg-white dark:bg-bg-hover ring-2 ring-brand-500/15 border-brand-400/30 shadow-md' : ''}`}
            onClick={() => !isReadOnly && setIsEditingAssignees(true)}
          >
            <User size={14} strokeWidth={2.5} className="text-gray-400 dark:text-text-tertiary shrink-0" />
            <span className="text-[13px] font-bold text-gray-400 dark:text-text-tertiary shrink-0 uppercase tracking-widest">담당</span>
            {!isEditingAssignees ? (
              <div className="flex flex-wrap gap-1.5">
                {(project.assignees || []).length > 0 ? (
                  (project.assignees || []).map((assignee) => (
                    <span
                      key={assignee}
                      className="px-2.5 py-0.5 rounded-lg text-[13px] font-bold bg-white/60 dark:bg-bg-hover text-gray-700 dark:text-text-secondary border border-white/30 dark:border-border-subtle shadow-sm"
                    >
                      @{assignee}
                    </span>
                  ))
                ) : (
                  <span className="text-[13px] font-bold text-gray-300 dark:text-text-tertiary/50 italic">비어 있음</span>
                )}
              </div>
            ) : (
              <AssigneePicker
                value={project.assignees || []}
                selectedUserIds={project.assignee_user_ids || []}
                onChange={handleSaveAssignees}
                onCancel={() => setIsEditingAssignees(false)}
                onInvalidAssignee={onShowToast}
                isReadOnly={isReadOnly}
                placeholder="등록된 담당자 이름 입력"
                className="w-full"
              />
            )}
          </div>
        </div>
      </div>

      {/* Cards Area */}
      <div className={`flex-1 flex flex-col gap-4 p-3 min-h-[50px] overflow-y-auto no-scrollbar pb-12 rounded-b-[22px] ${projectTint.body} transition-colors duration-300`}>
        {hideCompleted && completedCount > 0 && (
          <div className="text-[11px] text-center text-gray-400 dark:text-text-tertiary py-1">
            완료된 항목 {completedCount}개 숨김
          </div>
        )}
        <SortableContext items={visibleItems.map(i => i.id)} strategy={verticalListSortingStrategy} disabled={isReadOnly}>
          {visibleItems.map((item, idx) => (
                <KanbanCard
                  key={item.id} item={item} itemIndex={idx + 1} projectId={project.id}
              onUpdateItem={onUpdateItem} onDeleteItem={onDeleteItem}
              onOpenDetail={onOpenDetail}
              onShowToast={onShowToast}
              isReadOnly={isReadOnly}
            />
          ))}
        </SortableContext>

        {hasMore && (
          <button
            className="w-full py-2.5 flex items-center justify-center gap-1.5 text-xs font-black text-gray-400 dark:text-text-tertiary hover:text-brand-500 dark:hover:text-brand-400 hover:bg-white/60 dark:hover:bg-bg-hover rounded-xl transition-all duration-200 cursor-pointer uppercase tracking-widest"
            onPointerDown={stopProp}
            onClick={() => setIsExpanded(prev => !prev)}
          >
            {isExpanded
              ? '접기 ▲'
              : `+ ${project.items.length - COLLAPSED_COUNT}개 더 보기 ▼`}
          </button>
        )}

        {!isReadOnly && !isCompletedView && (
          <div className="mt-1" onPointerDown={stopProp}>
            {!showAddItem ? (
              <button
                className="w-full py-3.5 flex items-center justify-center gap-2 text-sm text-gray-400 dark:text-text-tertiary font-black hover:bg-white/60 dark:hover:bg-bg-hover rounded-2xl transition-all duration-200 px-4 cursor-pointer group/add border border-dashed border-gray-300 dark:border-border-strong hover:border-brand-300 dark:hover:border-brand-500/50 hover:shadow-sm"
                onClick={() => setShowAddItem(true)}
              >
                <Plus size={18} strokeWidth={3} className="group-hover/add:text-brand-500 transition-colors" />
                <span className="group-hover/add:text-gray-900 dark:group-hover/add:text-text-primary transition-colors uppercase tracking-widest">새 업무 추가</span>
              </button>
            ) : (
              <div className="bg-white dark:bg-bg-elevated border border-gray-200 dark:border-border-subtle rounded-2xl shadow-2xl p-5 flex flex-col gap-4 animate-in fade-in zoom-in duration-300 ease-notion">
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-black text-text-tertiary uppercase tracking-[0.2em] ml-1">New Task</span>
                  <input
                    autoFocus
                    placeholder="어떤 업무를 추가할까요?"
                      className="w-full text-base font-bold text-gray-900 dark:text-text-primary border-none bg-transparent focus:ring-0 p-0 placeholder:text-gray-300 dark:placeholder:text-text-tertiary"
                      value={newItemTitle}
                      onChange={e => setNewItemTitle(e.target.value)}
                      onKeyDown={async e => {
                        if (e.key === 'Enter' && newItemTitle.trim()) {
                          await onAddItem(project.id, newItemTitle, '', currentUserId);
                          setNewItemTitle('');
                          setShowAddItem(false);
                          onShowToast?.(`'${newItemTitle}' 업무가 추가되었습니다.`);
                      } else if (e.key === 'Escape') {
                        setShowAddItem(false);
                      }
                    }}
                  />
                </div>
                <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-border-subtle pt-3">
                  <button className="px-4 py-2 text-[13px] font-bold text-gray-400 dark:text-text-tertiary hover:text-gray-900 dark:hover:text-text-primary cursor-pointer transition-colors uppercase tracking-widest" onClick={() => setShowAddItem(false)}>닫기</button>
                  <button
                    className="px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-[13px] font-black hover:bg-black dark:hover:bg-gray-100 transition-all shadow-md cursor-pointer uppercase tracking-widest active:scale-95"
                    onClick={async () => {
                      if (newItemTitle.trim()) {
                        await onAddItem(project.id, newItemTitle, '', currentUserId);
                        setNewItemTitle('');
                        setShowAddItem(false);
                        onShowToast?.(`'${newItemTitle}' 업무가 추가되었습니다.`);
                      }
                    }}
                  >
                    업무 생성
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
