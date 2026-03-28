import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MessageSquare, FileText, ExternalLink, Trash2, Calendar } from 'lucide-react';
import { STATUS_MAP, TEAM_COLORS, GLOBAL_TAGS, PRIORITY_MAP } from '../lib/constants';

export default function KanbanCard({
  item, itemIndex, phaseId, accentColor,
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
    transition: isDraggingAny ? 'none' : transition,
    zIndex: isDraggingAny ? 100 : 1,
    ...(isDragging ? {
      transform: `${CSS.Transform.toString(transform)} scale(1.04) rotate(1deg)`,
      cursor: 'grabbing',
    } : {})
  };

  const isCompleted = item.status === 'done';

  const stopProp = (e) => e.stopPropagation();

  const handleOpenDetail = (e) => {
    if (isDraggingAny) return;
    e.stopPropagation();
    onOpenDetail?.(item.id);
  };

  return (
    <div
      ref={setNodeRef} style={style}
      className={`group relative border rounded-2xl p-5 transition-all duration-300 ease-notion flex flex-col gap-4
      ${isReadOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}
      ${isCompleted ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/10 ring-2 ring-emerald-500/20 opacity-60 saturate-50' : 'bg-white dark:bg-bg-elevated border-gray-100 dark:border-border-subtle shadow-sm dark:shadow-none'}
      hover:border-gray-300 dark:hover:border-border-strong hover:shadow-md dark:hover:bg-bg-hover
      ${isSortableDragging ? 'opacity-20 border-2 border-dashed border-gray-300 dark:border-border-strong bg-gray-50 dark:bg-bg-base shadow-none pointer-events-none' : ''}
      ${isDragging ? 'shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] !bg-white dark:!bg-bg-hover ring-2 ring-blue-500/30 opacity-100 z-[1000]' : ''}`}
      {...attributes} {...listeners}
    >
      <div className="flex items-start gap-4">
        <div className={`font-mono text-[13px] font-black min-w-[32px] text-right pt-1 leading-none tabular-nums tracking-tighter ${accentColor || 'text-gray-300 dark:text-text-tertiary'}`}>
          {itemIndex?.toString().padStart(2, '0')}
        </div>

        <div className="flex-1 flex flex-col gap-2">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 flex flex-col gap-1.5">
              <h3
                onPointerDown={stopProp}
                onClick={(e) => { e.stopPropagation(); handleOpenDetail(e); }}
                className={`m-0 text-lg font-black leading-tight transition-colors cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 ${
                  isCompleted ? 'text-gray-500 dark:text-text-secondary line-through' : 'text-gray-900 dark:text-text-primary'
                }`}
              >
                {item.title || item.content}
              </h3>
              {item.title && item.content && (
                <p className={`m-0 text-sm font-medium leading-relaxed ${isCompleted ? 'text-gray-400 dark:text-text-secondary/50' : 'text-gray-500 dark:text-text-secondary'}`}>{item.content}</p>
              )}
            </div>

            <div className="flex flex-col items-end gap-3 flex-shrink-0" onPointerDown={stopProp}>
              {!isReadOnly && (
                <button
                  onClick={() => {
                    const nextStatus = isCompleted ? 'none' : 'done';
                    onUpdateItem(phaseId, item.id, { status: nextStatus });
                    onShowToast?.(isCompleted ? '완료 표시를 해제했습니다.' : '완료로 표시했습니다.');
                  }}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all duration-200 ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg scale-110' : 'border-gray-200 dark:border-border-strong bg-white dark:bg-bg-base hover:border-emerald-400 dark:hover:border-emerald-500'}`}
                >
                  {isCompleted && <span className="text-[13px] font-black">✓</span>}
                </button>
              )}
              {item.status && item.status !== 'none' && (
                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest shadow-sm whitespace-nowrap border border-white/20 dark:border-black/10 ${STATUS_MAP[item.status].color}`}>
                  {STATUS_MAP[item.status].label}
                </span>
              )}
            </div>
          </div>

          {/* Tags & People */}
          <div className="flex flex-wrap gap-2 mt-1">
            {(item.tags || []).map(tagName => {
              const tagInfo = GLOBAL_TAGS.find(t => t.name === tagName);
              return tagInfo ? (
                <span key={tagName} className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-black uppercase tracking-wider shadow-sm flex items-center justify-center leading-none ${tagInfo.color}`}>
                  #{tagName}
                </span>
              ) : null;
            })}
            {(item.teams || []).map(team => (
              <span key={team} className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-widest shadow-sm flex items-center justify-center leading-none ${TEAM_COLORS[team]}`}>
                {team}
              </span>
            ))}
            {(item.assignees || []).map(person => (
                <span key={person} className={`border px-3 py-1 rounded-full text-[13px] font-bold shadow-sm transition-all duration-200 flex items-center gap-1.5 leading-none ${
                  isCompleted
                    ? 'bg-gray-100/50 dark:bg-bg-base border-gray-200 dark:border-border-subtle text-gray-400 dark:text-text-tertiary'
                    : 'bg-white dark:bg-bg-hover border-gray-100 dark:border-border-strong text-gray-700 dark:text-text-secondary hover:shadow-md'
                }`}>
                  <span className="text-[11px]">👤</span> {person}
                </span>
              ))}
          </div>

          {/* 날짜 / 우선순위 */}
          {(item.start_date || item.end_date || (item.priority > 0)) && (
            <div className="flex flex-wrap items-center gap-2 mt-1" onPointerDown={stopProp}>
              {item.priority > 0 && PRIORITY_MAP[item.priority] && (
                <span className={`text-[11px] font-black ${PRIORITY_MAP[item.priority].color}`}>
                  {PRIORITY_MAP[item.priority].icon} {PRIORITY_MAP[item.priority].label}
                </span>
              )}
              {(item.start_date || item.end_date) && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-gray-400 dark:text-text-tertiary">
                  <Calendar size={10} strokeWidth={2.5} />
                  {item.start_date && item.end_date
                    ? `${item.start_date} → ${item.end_date}`
                    : item.start_date || item.end_date}
                </span>
              )}
            </div>
          )}

          <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-50 dark:border-border-subtle/50" onPointerDown={stopProp}>
            <div className="flex gap-4">
              <button
                className="text-[13px] font-black text-gray-400 dark:text-text-tertiary hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer flex items-center gap-1.5 bg-gray-50 dark:bg-bg-hover px-2.5 py-1 rounded-lg transition-all duration-200 uppercase tracking-widest hover:shadow-sm"
                onClick={handleOpenDetail}
              >
                <ExternalLink size={12} strokeWidth={3} />
                열기
              </button>
              {!isReadOnly && (
                <button
                  className="text-[13px] font-black text-gray-400 dark:text-text-tertiary hover:text-red-500 dark:hover:text-red-400 cursor-pointer transition-colors uppercase tracking-widest flex items-center gap-1.5 px-1"
                  onClick={() => onShowConfirm?.('아이템 삭제', `"${item.title || item.content}" 업무를 삭제할까요?`, () => {
                    onDeleteItem(phaseId, item.id);
                    onShowToast?.('업무가 삭제되었습니다.');
                  })}
                >
                  <Trash2 size={12} strokeWidth={3} />
                  삭제
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {(item.comments || []).length > 0 && (
                <div className="flex items-center gap-1.5 font-mono text-[13px] font-bold text-gray-400 dark:text-text-tertiary bg-gray-50 dark:bg-bg-hover px-2 py-1 rounded-lg tabular-nums border border-gray-100 dark:border-border-subtle/50">
                  <MessageSquare size={12} strokeWidth={3} className="text-gray-300 dark:text-text-tertiary" />
                  {item.comments.length}
                </div>
              )}
              {item.description && (
                <div className="flex items-center gap-1.5 text-[13px] font-bold text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg border border-blue-100 dark:border-blue-900/30 uppercase tracking-tighter" title="상세 설명 있음">
                  <FileText size={12} strokeWidth={3} />
                  Wiki
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
