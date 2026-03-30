import { useState, useEffect, useRef, useMemo } from 'react';
import { PRIORITY_MAP } from '../lib/constants';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import kanbanAPI from '../api/kanbanAPI';

const ZOOM = {
  week:    { dayWidth: 80, tickEvery: 1  },
  month:   { dayWidth: 22, tickEvery: 7  },
  quarter: { dayWidth: 8,  tickEvery: 14 },
};

const LEFT_W    = 260;
const ROW_H     = 44;
const PHASE_H   = 52;
const SECTION_H = 40;
const HEADER_H  = 60;

function toDay(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-');
  return `${m}/${d}`;
}

function getBar(item, rangeStart, dayWidth) {
  const start = item.start_date;
  const end   = item.end_date || item.start_date;
  const x = daysBetween(rangeStart, start) * dayWidth;
  const w = Math.max((daysBetween(start, end) + 1) * dayWidth, dayWidth);
  return { x, w, start, end };
}

function barColor(item) {
  if (item.status === 'done')        return 'bg-emerald-400 dark:bg-emerald-500/80';
  if (item.status === 'in-progress') return 'bg-blue-400 dark:bg-blue-500/80';
  return 'bg-gray-300 dark:bg-gray-500';
}

// ── PhaseRow: 전체 phase 그룹(헤더 + 아이템)을 감싸는 sortable 컴포넌트
// setNodeRef를 outermost div에 적용해야 drag-over detection이 정확히 동작함.
// sticky left-0 엘리먼트에 setNodeRef를 두면 bounding rect가 스크롤에 따라 변해
// dnd-kit의 drop 좌표 계산이 틀어짐.
function PhaseRow({
  phase, isReadOnly, collapsedProjects, toggleProjectCollapse,
  onOpenDetail, totalWidth, dayWidth, days, rangeStart,
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({
    id: `project-${phase.id}`,
    data: { type: 'project', sectionId: phase.section_id },
  });

  const stopProp = (e) => e.stopPropagation();
  const dndStyle = { transform: CSS.Transform.toString(transform), transition };

  const isCollapsed = collapsedProjects.has(phase.id);

  return (
    <div
      ref={setNodeRef}
      style={dndStyle}
      className={isDragging ? 'opacity-60 relative z-50' : ''}
      {...attributes}
    >
      {/* 프로젝트 헤더 행 */}
      <div className="flex sticky top-[100px] z-20" style={{ height: PHASE_H }}>
        {/* 왼쪽: 제목 + 핸들 */}
        <div
          className="sticky left-0 z-30 flex items-center px-3 gap-2 bg-gray-100/80 dark:bg-bg-elevated/60 border-b border-r border-gray-200 dark:border-border-subtle shrink-0 backdrop-blur-sm cursor-pointer hover:bg-gray-200/70 dark:hover:bg-bg-hover transition-colors"
          style={{ width: LEFT_W }}
          onClick={() => onOpenDetail(phase.id)}
        >
          {!isReadOnly && (
            <button
              {...listeners}
              className="cursor-grab active:cursor-grabbing shrink-0 p-0.5 hover:bg-gray-300 dark:hover:bg-bg-hover rounded text-gray-400"
              onClick={stopProp}
              title="드래그로 순서 변경"
            >
              <GripVertical size={14} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); toggleProjectCollapse(phase.id); }}
            onPointerDown={stopProp}
            className="shrink-0 p-0.5 hover:bg-gray-300 dark:hover:bg-bg-hover rounded text-gray-500 dark:text-text-tertiary hover:text-gray-800 dark:hover:text-text-primary transition-colors"
            title={isCollapsed ? '펼치기' : '접기'}
          >
            {isCollapsed
              ? <ChevronRight size={14} strokeWidth={2.5} />
              : <ChevronDown size={14} strokeWidth={2.5} />
            }
          </button>
          <span className="text-sm font-semibold text-gray-700 dark:text-text-secondary truncate">
            {phase.title}
          </span>
        </div>

        {/* 오른쪽: 프로젝트 간트 바 */}
        <div
          className="flex-1 bg-gray-50/60 dark:bg-bg-elevated/20 border-b border-gray-200 dark:border-border-subtle relative"
          style={{ width: totalWidth }}
        >
          {phase.start_date && (() => {
            const pStart = phase.start_date;
            const pEnd = phase.end_date || phase.start_date;
            const x = daysBetween(rangeStart, pStart) * dayWidth;
            const w = Math.max((daysBetween(pStart, pEnd) + 1) * dayWidth, dayWidth);
            return (
              <div
                className="absolute top-2 flex items-center px-3 text-[11px] font-semibold text-gray-600 dark:text-text-tertiary rounded-lg border-2 border-gray-400 dark:border-gray-500 bg-gray-200/40 dark:bg-gray-700/20 shadow-sm truncate cursor-pointer hover:bg-gray-300/40 transition-colors"
                style={{ left: Math.max(0, x), width: w, height: PHASE_H - 14 }}
                onClick={(e) => { e.stopPropagation(); onOpenDetail(phase.id); }}
              >
                {w > 60 && (
                  <span className="truncate">
                    {phase.title}{w > 140 && ` · ${formatDate(pStart)}→${formatDate(pEnd)}`}
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* 아이템 행 */}
      {!isCollapsed && (
        <SortableContext
          items={phase.items.map(i => `item-${i.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {phase.items.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              phaseId={phase.id}
              isReadOnly={isReadOnly}
              totalWidth={totalWidth}
              dayWidth={dayWidth}
              days={days}
              rangeStart={rangeStart}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

function ItemRow({ item, phaseId, isReadOnly, totalWidth, dayWidth, days, rangeStart, onOpenDetail }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `item-${item.id}`,
    data: { type: 'item', projectId: phaseId },
  });
  const stopProp = (e) => e.stopPropagation();
  const style = { transform: CSS.Transform.toString(transform), transition };
  const priority = PRIORITY_MAP[item.priority];

  return (
    <div ref={setNodeRef} style={style} className="flex" {...attributes}>
      {/* 왼쪽: 아이템 이름 (pl-6으로 프로젝트 대비 계층감) */}
      <div
        className={`sticky left-0 z-20 flex items-center pl-6 pr-3 gap-2 bg-white dark:bg-bg-base border-b border-r border-gray-100 dark:border-border-subtle/50 shrink-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-bg-hover transition-colors ${isDragging ? 'opacity-50' : ''}`}
        style={{ width: LEFT_W, height: ROW_H }}
        onClick={() => onOpenDetail(item.id)}
      >
        {!isReadOnly && (
          <button
            {...listeners}
            className="cursor-grab active:cursor-grabbing shrink-0 p-0.5 hover:bg-gray-200 dark:hover:bg-bg-hover rounded text-gray-300 dark:text-text-tertiary/50"
            onClick={stopProp}
            title="드래그로 순서 변경"
          >
            <GripVertical size={12} />
          </button>
        )}
        {item.priority > 0 && priority && (
          <span className="text-[11px] shrink-0">{priority.icon}</span>
        )}
        <span className="text-sm text-gray-600 dark:text-text-secondary truncate">
          {item.title || item.content}
        </span>
      </div>

      {/* 오른쪽: 간트 바 */}
      <div
        className="relative border-b border-gray-100 dark:border-border-subtle/50"
        style={{ width: totalWidth, height: ROW_H }}
      >
        {days.map((d, i) =>
          (d.getDay() === 0 || d.getDay() === 6) ? (
            <div
              key={i}
              className="absolute inset-y-0 bg-gray-50/70 dark:bg-white/[0.015] pointer-events-none"
              style={{ left: i * dayWidth, width: dayWidth }}
            />
          ) : null
        )}
        {item.start_date && (() => {
          const { x, w, start, end } = getBar(item, rangeStart, dayWidth);
          return (
            <div
              className={`absolute top-[8px] flex items-center px-2 text-[11px] font-semibold text-white truncate rounded-md shadow-sm select-none cursor-pointer hover:brightness-90 transition-all ${barColor(item)}`}
              style={{ left: Math.max(0, x), width: w, height: ROW_H - 16 }}
              onClick={(e) => { e.stopPropagation(); onOpenDetail(item.id); }}
            >
              {w > 50 && (
                <span className="truncate">
                  {item.title || item.content}
                  {w > 120 && ` · ${formatDate(start)}→${formatDate(end)}`}
                </span>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ───────────────────────────────────────────────────

export default function TimelineView({ phases, sections, onUpdateItem, onOpenDetail, isReadOnly = false, showToast }) {
  const [zoom, setZoom] = useState('month');
  const containerRef = useRef(null);

  const [collapsedSections, setCollapsedSections] = useState(() => {
    try {
      const saved = localStorage.getItem('timeline-collapsed-sections');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const [collapsedProjects, setCollapsedProjects] = useState(() => {
    try {
      const saved = localStorage.getItem('timeline-collapsed-projects');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem('timeline-collapsed-sections', JSON.stringify([...collapsedSections]));
  }, [collapsedSections]);

  useEffect(() => {
    localStorage.setItem('timeline-collapsed-projects', JSON.stringify([...collapsedProjects]));
  }, [collapsedProjects]);

  const toggleSectionCollapse = (sectionId) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId); else next.add(sectionId);
      return next;
    });
  };

  const toggleProjectCollapse = (projectId) => {
    setCollapsedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId); else next.add(projectId);
      return next;
    });
  };

  const { dayWidth, tickEvery } = ZOOM[zoom];

  // ── 날짜 범위 계산 ──────────────────────────────────────────────
  const today = toDay(new Date());

  let rangeStart = toDay(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  let rangeEnd   = toDay(new Date(today.getFullYear(), today.getMonth() + 3, 0));

  const allDated = phases.flatMap(p => p.items.filter(i => i.start_date));
  if (allDated.length > 0) {
    const minD = new Date(Math.min(...allDated.map(i => new Date(i.start_date))));
    const maxD = new Date(Math.max(...allDated.map(i => new Date(i.end_date || i.start_date))));
    if (minD < rangeStart) rangeStart = toDay(new Date(minD.getFullYear(), minD.getMonth(), 1));
    if (maxD > rangeEnd)   rangeEnd   = toDay(new Date(maxD.getFullYear(), maxD.getMonth() + 1, 0));
  }

  const totalDays  = daysBetween(rangeStart, rangeEnd) + 1;
  const totalWidth = totalDays * dayWidth;
  const todayX     = daysBetween(rangeStart, today) * dayWidth;

  // ── 날짜 배열 & 월 그룹 ─────────────────────────────────────────
  const days = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const months = [];
  days.forEach((d, i) => {
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!months.length || months[months.length - 1].key !== key) {
      months.push({ key, label: `${d.getFullYear()}년 ${d.getMonth() + 1}월`, startX: i * dayWidth, count: 1 });
    } else {
      months[months.length - 1].count++;
    }
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const x = Math.max(0, LEFT_W + todayX - containerRef.current.clientWidth / 2);
    containerRef.current.scrollLeft = x;
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ── DnD 핸들러 ──────────────────────────────────────────────────
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeType = active.data.current?.type;
    try {
      if (activeType === 'project') {
        const activeSectionId = active.data.current.sectionId;
        const overSectionId = over.data.current?.sectionId;
        if (activeSectionId !== overSectionId) {
          showToast?.('같은 섹션 내에서만 이동 가능합니다', 'error');
          return;
        }
        const sectionPhases = sortedPhases.filter(p => p.section_id === activeSectionId);
        const overIndex = sectionPhases.findIndex(p => `project-${p.id}` === over.id);
        if (overIndex === -1) return;
        const phaseId = active.id.replace('project-', '');
        await kanbanAPI.movePhaseTimeline(phaseId, activeSectionId, overIndex);
        showToast?.('프로젝트 순서를 변경했습니다', 'success');
      } else if (activeType === 'item') {
        const activeProjectId = active.data.current.projectId;
        const overProjectId = over.data.current?.projectId;
        if (activeProjectId !== overProjectId) {
          showToast?.('같은 프로젝트 내에서만 이동 가능합니다', 'error');
          return;
        }
        const phase = sortedPhases.find(p => p.id === activeProjectId);
        if (!phase) return;
        const overIndex = phase.items.findIndex(i => `item-${i.id}` === over.id);
        if (overIndex === -1) return;
        const itemId = active.id.replace('item-', '');
        await kanbanAPI.moveItemTimeline(itemId, activeProjectId, overIndex);
        showToast?.('업무 순서를 변경했습니다', 'success');
      }
    } catch (err) {
      console.error('DnD 순서 변경 실패:', err);
      showToast?.(`순서 변경 실패: ${err.message}`, 'error');
    }
  };

  // ── 타임라인 순서로 정렬 (원본 불변) ────────────────────────────
  const sortedPhases = useMemo(() => {
    return [...phases]
      .sort((a, b) => (a.timeline_order_index ?? a.order_index) - (b.timeline_order_index ?? b.order_index))
      .map(phase => ({
        ...phase,
        items: [...phase.items].sort((a, b) =>
          (a.timeline_order_index ?? a.order_index) - (b.timeline_order_index ?? b.order_index)
        ),
      }));
  }, [phases]);

  // ── 섹션별 프로젝트 그룹화 ──────────────────────────────────────
  const sectionGroups = useMemo(() => {
    const groups = new Map();
    const sortedSections = [...(sections || [])].sort((a, b) =>
      (a.timeline_order_index ?? a.order_index) - (b.timeline_order_index ?? b.order_index)
    );
    sortedSections.forEach(section => {
      const sectionPhases = sortedPhases.filter(p => p.section_id === section.id);
      if (sectionPhases.length > 0) {
        groups.set(section.id, { section, phases: sectionPhases });
      }
    });
    const noSectionPhases = sortedPhases.filter(p => !p.section_id);
    if (noSectionPhases.length > 0) {
      groups.set('no-section', {
        section: { id: 'no-section', title: '섹션 미지정' },
        phases: noSectionPhases,
      });
    }
    return groups;
  }, [sections, sortedPhases]);

  const hasRealSections = (sections || []).length > 0;

  // ── 전체 높이 계산 ──────────────────────────────────────────────
  const totalRowHeight = useMemo(() => {
    return [...sectionGroups.entries()].reduce((acc, [sectionId, { phases: sectionPhases }]) => {
      const showHeader = hasRealSections || sectionId !== 'no-section';
      let h = showHeader ? SECTION_H : 0;
      const isCollapsed = collapsedSections.has(sectionId);
      if (!isCollapsed || !showHeader) {
        sectionPhases.forEach(phase => {
          h += PHASE_H;
          if (!collapsedProjects.has(phase.id)) {
            h += phase.items.length * ROW_H;
          }
        });
      }
      return acc + h;
    }, 0);
  }, [sectionGroups, collapsedSections, collapsedProjects, hasRealSections]);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full bg-white dark:bg-bg-base overflow-hidden">

        {/* 줌 툴바 */}
        <div className="flex items-center gap-3 px-10 py-2.5 border-b border-gray-100 dark:border-border-subtle shrink-0">
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-bg-elevated rounded-xl">
            {Object.keys(ZOOM).map(key => (
              <button
                key={key}
                onClick={() => setZoom(key)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  zoom === key
                    ? 'bg-white dark:bg-bg-hover text-gray-900 dark:text-text-primary shadow-sm'
                    : 'text-gray-500 dark:text-text-tertiary hover:text-gray-800 dark:hover:text-text-secondary'
                }`}
              >
                {key === 'week' ? '주별' : key === 'month' ? '월별' : '분기별'}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 dark:text-text-tertiary">
            날짜가 설정된 업무만 바로 표시됩니다 · 왼쪽 영역을 드래그해서 순서를 변경할 수 있습니다
          </span>
        </div>

        {/* 타임라인 본체 */}
        <div ref={containerRef} className="flex-1 overflow-auto custom-scrollbar">
          <div style={{ minWidth: LEFT_W + totalWidth }}>

            {/* ── 헤더 ── */}
            <div
              className="sticky top-0 z-30 flex bg-white dark:bg-bg-base border-b border-gray-100 dark:border-border-subtle"
              style={{ height: HEADER_H }}
            >
              <div
                className="sticky left-0 z-40 bg-white dark:bg-bg-base border-r border-gray-100 dark:border-border-subtle flex items-end px-4 pb-2 shrink-0"
                style={{ width: LEFT_W }}
              >
                <span className="text-[11px] font-black uppercase tracking-widest text-gray-400 dark:text-text-tertiary">업무</span>
              </div>
              <div className="relative flex-1 overflow-hidden" style={{ width: totalWidth }}>
                {/* 월 레이블 */}
                <div className="absolute inset-x-0 top-0 h-[30px]">
                  {months.map(m => (
                    <div
                      key={m.key}
                      className="absolute top-0 h-full flex items-center px-2 text-[11px] font-black text-gray-500 dark:text-text-secondary whitespace-nowrap border-l border-gray-100 dark:border-border-subtle"
                      style={{ left: m.startX, width: m.count * dayWidth }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
                {/* 날짜 틱 */}
                <div className="absolute inset-x-0 bottom-0 h-[30px]">
                  {days.map((d, i) => {
                    const showTick = i === 0 || i % tickEvery === 0;
                    const isToday   = d.getTime() === today.getTime();
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div
                        key={i}
                        className={`absolute top-0 h-full flex items-center justify-center text-[10px] border-l ${
                          isToday
                            ? 'border-blue-400 text-blue-500 font-black dark:text-blue-400 dark:border-blue-400'
                            : isWeekend
                            ? 'border-gray-100/50 dark:border-border-subtle/20 text-gray-300 dark:text-text-tertiary/30'
                            : 'border-gray-100 dark:border-border-subtle/30 text-gray-400 dark:text-text-tertiary'
                        }`}
                        style={{ left: i * dayWidth, width: dayWidth }}
                      >
                        {showTick ? d.getDate() : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── 행 ── */}
            <div className="relative">
              {/* 오늘 수직선 */}
              <div
                className="absolute top-0 z-10 w-px bg-blue-400/50 dark:bg-blue-400/40 pointer-events-none"
                style={{ left: LEFT_W + todayX, height: totalRowHeight }}
              />

              <SortableContext
                items={sortedPhases.map(p => `project-${p.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {[...sectionGroups.entries()].map(([sectionId, { section, phases: sectionPhases }]) => {
                  const isSectionCollapsed = collapsedSections.has(sectionId);
                  const showSectionHeader = hasRealSections || sectionId !== 'no-section';

                  return (
                    <div key={sectionId}>
                      {/* 섹션 헤더 */}
                      {showSectionHeader && (
                        <div className="flex sticky z-30" style={{ top: HEADER_H, height: SECTION_H }}>
                          <div
                            className="sticky left-0 z-40 flex items-center px-4 bg-gray-100/95 dark:bg-bg-elevated/95 border-t-2 border-b border-gray-300 dark:border-border-subtle backdrop-blur-sm"
                            style={{ width: LEFT_W }}
                          >
                            <button
                              onClick={() => toggleSectionCollapse(sectionId)}
                              className="shrink-0 p-0.5 hover:bg-gray-200 dark:hover:bg-bg-hover rounded text-gray-500 dark:text-text-tertiary hover:text-gray-900 dark:hover:text-text-primary transition-colors"
                              title={isSectionCollapsed ? '펼치기' : '접기'}
                            >
                              {isSectionCollapsed
                                ? <ChevronRight size={16} strokeWidth={2.5} />
                                : <ChevronDown size={16} strokeWidth={2.5} />
                              }
                            </button>
                            <span className="text-xs font-bold text-gray-800 dark:text-text-primary ml-2 truncate">
                              {section.title}
                            </span>
                          </div>
                          <div
                            className="flex-1 bg-gray-100/95 dark:bg-bg-elevated/95 border-t-2 border-b border-gray-300 dark:border-border-subtle"
                            style={{ width: totalWidth }}
                          />
                        </div>
                      )}

                      {/* 프로젝트 목록 */}
                      {(!showSectionHeader || !isSectionCollapsed) && sectionPhases.map(phase => (
                        <PhaseRow
                          key={phase.id}
                          phase={phase}
                          isReadOnly={isReadOnly}
                          collapsedProjects={collapsedProjects}
                          toggleProjectCollapse={toggleProjectCollapse}
                          onOpenDetail={onOpenDetail}
                          totalWidth={totalWidth}
                          dayWidth={dayWidth}
                          days={days}
                          rangeStart={rangeStart}
                        />
                      ))}
                    </div>
                  );
                })}
              </SortableContext>
            </div>

          </div>
        </div>
      </div>
    </DndContext>
  );
}
