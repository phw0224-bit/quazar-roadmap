/**
 * @fileoverview 칸반 컬럼 하나 (Phase/Project). DnD droppable + draggable 이중 역할.
 *
 * - 컬럼 자체: useSortable (가로 드래그로 순서 변경)
 * - 컬럼 내부: useDroppable (다른 컬럼에서 카드 드롭 수신)
 * - 컬럼 내 카드들: SortableContext(verticalListSortingStrategy)
 *
 * 색상 테마: PROJECT_TINTS 배열에서 phaseIndex % 4 로 결정.
 */
import { useEffect, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreHorizontal, Plus, Trash2, User, Link, Maximize2, EyeOff, CheckCircle2 } from 'lucide-react';
import KanbanCard from './KanbanCard';
import { PROJECT_TINTS } from '../lib/constants';

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
  phase: project, phaseIndex: projectIndex, isDragging: isDraggingProp = false,
  onAddItem, onUpdateItem, onDeleteItem, onUpdatePhase: onUpdateProject, onDeletePhase: onDeleteProject,
  onOpenDetail, onShowConfirm, onShowToast,
  onCompletePhase,
  isCompletedView = false,
  isReadOnly = false,
}) {
  const [showEditProject, setShowEditProject] = useState(false);
  const [isEditingAssignees, setIsEditingAssignees] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);

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
    data: { type: 'Phase', phase: project },
    disabled: isReadOnly || showEditProject || isEditingAssignees || showAddItem,
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
  const [editedProject, setEditedProject] = useState({ title: project.title });
  const [assigneeInput, setAssigneeInput] = useState((project.assignees || []).join(', '));

  useEffect(() => {
    if (isReadOnly) return;
    const kanbanItems = project.items.filter(item => !item.page_type || item.page_type === 'task');
    const allDone = kanbanItems.length > 0 && kanbanItems.every(item => item.status === 'done');
    if (allDone && !project.is_completed) {
      onCompletePhase?.(project.id, true);
    } else if (!allDone && project.is_completed) {
      onCompletePhase?.(project.id, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.items, isReadOnly]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setEditedProject({ title: project.title });
    setAssigneeInput((project.assignees || []).join(', '));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [project.id, project.title, project.assignees]);

  const handleSaveTitle = async () => {
    const newTitle = editedProject.title.trim();
    if (!newTitle || newTitle === project.title) {
      setEditedProject({ title: project.title });
      setShowEditProject(false);
      return;
    }
    setShowEditProject(false);
    await onUpdateProject(project.id, { title: newTitle });
    onShowToast?.('프로젝트 이름이 변경되었습니다.');
  };

  const handleSaveAssignees = async () => {
    const updated = assigneeInput.split(',').map((s) => s.trim()).filter((s) => s !== '');
    const current = (project.assignees || []);
    if (JSON.stringify(updated) === JSON.stringify(current)) {
      setIsEditingAssignees(false);
      return;
    }
    setIsEditingAssignees(false);
    await onUpdateProject(project.id, { assignees: updated });
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
      ${isDragging ? 'shadow-2xl ring-2 ring-blue-500 border-blue-500 bg-white dark:bg-bg-elevated scale-[1.02] z-[1000]' : ''}`}
    >
      {/* Column Header */}
      <div
        {...attributes}
        {...listeners}
        className={`group p-5 flex flex-col gap-4 rounded-t-[22px] border-b border-white/40 dark:border-border-subtle ${projectTint.header} backdrop-blur-md ${
          isReadOnly || showEditProject || isEditingAssignees ? '' : `cursor-grab active:cursor-grabbing transition-colors duration-200 ${projectTint.headerHover}`
        }`}
      >
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3 overflow-hidden" onClick={stopProp} onPointerDown={stopProp}>
            {!showEditProject ? (
              <h2
                className="text-lg font-black text-gray-900 dark:text-text-primary truncate tracking-tight cursor-text hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                onClick={() => !isReadOnly && setShowEditProject(true)}
              >
                {project.title}
              </h2>
            ) : (
              <input
                autoFocus
                className="text-lg font-black text-gray-900 dark:text-text-primary bg-white/50 dark:bg-bg-base border-none rounded-lg px-2 focus:ring-2 focus:ring-blue-500/30 w-full p-0 tracking-tight"
                value={editedProject.title}
                onChange={e => setEditedProject({title: e.target.value})}
                onBlur={handleSaveTitle}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') {
                    setEditedProject({ title: project.title });
                    setShowEditProject(false);
                  }
                }}
              />
            )}
            <span className="px-2.5 py-0.5 bg-white/60 dark:bg-bg-base border border-white/20 dark:border-border-subtle shadow-sm font-bold text-[13px] text-gray-500 dark:text-text-secondary rounded-full shrink-0 leading-none tabular-nums">
              {project.items.length}
            </span>
          </div>

          <div className="flex items-center gap-1" onClick={stopProp} onPointerDown={stopProp}>
            {!isReadOnly && (
              <button
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  project.is_completed
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    : 'text-gray-400 dark:text-text-tertiary hover:bg-white/60 dark:hover:bg-bg-hover hover:text-gray-900 dark:hover:text-text-primary'
                }`}
                title={project.is_completed ? '완료 해제' : '프로젝트 완료로 표시'}
                onClick={() => onCompletePhase?.(project.id, !project.is_completed)}
              >
                <CheckCircle2 size={14} strokeWidth={2.5} />
              </button>
            )}
            {completedCount > 0 && (
              <button
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  hideCompleted
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    : 'text-gray-400 dark:text-text-tertiary hover:bg-white/60 dark:hover:bg-bg-hover hover:text-gray-900 dark:hover:text-text-primary'
                }`}
                title={hideCompleted ? `완료 항목 표시 (${completedCount}개)` : `완료 항목 숨기기 (${completedCount}개)`}
                onClick={() => setHideCompleted(prev => !prev)}
              >
                <EyeOff size={14} strokeWidth={2.5} />
              </button>
            )}
            <button
              className="p-1.5 hover:bg-white/60 dark:hover:bg-bg-hover rounded-lg text-gray-400 dark:text-text-tertiary hover:text-gray-900 dark:hover:text-text-primary cursor-pointer transition-all"
              title="상세 페이지로 열기"
              onClick={() => onOpenDetail?.(project.id)}
            >
              <Maximize2 size={14} strokeWidth={2.5} />
            </button>
            <button
              className="p-1.5 hover:bg-white/60 dark:hover:bg-bg-hover rounded-lg text-gray-400 dark:text-text-tertiary hover:text-gray-900 dark:hover:text-text-primary cursor-pointer transition-all"
              title="링크 복사"
              onClick={() => {
                const url = `${window.location.origin}${window.location.pathname}?scrollTo=project:${project.id}`;
                navigator.clipboard.writeText(url).then(() => onShowToast?.('링크 복사됨'));
              }}
            >
              <Link size={14} strokeWidth={2.5} />
            </button>
            {!isReadOnly && (
              <button
                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-gray-400 dark:text-text-tertiary hover:text-red-500 dark:hover:text-red-400 cursor-pointer transition-all"
                onClick={() => onShowConfirm?.('프로젝트 삭제', `'${project.title}' 프로젝트를 삭제할까요? 관련 아이템도 모두 삭제됩니다.`, () => {
                  onDeleteProject(project.id);
                  onShowToast?.(`'${project.title}' 프로젝트가 삭제되었습니다.`);
                })}
              >
                <Trash2 size={14} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        <div className="px-1" onClick={stopProp} onPointerDown={stopProp}>
          <div
            className={`flex items-center gap-2.5 min-h-[38px] px-3 py-1.5 rounded-xl border border-white/40 dark:border-border-subtle bg-white/30 dark:bg-bg-base/50 transition-all duration-200 ${
              !isReadOnly ? 'hover:bg-white/60 dark:hover:bg-bg-hover cursor-pointer hover:shadow-sm' : ''
            } ${isEditingAssignees ? 'bg-white dark:bg-bg-hover ring-2 ring-blue-500/20 border-blue-500/30 shadow-md' : ''}`}
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
              <input
                autoFocus
                className="w-full bg-transparent border-none p-0 text-sm font-bold text-gray-800 dark:text-text-primary placeholder:text-gray-400 dark:placeholder:text-text-tertiary focus:ring-0 outline-none"
                placeholder="이름 입력 (쉼표로 구분)..."
                value={assigneeInput}
                onChange={(e) => setAssigneeInput(e.target.value)}
                onBlur={handleSaveAssignees}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') handleSaveAssignees();
                  if (e.key === 'Escape') {
                    setAssigneeInput((project.assignees || []).join(', '));
                    setIsEditingAssignees(false);
                  }
                }}
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
              key={item.id} item={item} itemIndex={idx + 1} phaseId={project.id}
              onUpdateItem={onUpdateItem} onDeleteItem={onDeleteItem}
              onOpenDetail={onOpenDetail}
              onShowConfirm={onShowConfirm}
              onShowToast={onShowToast}
              isReadOnly={isReadOnly}
            />
          ))}
        </SortableContext>

        {hasMore && (
          <button
            className="w-full py-2.5 flex items-center justify-center gap-1.5 text-xs font-black text-gray-400 dark:text-text-tertiary hover:text-blue-500 dark:hover:text-blue-400 hover:bg-white/60 dark:hover:bg-bg-hover rounded-xl transition-all duration-200 cursor-pointer uppercase tracking-widest"
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
                className="w-full py-3.5 flex items-center justify-center gap-2 text-sm text-gray-400 dark:text-text-tertiary font-black hover:bg-white/60 dark:hover:bg-bg-hover rounded-2xl transition-all duration-200 px-4 cursor-pointer group/add border border-dashed border-gray-300 dark:border-border-strong hover:border-blue-400 dark:hover:border-blue-500/50 hover:shadow-sm"
                onClick={() => setShowAddItem(true)}
              >
                <Plus size={18} strokeWidth={3} className="group-hover/add:text-blue-500 transition-colors" />
                <span className="group-hover/add:text-gray-900 dark:group-hover/add:text-text-primary transition-colors uppercase tracking-widest">새 업무 추가</span>
              </button>
            ) : (
              <div className="bg-white dark:bg-bg-elevated border border-gray-200 dark:border-border-subtle rounded-2xl shadow-2xl p-5 flex flex-col gap-4 animate-in fade-in zoom-in duration-300 ease-notion">
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-black text-blue-500 uppercase tracking-[0.2em] ml-1">New Task</span>
                  <input
                    autoFocus
                    placeholder="어떤 업무를 추가할까요?"
                    className="w-full text-base font-bold text-gray-900 dark:text-text-primary border-none bg-transparent focus:ring-0 p-0 placeholder:text-gray-300 dark:placeholder:text-text-tertiary"
                    value={newItemTitle}
                    onChange={e => setNewItemTitle(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && newItemTitle.trim()) {
                        await onAddItem(project.id, newItemTitle);
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
                        await onAddItem(project.id, newItemTitle);
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
