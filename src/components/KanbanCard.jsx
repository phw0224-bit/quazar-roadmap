import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const STATUS_MAP = {
  'in-progress': { label: '진행 중', color: 'bg-blue-100 text-blue-800 ring-1 ring-blue-300 shadow-sm' },
  done: { label: '완료', color: 'bg-green-100 text-green-900 font-black ring-2 ring-green-300 shadow-md' },
};

const TEAM_COLORS = {
  '감정팀': 'bg-slate-200 text-slate-900 ring-1 ring-slate-400',
  '개발팀': 'bg-[#e2e8f0] text-gray-900 ring-1 ring-gray-400',
  'AI팀': 'bg-[#c6f6d5] text-green-900 ring-1 ring-green-400',
  '기획팀': 'bg-[#e9d8fd] text-purple-900 ring-1 ring-purple-400',
  '지원팀': 'bg-[#fed7e2] text-pink-900 ring-1 ring-pink-400',
};

const GLOBAL_TAGS = [
  { name: 'AI 핵심', color: 'bg-[#e0e7ff] text-[#312e81] ring-1 ring-[#a5b4fc]' },
  { name: 'B2B', color: 'bg-slate-100 text-slate-800 ring-1 ring-slate-300' },
  { name: '캐시카우', color: 'bg-slate-100 text-slate-700 ring-1 ring-slate-300' },
  { name: '핵심 단계', color: 'bg-[#fee2e2] text-[#991b1b] ring-1 ring-[#fca5a5]' },
  { name: '데이터 루프', color: 'bg-[#e6fffa] text-[#134e4a] ring-1 ring-[#5eead4]' },
  { name: '결제', color: 'bg-[#fdf2f8] text-[#831843] ring-1 ring-[#f9a8d4]' },
];

export default function KanbanCard({
  item, itemIndex, phaseId, accentColor, selectedTeam, selectedTag, selectedStatus,
  onUpdateItem, onDeleteItem, onOpenDetail, onShowConfirm, onShowToast,
  isDragging = false, isReadOnly = false,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ 
    id: item.id,
    disabled: isReadOnly,
  });
  
  const isDraggingAny = isSortableDragging || isDragging;
  
  const style = { 
    transform: CSS.Transform.toString(transform), 
    transition,
    zIndex: isDraggingAny ? 100 : 1,
    // DragOverlay용 스타일 (isDragging이 true일 때만 적용되는 부가 효과)
    ...(isDragging ? {
      transform: `${CSS.Transform.toString(transform)} scale(1.03)`, // 살짝 커짐
      cursor: 'grabbing',
    } : {})
  };

  const isTeamMatch = selectedTeam && (item.teams || []).includes(selectedTeam);
  const isTagMatch = selectedTag && (item.tags || []).includes(selectedTag);
  const isStatusMatch = selectedStatus && item.status === selectedStatus;
  const isHighlighted = isTeamMatch || isTagMatch || isStatusMatch;
  const isCompleted = item.status === 'done' || item.isSelected;

  const stopProp = (e) => e.stopPropagation();

  // 드래그앤드롭과 클릭 이벤트를 명확히 분리하기 위한 핸들러
  const handleOpenDetail = (e) => {
    if (isDraggingAny) return; // 드래그 중에는 클릭 방지
    e.stopPropagation();
    onOpenDetail?.(item.id);
  };

  return (
    <div
      ref={setNodeRef} style={style}
      className={`group relative border rounded-[12px] p-4 transition-all flex flex-col gap-3
      ${isReadOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}
      ${item.isSelected ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-900/10 ring-2 ring-blue-600/10' : 'bg-white dark:bg-[#252525] border-gray-200 dark:border-[#2f2f2f]'} 
      ${isCompleted ? 'opacity-70 saturate-75' : ''}
      ${isHighlighted ? 'border-3 !border-blue-500 shadow-lg ring-2 ring-blue-500/30 scale-[1.02] z-10' : 'shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-none hover:bg-gray-50 dark:hover:bg-[#2f2f2f]'}
      ${isSortableDragging ? 'opacity-30 dark:opacity-20 border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#1f1f1f] shadow-none pointer-events-none' : ''}
      ${isDragging ? 'shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_30px_60px_rgba(0,0,0,0.5)] !bg-white dark:!bg-[#2c2c2c] ring-1 ring-gray-100 dark:ring-gray-700 opacity-100 z-[1000]' : ''}`}
      {...attributes} {...listeners}
    >
      <div className="flex items-start gap-3">
        <div className={`text-[16px] font-black min-w-[20px] text-right pt-0.5 leading-none ${isHighlighted ? 'text-blue-500' : (accentColor || 'text-gray-300 dark:text-[#454545]')}`}>
          {itemIndex?.toString().padStart(2, '0')}
        </div>
        
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <h3 
                onPointerDown={stopProp}
                onClick={handleOpenDetail}
                className={`m-0 text-[18px] font-black leading-[1.3] tracking-tighter cursor-pointer hover:text-blue-500 hover:underline decoration-2 underline-offset-4 ${
                  isCompleted ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-[#E3E3E3]'
                }`}
              >
                {item.title || item.content}
              </h3>
              {item.title && item.content && (
                <p className={`m-0 text-[14px] font-bold leading-[1.6] ${isCompleted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-[#9B9B9B]'}`}>{item.content}</p>
              )}
            </div>
            
            <div className="flex flex-col items-end gap-2 flex-shrink-0" onPointerDown={stopProp}>
              {!isReadOnly && (
                <div 
                  onClick={() => onUpdateItem(phaseId, item.id, { isSelected: !item.isSelected })} 
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${item.isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-[#454545] bg-white dark:bg-[#252525] hover:border-blue-400 dark:hover:border-blue-500'}`}
                >
                  {item.isSelected && <span className="text-[12px] font-black">✓</span>}
                </div>
              )}
              {item.status && item.status !== 'none' && (
                <span className={`px-2 py-0.5 rounded-[3px] text-[12px] font-black tracking-tight shadow-sm whitespace-nowrap uppercase ${STATUS_MAP[item.status].color}`}>
                  {STATUS_MAP[item.status].label}
                </span>
              )}
            </div>
          </div>
          
          {/* Tags & People */}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {(item.tags || []).map(tagName => {
              const tagInfo = GLOBAL_TAGS.find(t => t.name === tagName);
              return tagInfo ? (
                <span key={tagName} className={`px-2 py-1 rounded-[3px] text-[12px] font-black tracking-tight shadow-md ${tagInfo.color}`}>
                  {tagName}
                </span>
              ) : null;
            })}
            {(item.teams || []).map(team => (
              <span key={team} className={`px-2.5 py-1 rounded-full text-[12px] font-black shadow-md ${TEAM_COLORS[team]}`}>
                {team}
              </span>
            ))}
            {(item.assignees || []).map(person => (
                <span key={person} className={`border px-2.5 py-1 rounded-full text-[12px] font-black shadow-md ${
                  isCompleted
                    ? 'bg-gray-100 dark:bg-[#303030] border-gray-200 dark:border-[#3d3d3d] text-gray-500 dark:text-gray-400'
                    : 'bg-white dark:bg-[#373737] border-gray-100 dark:border-[#454545] text-gray-800 dark:text-[#E3E3E3]'
                }`}>
                  👤 {person}
                </span>
              ))}
          </div>

          <div className="flex justify-between items-center mt-2.5" onPointerDown={stopProp}>
            <div className="flex gap-3">
              <button 
                className="text-[12px] text-gray-400 dark:text-[#9B9B9B] hover:text-blue-600 dark:hover:text-blue-400 font-black uppercase tracking-widest cursor-pointer flex items-center gap-1 bg-gray-50 dark:bg-[#2f2f2f] px-2 py-0.5 rounded transition-colors"
                onClick={handleOpenDetail}
              >
                OPEN ↗
              </button>
              {!isReadOnly && (
                <button 
                  className="text-[12px] text-gray-400 dark:text-[#9B9B9B] hover:text-red-600 dark:hover:text-red-400 font-black uppercase tracking-widest cursor-pointer transition-colors"
                  onClick={() => onShowConfirm?.('아이템 삭제', `"${item.title || item.content}" 업무를 삭제할까요?`, () => {
                    onDeleteItem(phaseId, item.id);
                    onShowToast?.('업무가 삭제되었습니다.');
                  })}
                >
                  DEL
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(item.comments || []).length > 0 && (
                <div className="flex items-center gap-1 text-[12px] font-black text-gray-400 dark:text-[#9B9B9B] bg-gray-50 dark:bg-[#2f2f2f] px-1.5 py-0.5 rounded">
                  <span>💬</span> {item.comments.length}
                </div>
              )}
              {item.description && (
                <div className="flex items-center gap-1 text-[12px] font-black text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded" title="상세 설명 있음">
                  <span>📝</span> Wiki
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
