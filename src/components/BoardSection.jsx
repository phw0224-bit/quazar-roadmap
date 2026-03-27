import { useState } from 'react';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreHorizontal, GripVertical } from 'lucide-react';
import ProjectColumn from './ProjectColumn';

export default function BoardSection({
  section,
  phases,
  isCollapsed,
  onToggleCollapse,
  onUpdateSection,
  onDeleteSection,
  onAddPhase,
  onShowPrompt,
  selectedTeam, selectedTag, selectedStatus,
  onAddItem, onUpdateItem, onDeleteItem, onUpdatePhase, onDeletePhase,
  onOpenDetail, onShowConfirm, onShowToast,
  isReadOnly,
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(section.title);
  const [showMenu, setShowMenu] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: section.id,
    data: { type: 'Section', section },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSaveTitle = async () => {
    const trimmed = titleInput.trim();
    if (trimmed && trimmed !== section.title) {
      await onUpdateSection(section.id, { title: trimmed });
    } else {
      setTitleInput(section.title);
    }
    setIsEditingTitle(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-4 border border-gray-100 dark:border-border-subtle rounded-2xl p-6 bg-gray-50/50 dark:bg-bg-elevated/30 transition-colors duration-200 ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Section Header */}
      <div className="flex items-center gap-3">
        {!isReadOnly && (
          <button
            {...attributes}
            {...listeners}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 dark:hover:bg-bg-hover transition-all text-gray-300 hover:text-gray-500 dark:hover:text-text-secondary cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={16} />
          </button>
        )}

        <button
          onClick={onToggleCollapse}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 dark:hover:bg-bg-hover transition-all text-gray-400 hover:text-gray-700 dark:hover:text-text-primary cursor-pointer"
        >
          <span className={`transform transition-transform duration-200 text-sm leading-none ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>▼</span>
        </button>

        {isEditingTitle ? (
          <input
            autoFocus
            value={titleInput}
            onChange={e => setTitleInput(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSaveTitle();
              if (e.key === 'Escape') { setTitleInput(section.title); setIsEditingTitle(false); }
            }}
            className="text-lg font-black text-gray-900 dark:text-text-primary bg-white dark:bg-bg-base border border-blue-400 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-48"
          />
        ) : (
          <h3
            onClick={() => !isReadOnly && setIsEditingTitle(true)}
            className={`text-lg font-black text-gray-900 dark:text-text-primary tracking-tight transition-colors ${!isReadOnly ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400' : ''}`}
          >
            {section.title}
          </h3>
        )}

        <span className="px-2 py-0.5 bg-gray-100 dark:bg-bg-hover text-gray-500 dark:text-text-tertiary rounded-md text-xs font-bold tabular-nums border border-gray-200 dark:border-border-subtle">
          {phases.length} 프로젝트
        </span>

        {!isReadOnly && (
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => onShowPrompt(
                `${section.title} — 프로젝트 추가`,
                '새 프로젝트의 이름을 입력하세요',
                (title) => {
                  if (title) {
                    onAddPhase(title, section.board_type, section.id);
                    onShowToast(`'${title}' 프로젝트가 생성되었습니다.`);
                  }
                }
              )}
              className="px-3 py-1.5 bg-white dark:bg-bg-base text-gray-500 dark:text-text-secondary rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-bg-hover border border-dashed border-gray-300 dark:border-border-strong transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="text-base leading-none">+</span>
              프로젝트 추가
            </button>

            <div className="relative">
              <button
                onClick={() => setShowMenu(v => !v)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 dark:hover:bg-bg-hover transition-all text-gray-400 hover:text-gray-700 dark:hover:text-text-primary cursor-pointer"
              >
                <MoreHorizontal size={16} />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-8 bg-white dark:bg-bg-elevated border border-gray-100 dark:border-border-subtle rounded-xl shadow-xl z-50 min-w-[140px] overflow-hidden">
                    <button
                      onClick={() => { setIsEditingTitle(true); setShowMenu(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 dark:text-text-secondary hover:bg-gray-50 dark:hover:bg-bg-hover transition-colors"
                    >
                      이름 수정
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onShowConfirm(
                          '섹션 삭제',
                          `'${section.title}' 섹션을 삭제합니다. 소속 프로젝트는 보드로 이동됩니다.`,
                          () => onDeleteSection(section.id),
                        );
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Projects inside section */}
      {!isCollapsed && (
        <div className="flex gap-12 overflow-x-auto pb-4 custom-scrollbar min-h-[300px] px-1">
          {phases.length > 0 ? (
            <SortableContext items={phases.map(p => p.id)} strategy={horizontalListSortingStrategy}>
              {phases.map((phase, idx) => (
                <ProjectColumn
                  key={phase.id}
                  phase={phase}
                  phaseIndex={idx + 1}
                  selectedTeam={selectedTeam}
                  selectedTag={selectedTag}
                  selectedStatus={selectedStatus}
                  onAddItem={onAddItem}
                  onUpdateItem={onUpdateItem}
                  onDeleteItem={onDeleteItem}
                  onUpdatePhase={onUpdatePhase}
                  onDeletePhase={onDeletePhase}
                  onOpenDetail={onOpenDetail}
                  onShowConfirm={onShowConfirm}
                  onShowToast={onShowToast}
                  isReadOnly={isReadOnly}
                />
              ))}
            </SortableContext>
          ) : (
            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-100 dark:border-border-subtle rounded-2xl py-16">
              <p className="text-gray-400 dark:text-text-tertiary font-bold text-sm">이 섹션에는 프로젝트가 없습니다.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
