/**
 * @fileoverview 칸반 섹션 그룹. 여러 ProjectColumn을 묶는 컨테이너.
 *
 * useSortable로 섹션 자체도 드래그 가능 (섹션 간 순서 변경).
 * SortableContext(horizontalListSortingStrategy)로 내부 columns 가로 정렬.
 * 섹션 삭제 시 속한 projects는 삭제되지 않고 section_id만 null로 변경.
 */
import { useState } from 'react';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreHorizontal, GripVertical, Link } from 'lucide-react';
import ProjectColumn from './ProjectColumn';

export default function BoardSection({
  section,
  projects,
  isCollapsed,
  onToggleCollapse,
  onUpdateSection,
  onDeleteSection,
  onAddProject,
  onShowPrompt,
  showAddProjectButton = true,
  selectedTeam, selectedTag, selectedStatus,
  onAddItem, onUpdateItem, onDeleteItem, onUpdateProject, onDeleteProject,
  onCompleteProject,
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

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?scrollTo=section:${section.id}`;
    navigator.clipboard.writeText(url).then(() => onShowToast('링크 복사됨'));
  };

  return (
    <div
      id={`section-${section.id}`}
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-4 border border-gray-100 dark:border-border-subtle rounded-2xl p-6 bg-gray-50/50 dark:bg-bg-elevated/30 transition-colors duration-200 ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Section Header */}
      <div className="group flex items-center gap-3">
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
            className="text-lg font-black text-gray-900 dark:text-text-primary bg-white dark:bg-bg-base border border-brand-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20 w-48"
          />
        ) : (
          <h3
            onClick={() => !isReadOnly && setIsEditingTitle(true)}
            className={`text-lg font-black text-gray-900 dark:text-text-primary tracking-tight transition-colors ${!isReadOnly ? 'cursor-pointer hover:text-brand-600 dark:hover:text-brand-400' : ''}`}
          >
            {section.title}
          </h3>
        )}

        <span className="px-2 py-0.5 bg-gray-100 dark:bg-bg-hover text-gray-500 dark:text-text-tertiary rounded-md text-xs font-bold tabular-nums border border-gray-200 dark:border-border-subtle">
          {projects.length} 프로젝트
        </span>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleCopyLink}
            className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 dark:hover:bg-bg-hover text-gray-400 hover:text-gray-700 dark:hover:text-text-primary cursor-pointer"
            title="링크 복사"
          >
            <Link size={14} />
          </button>

          {!isReadOnly && showAddProjectButton && (<>
            <button
              onClick={() => onShowPrompt(
                `${section.title} — 프로젝트 추가`,
                '새 프로젝트의 이름을 입력하세요',
                (title) => {
                  if (title) {
                    onAddProject(title, section.board_type, section.id);
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
          </> )}
        </div>
      </div>

      {/* Projects inside section */}
      {!isCollapsed && (
        <div className="flex gap-12 overflow-x-auto py-3 pb-4 custom-scrollbar min-h-[300px] px-1">
          {projects.length > 0 ? (
            <SortableContext items={projects.map(p => p.id)} strategy={horizontalListSortingStrategy}>
              {projects.map((project, idx) => (
                <ProjectColumn
                  key={project.id}
                  project={project}
                  projectIndex={idx + 1}
                  selectedTeam={selectedTeam}
                  selectedTag={selectedTag}
                  selectedStatus={selectedStatus}
                  onAddItem={onAddItem}
                  onUpdateItem={onUpdateItem}
                  onDeleteItem={onDeleteItem}
                  onUpdateProject={onUpdateProject}
                  onDeleteProject={onDeleteProject}
                  onCompleteProject={onCompleteProject}
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
