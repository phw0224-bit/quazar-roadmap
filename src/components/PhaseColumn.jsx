import { useEffect, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import KanbanCard from './KanbanCard';

const TEAM_COLORS = {
  '감정팀': 'bg-slate-200 text-slate-800',
  '개발팀': 'bg-[#e2e8f0] text-gray-700',
  'AI팀': 'bg-[#c6f6d5] text-green-800',
  '기획팀': 'bg-[#e9d8fd] text-purple-800',
  '지원팀': 'bg-[#fed7e2] text-pink-800',
};

const PHASE_TINTS = [
  {
    column: 'bg-sky-50/45 dark:bg-[#202b35]/72 border-sky-100/80 dark:border-[#30404f]',
    header: 'bg-sky-100/55 dark:bg-[#293847]/82',
    headerHover: 'hover:bg-sky-100/75 dark:hover:bg-[#324557]',
    body: 'bg-sky-50/25 dark:bg-[#1d2730]/58',
  },
  {
    column: 'bg-violet-50/45 dark:bg-[#2a2435]/72 border-violet-100/80 dark:border-[#403751]',
    header: 'bg-violet-100/55 dark:bg-[#332c43]/82',
    headerHover: 'hover:bg-violet-100/75 dark:hover:bg-[#3d3550]',
    body: 'bg-violet-50/25 dark:bg-[#241f2f]/58',
  },
  {
    column: 'bg-emerald-50/45 dark:bg-[#1f2f2a]/72 border-emerald-100/80 dark:border-[#32453f]',
    header: 'bg-emerald-100/55 dark:bg-[#2a3d36]/82',
    headerHover: 'hover:bg-emerald-100/75 dark:hover:bg-[#33493f]',
    body: 'bg-emerald-50/25 dark:bg-[#1c2924]/58',
  },
  {
    column: 'bg-slate-50/45 dark:bg-[#252a2f]/72 border-slate-100/80 dark:border-[#3a414a]',
    header: 'bg-slate-100/55 dark:bg-[#2f3640]/82',
    headerHover: 'hover:bg-slate-100/75 dark:hover:bg-[#38424e]',
    body: 'bg-slate-50/25 dark:bg-[#20262e]/58',
  },
];

function getPhaseTint(phaseId, phaseIndex) {
  if (Number.isInteger(phaseIndex)) {
    return PHASE_TINTS[Math.abs(phaseIndex) % PHASE_TINTS.length];
  }

  const hash = String(phaseId || '')
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return PHASE_TINTS[hash % PHASE_TINTS.length];
}

export default function PhaseColumn({
  phase, phaseIndex, selectedTeam, selectedTag, selectedStatus, isDragging: isDraggingProp = false,
  onAddItem, onUpdateItem, onDeleteItem, onUpdatePhase, onDeletePhase,
  onAddComment, onUpdateComment, onDeleteComment,
  onOpenDetail, onShowConfirm, onShowToast,
  isReadOnly = false,
}) {
  const { setNodeRef: setDroppableRef } = useDroppable({ id: phase.id });
  const { attributes, listeners, setNodeRef: setSortableRef, transform, transition, isDragging: isSortableDragging } = useSortable({
    id: phase.id, data: { type: 'Phase', phase },
    disabled: isReadOnly,
  });

  const isDragging = isDraggingProp || isSortableDragging;
  const style = { 
    transform: CSS.Transform.toString(transform), 
    transition, 
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 100 : 1,
  };
  const setNodeRef = (node) => { setDroppableRef(node); setSortableRef(node); };

  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [showEditPhase, setShowEditPhase] = useState(false);
  const [editedPhase, setEditedPhase] = useState({ title: phase.title });
  const [isEditingAssignees, setIsEditingAssignees] = useState(false);
  const [assigneeInput, setAssigneeInput] = useState((phase.assignees || []).join(', '));

  useEffect(() => {
    setEditedPhase({ title: phase.title });
    setAssigneeInput((phase.assignees || []).join(', '));
    setIsEditingAssignees(false);
  }, [phase.id, phase.title, phase.assignees]);

  const handleSaveAssignees = async () => {
    const updated = assigneeInput.split(',').map((s) => s.trim()).filter((s) => s !== '');
    await onUpdatePhase(phase.id, { assignees: updated });
    setIsEditingAssignees(false);
    onShowToast?.('페이즈 담당자가 업데이트되었습니다.');
  };

  // 필터링 강조 로직
  const isTeamMatch = selectedTeam && (phase.teams || []).includes(selectedTeam);
  const isTagMatch = selectedTag && phase.items.some(item => (item.tags || []).includes(selectedTag));
  const isHighlighted = isTeamMatch || isTagMatch;
  const phaseTint = getPhaseTint(phase.id, phaseIndex);

  const stopProp = (e) => e.stopPropagation();

  return (
    <div 
      id={`phase-${phase.id}`}
      ref={setNodeRef} style={style}
      className={`flex flex-col min-w-[320px] max-w-[320px] h-full transition-all rounded-2xl border ${phaseTint.column}
      ${isHighlighted ? 'ring-2 ring-blue-500/35' : ''}
      ${isDragging ? 'shadow-2xl ring-2 ring-blue-500 border-blue-500 bg-white dark:bg-[#252525] rotate-1 scale-[1.02]' : ''}`}
    >
      {/* Column Header */}
      <div
        {...attributes}
        {...listeners}
        className={`group p-4 flex flex-col gap-2 rounded-t-2xl border-b border-white/45 dark:border-[#3a3a3a] ${phaseTint.header} backdrop-blur-sm ${
          isReadOnly ? '' : `cursor-grab active:cursor-grabbing transition-colors ${phaseTint.headerHover}`
        }`}
      >
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3 overflow-hidden">
            {!showEditPhase ? (
              <h2 className="text-[15px] font-black text-gray-900 dark:text-[#F1F1F1] truncate uppercase tracking-tight">
                {phase.title}
              </h2>
            ) : (
              <input 
                autoFocus
                className="text-[15px] font-black text-gray-900 dark:text-[#F5F5F5] bg-gray-100 dark:bg-[#353535] border-none rounded px-1 focus:ring-0 w-full p-0"
                value={editedPhase.title}
                onChange={e => setEditedPhase({title: e.target.value})}
                onBlur={() => { onUpdatePhase(phase.id, editedPhase); setShowEditPhase(false); }}
                onKeyDown={e => e.key === 'Enter' && (onUpdatePhase(phase.id, editedPhase) || setShowEditPhase(false))}
              />
            )}
            <span className="px-2 py-0.5 bg-gray-200 dark:bg-[#3a3a3a] text-[11px] font-black text-gray-700 dark:text-[#D2D2D2] rounded-full shrink-0 leading-none">
              {phase.items.length}
            </span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={stopProp} onPointerDown={stopProp}>
            {!isReadOnly && (
              <>
                <button 
                  className="p-1 hover:bg-gray-100 dark:hover:bg-[#3a3a3a] rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer" 
                  onClick={() => setShowEditPhase(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
                </button>
                <button 
                  className="p-1 hover:bg-gray-100 dark:hover:bg-[#3a3a3a] rounded text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 cursor-pointer" 
                  onClick={() => onShowConfirm?.('단계 삭제', `${phase.title} 단계를 삭제할까요? 관련 아이템도 모두 삭제됩니다.`, () => {
                    onDeletePhase(phase.id);
                    onShowToast?.(`${phase.title} 단계가 삭제되었습니다.`);
                  })}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="px-1" onClick={stopProp} onPointerDown={stopProp}>
          <div
            className={`flex items-center gap-2 min-h-[30px] px-2 py-1 rounded-lg border border-gray-100 dark:border-[#363636] bg-gray-50/80 dark:bg-[#262626]/90 transition-colors ${
              !isReadOnly ? 'hover:bg-gray-100 dark:hover:bg-[#323232] cursor-pointer' : ''
            } ${isEditingAssignees ? 'bg-gray-100 dark:bg-[#353535]' : ''}`}
            onClick={() => !isReadOnly && setIsEditingAssignees(true)}
          >
            <span className="text-[11px] font-black text-gray-600 dark:text-[#BCBCBC] shrink-0">담당</span>
            {!isEditingAssignees ? (
              <div className="flex flex-wrap gap-1.5">
                {(phase.assignees || []).length > 0 ? (
                  (phase.assignees || []).map((assignee) => (
                    <span
                      key={assignee}
                      className="px-2 py-0.5 rounded-full text-[11px] font-black bg-gray-200 dark:bg-[#414141] text-gray-800 dark:text-[#F0F0F0]"
                    >
                      @{assignee}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] font-bold text-gray-500 dark:text-[#9D9D9D]">비어 있음</span>
                )}
              </div>
            ) : (
              <input
                autoFocus
                className="w-full bg-transparent border-none p-0 text-[12px] font-bold text-gray-800 dark:text-[#EFEFEF] placeholder:text-gray-400 dark:placeholder:text-[#989898] focus:ring-0 outline-none"
                placeholder="이름 입력 (쉼표로 구분)..."
                value={assigneeInput}
                onChange={(e) => setAssigneeInput(e.target.value)}
                onBlur={handleSaveAssignees}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveAssignees();
                  if (e.key === 'Escape') {
                    setAssigneeInput((phase.assignees || []).join(', '));
                    setIsEditingAssignees(false);
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Cards Area */}
      <div className={`flex-1 flex flex-col gap-3 p-2 min-h-[50px] overflow-y-auto no-scrollbar pb-10 rounded-b-2xl ${phaseTint.body}`}>
        <SortableContext items={phase.items.map(i => i.id)} strategy={verticalListSortingStrategy} disabled={isReadOnly}>
          {phase.items.map((item, idx) => (
            <KanbanCard
              key={item.id} item={item} itemIndex={idx + 1} phaseId={phase.id}
              selectedTeam={selectedTeam} selectedTag={selectedTag} selectedStatus={selectedStatus}
              onUpdateItem={onUpdateItem} onDeleteItem={onDeleteItem}
              onOpenDetail={onOpenDetail}
              onShowConfirm={onShowConfirm}
              onShowToast={onShowToast}
              isReadOnly={isReadOnly}
            />
          ))}
        </SortableContext>

        {!isReadOnly && (
          <div className="mt-1" onPointerDown={stopProp}>
            {!showAddItem ? (
              <button 
                className="w-full py-2 flex items-center gap-2 text-[13px] text-gray-400 dark:text-gray-500 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors px-2 cursor-pointer"
                onClick={() => setShowAddItem(true)}
              >
                <span className="text-lg">+</span> New
              </button>
            ) : (
              <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#2f2f2f] rounded-xl shadow-xl p-4 flex flex-col gap-3 animate-in fade-in zoom-in duration-200">
                <input 
                  autoFocus
                  placeholder="제목 입력..." 
                  className="w-full text-[14px] font-bold text-gray-800 dark:text-gray-200 border-none bg-transparent focus:ring-0 p-0"
                  value={newItemTitle} 
                  onChange={e => setNewItemTitle(e.target.value)} 
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && newItemTitle.trim()) {
                      await onAddItem(phase.id, newItemTitle);
                      setNewItemTitle('');
                      setShowAddItem(false);
                      onShowToast?.('업무가 추가되었습니다.');
                    } else if (e.key === 'Escape') {
                      setShowAddItem(false);
                    }
                  }}
                />
                <div className="flex justify-end gap-2 border-t border-gray-50 dark:border-gray-800 pt-2">
                  <button className="px-2 py-1 text-[11px] font-black text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 cursor-pointer" onClick={() => setShowAddItem(false)}>취소</button>
                  <button 
                    className="px-3 py-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-[11px] font-black hover:bg-black dark:hover:bg-gray-200 transition-colors cursor-pointer"
                    onClick={async () => {
                      if (newItemTitle.trim()) {
                        await onAddItem(phase.id, newItemTitle);
                        setNewItemTitle('');
                        setShowAddItem(false);
                        onShowToast?.('업무가 추가되었습니다.');
                      }
                    }}
                  >
                    추가
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
