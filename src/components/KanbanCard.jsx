/**
 * @fileoverview 칸반 보드에서 아이템을 빠르게 훑기 위한 요약 카드 컴포넌트.
 *
 * 카드에는 제목, 기간, 상태, 담당자만 남겨 보드 스캔 속도를 높이고,
 * 세부 메타데이터와 조작은 ItemDetailPanel에서 처리한다.
 *
 * 기본 상태에서는 카드 전체 클릭으로 상세 패널을 열고,
 * "위치 변경"을 켰을 때만 별도 드래그 핸들로 정렬 이동을 허용한다.
 */
import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, GripVertical, MoreHorizontal } from 'lucide-react';
import { STATUS_MAP, PRIORITY_MAP } from '../lib/constants';

function formatDateRange(startDate, endDate) {
  if (startDate && endDate) return `${startDate} ~ ${endDate}`;
  return startDate || endDate || '';
}

function formatAssignees(assignees = []) {
  if (assignees.length === 0) return '';
  if (assignees.length <= 2) return assignees.join(', ');
  return `${assignees.slice(0, 2).join(', ')} 외 ${assignees.length - 2}명`;
}

export default function KanbanCard({
  item,
  onOpenDetail,
  isDragging = false,
  isReadOnly = false,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isMoveMode, setIsMoveMode] = useState(false);
  const menuRef = useRef(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({
    id: item.id,
    disabled: isReadOnly || !isMoveMode,
  });

  const isDraggingAny = isSortableDragging || isDragging;
  const title = item.title || item.content;
  const dateRange = formatDateRange(item.start_date, item.end_date);
  const assigneeText = formatAssignees(item.assignees || []);
  const statusLabel = item.status && item.status !== 'none' ? STATUS_MAP[item.status]?.label : '';
  const isCompleted = item.status === 'done';
  const priorityBorderColor = PRIORITY_MAP[item.priority || 0]?.borderColor;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDraggingAny ? 'none' : transition,
    zIndex: isDraggingAny ? 100 : 1,
    ...(priorityBorderColor ? { borderLeftColor: priorityBorderColor, borderLeftWidth: '3px' } : {}),
    ...(isDragging ? {
      transform: `${CSS.Transform.toString(transform)} scale(1.03)`,
      cursor: 'grabbing',
    } : {}),
  };

  const handleOpenDetail = (e) => {
    if (isDraggingAny || isMoveMode) return;
    e.stopPropagation();
    onOpenDetail?.(item.id);
  };

  const stopProp = (e) => {
    e.stopPropagation();
  };

  useEffect(() => {
    if (!showMenu) return undefined;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative w-full ${priorityBorderColor ? 'rounded-r-xl' : 'rounded-xl'} border px-4 py-3 text-left transition-all duration-200 ease-notion
      ${isMoveMode && !isReadOnly ? 'cursor-default' : ''}
      ${isCompleted
        ? 'border-emerald-200 bg-emerald-50/35 dark:border-emerald-900/40 dark:bg-emerald-950/10'
        : 'bg-white dark:bg-bg-elevated border-gray-200/80 dark:border-border-subtle shadow-sm dark:shadow-none'}
      hover:border-gray-300 dark:hover:border-border-strong hover:shadow-md dark:hover:bg-bg-hover
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30
      ${isSortableDragging ? 'opacity-20 border-2 border-dashed border-gray-300 dark:border-border-strong bg-gray-50 dark:bg-bg-base shadow-none pointer-events-none' : ''}
      ${isDragging ? 'shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] !bg-white dark:!bg-bg-hover ring-2 ring-blue-500/30 opacity-100 z-[1000]' : ''}`}
    >
      {!isDragging && !isReadOnly && (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5" ref={menuRef}>
          {isMoveMode && (
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:border-border-subtle dark:bg-bg-hover dark:text-text-secondary dark:hover:text-text-primary cursor-grab active:cursor-grabbing"
              title="드래그해서 위치 이동"
              onPointerDown={stopProp}
              onClick={stopProp}
              {...attributes}
              {...listeners}
            >
              <GripVertical size={14} strokeWidth={2.2} />
            </button>
          )}
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-text-tertiary dark:hover:bg-bg-hover dark:hover:text-text-primary"
            title="카드 메뉴"
            onPointerDown={stopProp}
            onClick={(e) => {
              stopProp(e);
              setShowMenu((prev) => !prev);
            }}
          >
            <MoreHorizontal size={15} strokeWidth={2.2} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-8 min-w-[140px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-border-subtle dark:bg-bg-elevated">
              <button
                type="button"
                className="block w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-text-secondary dark:hover:bg-bg-hover"
                onClick={(e) => {
                  stopProp(e);
                  setIsMoveMode(true);
                  setShowMenu(false);
                }}
              >
                위치 변경
              </button>
            </div>
          )}
        </div>
      )}

      <div
        className={`flex flex-col gap-2 ${!isReadOnly && !isMoveMode ? 'cursor-pointer' : 'cursor-default'} ${!isDragging && !isReadOnly ? 'pr-12' : ''}`}
        onClick={handleOpenDetail}
      >
        <h3
          className={`m-0 line-clamp-2 text-[15px] font-semibold leading-5 tracking-[-0.01em]
          ${isCompleted
            ? 'text-gray-500 dark:text-text-secondary'
            : 'text-gray-900 dark:text-text-primary'}`}
        >
          {title}
        </h3>

        {(dateRange || statusLabel) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-4">
            {dateRange && (
              <span className="inline-flex items-center gap-1 text-gray-500 dark:text-text-secondary">
                <Calendar size={11} strokeWidth={2.25} />
                <span>{dateRange}</span>
              </span>
            )}
            {statusLabel && (
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold
                ${isCompleted
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-bg-hover dark:text-text-secondary'}`}
              >
                {statusLabel}
              </span>
            )}
          </div>
        )}

        {assigneeText && (
          <p className="m-0 truncate text-[12px] font-medium leading-4 text-gray-500 dark:text-text-secondary">
            {assigneeText}
          </p>
        )}

        {isMoveMode && !isDragging && (
          <div className="flex items-center justify-between gap-2">
            <p className="m-0 text-[11px] font-medium leading-4 text-blue-600 dark:text-blue-400">
              우측 핸들을 잡고 위치를 이동하세요.
            </p>
            <button
              type="button"
              className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-text-secondary dark:hover:bg-bg-hover dark:hover:text-text-primary"
              onPointerDown={stopProp}
              onClick={(e) => {
                stopProp(e);
                setIsMoveMode(false);
              }}
            >
              종료
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
