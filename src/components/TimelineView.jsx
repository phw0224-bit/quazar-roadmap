import { useState, useEffect, useRef, useCallback } from 'react';
import { PRIORITY_MAP } from '../lib/constants';
import { ChevronDown, ChevronRight } from 'lucide-react';

const ZOOM = {
  week:    { dayWidth: 52, tickEvery: 1  },
  month:   { dayWidth: 22, tickEvery: 7  },
  quarter: { dayWidth: 8,  tickEvery: 14 },
};

const LEFT_W = 260;
const ROW_H  = 44;
const PHASE_H = 52;  // 프로젝트 헤더 높이 증가 (간트 바 공간 확보)
const HEADER_H = 60;

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
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}`;
}

export default function TimelineView({ phases, onUpdateItem, onOpenDetail, isReadOnly = false }) {
  const [zoom, setZoom] = useState('month');
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  // dragging: { phaseId, itemId, origStart, origEnd, startX, currentDelta }

  // 접기/펼치기 상태 (localStorage 영속화)
  const [collapsedProjects, setCollapsedProjects] = useState(() => {
    try {
      const saved = localStorage.getItem('timeline-collapsed-projects');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // localStorage 동기화
  useEffect(() => {
    localStorage.setItem('timeline-collapsed-projects', JSON.stringify([...collapsedProjects]));
  }, [collapsedProjects]);

  const toggleProjectCollapse = (projectId) => {
    setCollapsedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const { dayWidth, tickEvery} = ZOOM[zoom];

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

  // ── 오늘 위치로 스크롤 ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const x = Math.max(0, LEFT_W + todayX - containerRef.current.clientWidth / 2);
    containerRef.current.scrollLeft = x;
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 드래그 ──────────────────────────────────────────────────────
  const handleBarMouseDown = useCallback((e, item, phaseId) => {
    if (isReadOnly || !item.start_date) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging({
      phaseId,
      itemId: item.id,
      origStart: item.start_date,
      origEnd:   item.end_date || item.start_date,
      startX:    e.clientX,
      currentDelta: 0,
    });
  }, [isReadOnly]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const delta = Math.round((e.clientX - dragging.startX) / dayWidth);
      setDragging(prev => ({ ...prev, currentDelta: delta }));
    };
    const onUp = () => {
      if (dragging.currentDelta !== 0) {
        const newStart = new Date(dragging.origStart);
        newStart.setDate(newStart.getDate() + dragging.currentDelta);
        const newEnd = new Date(dragging.origEnd);
        newEnd.setDate(newEnd.getDate() + dragging.currentDelta);
        onUpdateItem(dragging.phaseId, dragging.itemId, {
          start_date: newStart.toISOString().split('T')[0],
          end_date:   newEnd.toISOString().split('T')[0],
        });
      }
      setDragging(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, dayWidth, onUpdateItem]);

  // ── 바 위치 계산 ────────────────────────────────────────────────
  function getBar(item) {
    let start = item.start_date;
    let end   = item.end_date || item.start_date;
    if (dragging?.itemId === item.id) {
      const s = new Date(dragging.origStart); s.setDate(s.getDate() + dragging.currentDelta);
      const e = new Date(dragging.origEnd);   e.setDate(e.getDate() + dragging.currentDelta);
      start = s.toISOString().split('T')[0];
      end   = e.toISOString().split('T')[0];
    }
    const x = daysBetween(rangeStart, start) * dayWidth;
    const w = Math.max((daysBetween(start, end) + 1) * dayWidth, dayWidth);
    return { x, w, start, end };
  }

  function barColor(item) {
    if (item.status === 'done')        return 'bg-emerald-400 dark:bg-emerald-500/80';
    if (item.status === 'in-progress') return 'bg-blue-400 dark:bg-blue-500/80';
    return 'bg-gray-300 dark:bg-gray-500';
  }

  // ── 전체 높이 계산 ───────────────────────────────────────────────
  const totalRowHeight = phases.reduce((acc, p) => acc + PHASE_H + p.items.length * ROW_H, 0);

  return (
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
          날짜가 설정된 업무만 바로 표시됩니다 · 바를 드래그해서 날짜를 이동할 수 있습니다
        </span>
      </div>

      {/* 타임라인 본체 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto custom-scrollbar"
        style={{ userSelect: dragging ? 'none' : 'auto' }}
      >
        <div style={{ minWidth: LEFT_W + totalWidth }}>

          {/* ── 헤더 ── */}
          <div
            className="sticky top-0 z-30 flex bg-white dark:bg-bg-base border-b border-gray-100 dark:border-border-subtle"
            style={{ height: HEADER_H }}
          >
            {/* 왼쪽 헤더 */}
            <div
              className="sticky left-0 z-40 bg-white dark:bg-bg-base border-r border-gray-100 dark:border-border-subtle flex items-end px-4 pb-2 shrink-0"
              style={{ width: LEFT_W }}
            >
              <span className="text-[11px] font-black uppercase tracking-widest text-gray-400 dark:text-text-tertiary">업무</span>
            </div>

            {/* 타임라인 헤더 */}
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
                  const isToday  = d.getTime() === today.getTime();
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

            {phases.map(phase => (
              <div key={phase.id}>
                {/* 프로젝트 헤더 행 */}
                <div className="flex sticky top-[60px] z-20" style={{ height: PHASE_H }}>
                  <div
                    className="sticky left-0 z-30 flex items-center px-4 bg-gray-50/90 dark:bg-bg-elevated/80 border-b border-r border-gray-100 dark:border-border-subtle shrink-0 backdrop-blur-sm gap-2"
                    style={{ width: LEFT_W }}
                  >
                    <button
                      onClick={() => toggleProjectCollapse(phase.id)}
                      className="shrink-0 p-0.5 hover:bg-gray-200 dark:hover:bg-bg-hover rounded text-gray-400 dark:text-text-tertiary hover:text-gray-900 dark:hover:text-text-primary transition-colors"
                      title={collapsedProjects.has(phase.id) ? '펼치기' : '접기'}
                    >
                      {collapsedProjects.has(phase.id) ? <ChevronRight size={14} strokeWidth={3} /> : <ChevronDown size={14} strokeWidth={3} />}
                    </button>
                    <span className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-text-tertiary truncate">
                      {phase.title}
                    </span>
                  </div>
                  {/* 프로젝트 간트 영역 */}
                  <div
                    className="flex-1 bg-gray-50/60 dark:bg-bg-elevated/30 border-b border-gray-100 dark:border-border-subtle relative"
                    style={{ width: totalWidth }}
                  >
                    {/* 프로젝트 간트 바 (날짜 있을 시) */}
                    {phase.start_date && (() => {
                      const pStart = phase.start_date;
                      const pEnd = phase.end_date || phase.start_date;
                      const x = daysBetween(rangeStart, pStart) * dayWidth;
                      const w = Math.max((daysBetween(pStart, pEnd) + 1) * dayWidth, dayWidth);
                      return (
                        <div
                          className="absolute top-2 flex items-center px-3 text-[10px] font-bold text-gray-600 dark:text-text-tertiary rounded-lg border-2 border-gray-400 dark:border-gray-500 bg-gray-200/30 dark:bg-gray-700/20 shadow-sm truncate"
                          style={{ left: Math.max(0, x), width: w, height: PHASE_H - 12 }}
                        >
                          {w > 100 && (
                            <span className="truncate">
                              {phase.title} · {formatDate(pStart)}→{formatDate(pEnd)}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* 아이템 행 (접혔을 때 렌더링 스킵) */}
                {!collapsedProjects.has(phase.id) && (
                  <>
                    {[...phase.items]
                  .sort((a, b) => {
                    // 1. 날짜 있는 것 우선
                    const aHasDate = !!a.start_date;
                    const bHasDate = !!b.start_date;
                    if (aHasDate !== bHasDate) return bHasDate ? 1 : -1;
                    
                    // 2. 둘 다 날짜 있으면 start_date 오름차순
                    if (aHasDate && bHasDate) {
                      const dateCompare = (a.start_date || '').localeCompare(b.start_date || '');
                      if (dateCompare !== 0) return dateCompare;
                    }
                    
                    // 3. 같으면 order_index 유지
                    return a.order_index - b.order_index;
                  })
                  .map(item => {
                  const hasBar = !!item.start_date;
                  const isDraggingThis = dragging?.itemId === item.id;
                  const priority = PRIORITY_MAP[item.priority];

                  return (
                    <div key={item.id} className="flex" style={{ height: ROW_H }}>
                      {/* 왼쪽: 아이템 이름 */}
                      <div
                        className="sticky left-0 z-20 flex items-center px-4 gap-2 bg-white dark:bg-bg-base border-b border-r border-gray-50 dark:border-border-subtle/50 shrink-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-bg-hover transition-colors"
                        style={{ width: LEFT_W }}
                        onClick={() => onOpenDetail(item.id)}
                      >
                        {item.priority > 0 && priority && (
                          <span className="text-[11px] shrink-0">{priority.icon}</span>
                        )}
                        <span className="text-sm text-gray-700 dark:text-text-secondary truncate">
                          {item.title || item.content}
                        </span>
                      </div>

                      {/* 오른쪽: 간트 바 */}
                      <div
                        className="relative border-b border-gray-50 dark:border-border-subtle/50"
                        style={{ width: totalWidth }}
                      >
                        {/* 주말 음영 */}
                        {days.map((d, i) =>
                          (d.getDay() === 0 || d.getDay() === 6) ? (
                            <div
                              key={i}
                              className="absolute inset-y-0 bg-gray-50/70 dark:bg-white/[0.015] pointer-events-none"
                              style={{ left: i * dayWidth, width: dayWidth }}
                            />
                          ) : null
                        )}

                        {/* 간트 바 */}
                        {hasBar && (() => {
                          const { x, w, start, end } = getBar(item);
                          return (
                            <div
                              className={`absolute top-[8px] flex items-center px-2 text-[11px] font-bold text-white truncate rounded-lg shadow-sm select-none transition-all
                                ${barColor(item)}
                                ${!isReadOnly ? 'cursor-grab active:cursor-grabbing hover:brightness-90' : 'cursor-pointer'}
                                ${isDraggingThis ? 'ring-2 ring-blue-400 opacity-90 shadow-lg' : ''}`}
                              style={{ left: Math.max(0, x), width: w, height: ROW_H - 16 }}
                              onMouseDown={e => handleBarMouseDown(e, item, phase.id)}
                              onClick={e => { if (!isDraggingThis && Math.abs(dragging?.currentDelta ?? 0) < 2) { e.stopPropagation(); onOpenDetail(item.id); } }}
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
                })}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
