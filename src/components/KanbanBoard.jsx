/**
 * @fileoverview 칸반 앱 최상위 오케스트레이터. board/timeline/people 뷰 전환 + DnD 컨텍스트.
 *
 * 담당:
 * - @dnd-kit DnD 컨텍스트 (sections, phases, items 세 레벨 드래그)
 * - Toast/Confirm/Prompt 전역 피드백 상태 관리 + 콜백 전달
 * - ItemDetailPanel 열림/닫힘 + 리사이즈 (panelWidth 20~80%)
 * - URL 상태 ↔ 필터/뷰 동기화
 * - Ctrl+K 검색 단축키 리스너
 *
 * DnD 타입 판별: activeId prefix ('section-', phase vs item)
 * localStorage: expandedSections Set, isMainBoardCollapsed boolean
 */
import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Search, PanelLeft, CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useKanbanData } from '../hooks/useKanbanData';
import { useUrlState } from '../hooks/useUrlState';
import { useAuth } from '../hooks/useAuth';
import { useLayoutState } from '../hooks/useLayoutState';
import API from '../api/kanbanAPI';
import ProjectColumn from './ProjectColumn';
import KanbanCard from './KanbanCard';
import BoardSection from './BoardSection';
import { TEAMS, GLOBAL_TAGS } from '../lib/constants';
import FilterBar from './FilterBar';
import AppLayout from './AppLayout';
import { useFilterState, applyFilterSort } from '../hooks/useFilterState';

import { Toast, ConfirmModal, InputModal } from './UI/Feedback';

const DISPLAY_BOARDS = ['main', '개발팀', 'AI팀', '지원팀'];
const ItemDetailPanel = lazy(() => import('./ItemDetailPanel'));
const PeopleBoard = lazy(() => import('./PeopleBoard'));
const TimelineView = lazy(() => import('./TimelineView'));
const SearchModal = lazy(() => import('./SearchModal'));

function ViewLoadingFallback({ label, fullHeight = true }) {
  return (
    <div className={`flex items-center justify-center ${fullHeight ? 'min-h-[40vh]' : 'h-full'} px-6`}>
      <div className="flex items-center gap-3 rounded-2xl border border-gray-100 dark:border-border-subtle bg-white/80 dark:bg-bg-elevated/80 px-4 py-3 text-sm font-semibold text-gray-500 dark:text-text-secondary shadow-sm">
        <div className="h-4 w-4 rounded-full border-2 border-gray-200 dark:border-border-subtle border-t-gray-500 dark:border-t-text-secondary animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  );
}

export default function KanbanBoard({ onShowLogin, onShowReleaseNotes }) {
  const { toggleSidebar } = useLayoutState();
  const {
    phases, sections, loading, addPhase, addItem, updateItem, deleteItem,
    moveItem, updatePhase, deletePhase, completePhase, movePhase, addComment, updateComment, deleteComment,
    addSection, updateSection, deleteSection, moveSection,
    addChildPage,
  } = useKanbanData();

  const { user, logout } = useAuth();
  const [urlState, setUrlState, replaceUrlState] = useUrlState();
  const activeView = urlState.view;
  const detailItemId = urlState.itemId;
  const isDetailFullscreen = urlState.fullscreen;
  const [peopleTeams, setPeopleTeams] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [peopleError, setPeopleError] = useState(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => setMounted(true), []);

  // Ctrl+K / Cmd+K 전체 검색 단축키
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (loading || !urlState.scrollTo) return;
    const [type, id] = urlState.scrollTo.split(':');
    if (!type || !id) return;
    const el = document.getElementById(`${type}-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('highlight-target');
    const timer = setTimeout(() => el.classList.remove('highlight-target'), 2000);
    replaceUrlState({ scrollTo: null });
    return () => clearTimeout(timer);
  }, [loading, urlState.scrollTo, replaceUrlState]);

  useEffect(() => {
    let isMounted = true;

    const fetchPeopleData = async () => {
      setPeopleLoading(true);
      setPeopleError(null);
      try {
        const data = await API.getPeopleData();
        if (!isMounted) return;
        setPeopleTeams(data.teams || []);
      } catch (err) {
        if (!isMounted) return;
        setPeopleError(err.message || '인원관리 데이터를 불러오지 못했습니다.');
      } finally {
        if (isMounted) setPeopleLoading(false);
      }
    };

    fetchPeopleData();

    return () => {
      isMounted = false;
    };
  }, []);

  const [activeId, setActiveId] = useState(null);
  // expandedSections: 펼쳐진 섹션 ID 목록 (기본값 empty = 모든 섹션 접힘)
  const [expandedSections, setExpandedSections] = useState(() => {
    try {
      const saved = localStorage.getItem('kanban-expanded-sections');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [expandedCompletedBoards, setExpandedCompletedBoards] = useState(() => {
    try {
      const saved = localStorage.getItem('kanban-completed-expanded');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [expandedCompletedPhases, setExpandedCompletedPhases] = useState(new Set());

  const [panelWidth, setPanelWidth] = useState(50); // percentage width
  const [isResizing, setIsResizing] = useState(false);
  const [isMainBoardCollapsed, setIsMainBoardCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('kanban-main-board-collapsed');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const {
    filters, sort, hasActiveFilters,
    addFilter, removeFilter, reset: resetFilters, setSort,
  } = useFilterState({ filters: urlState.filters, sort: urlState.sort });

  // 필터/정렬 변경 시 URL에 동기화
  useEffect(() => {
    replaceUrlState({ filters, sort });
  }, [filters, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  // Global UI Feedback State
  const [toast, setToast] = useState(null); // { message, type }
  const [confirm, setConfirm] = useState(null); // { title, message, onConfirm, type }
  const [prompt, setPrompt] = useState(null); // { title, placeholder, onConfirm }

  const showToast = (message, type = 'success') => setToast({ message, type });
  const showConfirm = (title, message, onConfirm, type = 'danger') => setConfirm({ title, message, onConfirm, type });
  const showPrompt = (title, placeholder, onConfirm) => setPrompt({ title, placeholder, onConfirm });

  const sensors = useSensors(
    useSensor(PointerSensor, { distance: 8 }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 필터/정렬 적용된 phases 파생
  const filteredPhases = useMemo(() => {
    return phases.map(phase => ({
      ...phase,
      items: applyFilterSort(
        (phase.items || []).filter(item => !item.page_type || item.page_type === 'task'),
        filters, sort
      ),
    }));
  }, [phases, filters, sort]);

  const findContainer = (id) => {
    if (phases.find((p) => p.id === id)) return id;
    const phase = phases.find((p) => p.items.some((i) => i.id === id));
    return phase ? phase.id : null;
  };

  const handleDragStart = (event) => {
    if (!user) return;
    setActiveId(event.active.id);
  };

  /**
   * @description DnD 드롭 완료 시 타입(section/phase/item) 판별 후 해당 이동 메서드 호출.
   * phase 이동 시 다른 section 위에 드롭하면 updatePhase로 section_id도 변경.
   * @param {Object} event - @dnd-kit DragEndEvent { active, over }
   */
  const handleDragEnd = async (event) => {
    if (!user) return;
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Section 이동 (섹션 순서 변경)
    if (active.data.current?.type === 'Section') {
      if (activeId !== overId) {
        const activeSec = sections.find(s => s.id === activeId);
        const boardType = activeSec?.board_type;
        const boardSections = sections
          .filter(s => s.board_type === boardType)
          .sort((a, b) => a.order_index - b.order_index);
        const newIndex = boardSections.findIndex(s => s.id === overId);
        if (newIndex !== -1) await moveSection(activeId, newIndex, boardType);
      }
      return;
    }

    // Phase 이동 (가로 이동)
    if (active.data.current?.type === 'Phase') {
      const overIsSection = sections.some(s => s.id === overId);

      if (overIsSection) {
        // 섹션 헤더/바디 위에 직접 드롭 → section_id 변경
        const activePhase = phases.find(p => p.id === activeId);
        if (activePhase?.section_id !== overId) {
          await updatePhase(activeId, { section_id: overId });
        }
        return;
      }

      if (activeId !== overId) {
        const overPhase = phases.find(p => p.id === overId);
        const activePhase = phases.find(p => p.id === activeId);

        if (overPhase && overPhase.section_id !== activePhase?.section_id) {
          // 섹션이 다른 Phase 위에 드롭 → section_id만 변경 (순서 변경 없음)
          await updatePhase(activeId, { section_id: overPhase.section_id });
          return;
        }

        // 같은 섹션/standalone 내 순서 변경
        const newIndex = phases.findIndex((p) => p.id === overId);
        if (newIndex !== -1) await movePhase(activeId, newIndex);
      }
      return;
    }

    // Item 이동 (세로/교차 이동)
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer) return;

    if (activeId !== overId || activeContainer !== overContainer) {
      const overPhase = phases.find(p => p.id === overContainer);
      const overItems = overPhase.items;
      const overIndex = overItems.findIndex(i => i.id === overId);
      
      let newIndex;
      if (overIndex === -1) {
        newIndex = overItems.length;
      } else {
        const isBelowOverItem =
          over &&
          active.rect.current.translated &&
          active.rect.current.translated.top >
            over.rect.top + over.rect.height / 2;

        const modifier = isBelowOverItem ? 1 : 0;
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length;
      }

      await moveItem(activeContainer, overContainer, activeId, newIndex);
    }
  };

  const startResizing = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    localStorage.setItem('kanban-expanded-sections', JSON.stringify([...expandedSections]));
  }, [expandedSections]);

  useEffect(() => {
    localStorage.setItem('kanban-completed-expanded', JSON.stringify([...expandedCompletedBoards]));
  }, [expandedCompletedBoards]);

  useEffect(() => {
    localStorage.setItem('kanban-main-board-collapsed', JSON.stringify(isMainBoardCollapsed));
  }, [isMainBoardCollapsed]);

  useEffect(() => {
    const resize = (e) => {
      const newWidth = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
      if (newWidth > 20 && newWidth < 80) setPanelWidth(newWidth);
    };
    const stopResizing = () => setIsResizing(false);

    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing]);

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-white dark:bg-bg-base flex items-center justify-center font-sans transition-colors duration-200">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 border-4 border-gray-100 dark:border-border-subtle border-t-gray-900 dark:border-t-white rounded-full animate-spin"></div>
          <span className="text-label text-gray-400 dark:text-text-secondary tracking-[0.2em]">워크스페이스 불러오는 중...</span>
        </div>
      </div>
    );
  }
  
  const activeItem = phases.flatMap(p => p.items).find(i => i.id === activeId);
  const activePhase = phases.find(p => p.id === activeId);
  const activeSection = sections.find(s => s.id === activeId);

  let detailItem = detailItemId ? phases.flatMap(p => p.items).find(i => i.id === detailItemId) : null;
  let detailPhase = detailItem ? phases.find(p => p.items.some(i => i.id === detailItemId)) : null;

  if (!detailItem && detailItemId) {
    const projectPhase = phases.find(p => p.id === detailItemId);
    if (projectPhase) {
      detailItem = {
        id: projectPhase.id,
        title: projectPhase.title,
        description: projectPhase.description || '',
        status: 'none',
        page_type: 'project',
        assignees: projectPhase.assignees || [],
        teams: [],
        tags: [],
        related_items: [],
        creator_profile: null,
      };
      detailPhase = projectPhase;
    }
  }

  const handleUpdateItem = async (phaseId, itemId, updates) => {
    if (detailItem?.page_type === 'project') {
      try {
        await updatePhase(itemId, updates);
      } catch {
        showToast('프로젝트 속성 업데이트 실패 (DB 마이그레이션 필요)', 'error');
      }
      return;
    }
    await updateItem(phaseId, itemId, updates);
  };

  const handleUpdatePhase = async (phaseId, updates) => {
    try {
      await updatePhase(phaseId, updates);
    } catch (err) {
      showToast('프로젝트 업데이트 실패: ' + err.message, 'error');
    }
  };

  const closeDetailPanel = () => {
    setUrlState({ itemId: null, fullscreen: false });
  };
  const handleBreadcrumbNavigate = (type, payload = {}) => {
    setUrlState({ view: 'board', itemId: null, fullscreen: false });

    if (type !== 'project' || !payload.projectId) return;

    window.requestAnimationFrame(() => {
      const target = document.getElementById(`project-${payload.projectId}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  };

  return (
    <AppLayout
      sections={sections}
      phases={phases}
      activeView={activeView}
      activeItemId={detailItemId}
      onNavigate={(view) => setUrlState({ view, itemId: null })}
      onOpenItem={(itemId) => setUrlState({ itemId })}
      onAddChildPage={addChildPage}
      onShowPrompt={showPrompt}
      onShowReleaseNotes={onShowReleaseNotes}
      isReadOnly={!user}
    >
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="w-full h-full bg-white dark:bg-bg-base font-sans flex overflow-hidden transition-colors duration-200">
        
        {/* Main Content Area */}
          <div 
            className={`flex-1 flex flex-col min-w-0 ${isResizing ? 'select-none pointer-events-none' : 'transition-all duration-300 ease-notion'} ${detailItemId && !isDetailFullscreen ? 'overflow-hidden' : ''}`}
            style={{ marginRight: detailItemId && !isDetailFullscreen ? `${panelWidth}vw` : '0' }}
          >
          {/* Notion Style Header */}
          <header className={`pl-8 py-5 flex justify-between items-center bg-white dark:bg-bg-base border-b border-gray-100 dark:border-border-subtle transition-all duration-300 ease-notion ${detailItemId && !isDetailFullscreen ? 'pr-4' : 'pr-10'}`}>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSidebar}
                  className="p-2 -ml-2 mr-1 rounded-lg text-gray-400 hover:text-gray-900 dark:text-text-tertiary dark:hover:text-text-primary hover:bg-gray-100 dark:hover:bg-bg-hover transition-colors cursor-pointer flex-shrink-0"
                  title="사이드바 토글"
                >
                  <PanelLeft size={20} strokeWidth={2.5} />
                </button>
                <div className="text-3xl filter drop-shadow-sm">📂</div>
                <h1 className="text-2xl font-black text-gray-900 dark:text-text-primary tracking-tight leading-none">
                  {activeView === 'board' ? '프로젝트 보드' : activeView === 'timeline' ? '타임라인' : '인원 관리'}
                </h1>
              </div>
              
              <nav className="flex items-center gap-1 p-1 rounded-xl bg-gray-50 dark:bg-bg-elevated border border-gray-100 dark:border-border-subtle transition-colors duration-200">
                <button
                  onClick={() => setUrlState({ view: 'board' })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                    activeView === 'board'
                      ? 'bg-white dark:bg-bg-hover text-gray-900 dark:text-text-primary shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]'
                      : 'text-gray-400 dark:text-text-tertiary hover:text-gray-600 dark:hover:text-text-secondary'
                  }`}
                >
                  보드
                </button>
                <button
                  onClick={() => setUrlState({ view: 'timeline' })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                    activeView === 'timeline'
                      ? 'bg-white dark:bg-bg-hover text-gray-900 dark:text-text-primary shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]'
                      : 'text-gray-400 dark:text-text-tertiary hover:text-gray-600 dark:hover:text-text-secondary'
                  }`}
                >
                  타임라인
                </button>
                <button
                  onClick={() => setUrlState({ view: 'people' })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                    activeView === 'people'
                      ? 'bg-white dark:bg-bg-hover text-gray-900 dark:text-text-primary shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]'
                      : 'text-gray-400 dark:text-text-tertiary hover:text-gray-600 dark:hover:text-text-secondary'
                  }`}
                >
                  인원관리
                </button>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              {/* 검색 버튼 */}
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-bg-elevated text-gray-400 dark:text-text-tertiary hover:text-gray-700 dark:hover:text-text-secondary border border-gray-100 dark:border-border-subtle transition-all cursor-pointer text-sm"
                title="전체 검색 (Ctrl+K)"
              >
                <Search size={15} strokeWidth={2.5} />
                <span className="text-xs font-medium hidden sm:inline">검색</span>
                <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-bg-hover text-gray-400 dark:text-text-tertiary font-mono">⌘K</kbd>
              </button>
              {mounted && (
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-2.5 rounded-xl bg-gray-50 dark:bg-bg-elevated text-gray-500 dark:text-text-secondary hover:text-gray-900 dark:hover:text-text-primary transition-all cursor-pointer border border-gray-100 dark:border-border-subtle"
                  aria-label="테마 전환"
                >
                  {theme === 'dark' ? <Sun size={20} strokeWidth={2.5} /> : <Moon size={20} strokeWidth={2.5} />}
                </button>
              )}
              {user ? (
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-bg-elevated px-4 py-2 rounded-xl border border-gray-100 dark:border-border-subtle shadow-sm transition-colors duration-200">
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-bold text-gray-800 dark:text-text-primary leading-tight">{user?.user_metadata?.name || user?.email?.split('@')[0]}</span>
                    <button onClick={logout} className="text-[13px] font-semibold text-gray-400 dark:text-text-tertiary hover:text-red-500 transition-colors">로그아웃</button>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gray-900 dark:bg-brand-accent flex items-center justify-center text-white text-sm font-black shadow-inner uppercase border-2 border-white dark:border-border-strong">
                    {(user?.user_metadata?.name || user?.email || 'U').charAt(0)}
                  </div>
                </div>
              ) : (
                <button onClick={onShowLogin} className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-black dark:hover:bg-gray-100 transition-all shadow-md hover:shadow-lg active:scale-95">Login to Edit</button>
              )}
            </div>
          </header>

          {/* Filter Bar */}
          {activeView === 'board' && (
            <FilterBar
              filters={filters}
              sort={sort}
              hasActiveFilters={hasActiveFilters}
              onAddFilter={addFilter}
              onRemoveFilter={removeFilter}
              onClearFilters={resetFilters}
              onSetSort={setSort}
            />
          )}

          {/* Board Scroll Area */}
          {activeView === 'timeline' ? (
            <Suspense fallback={<ViewLoadingFallback label="타임라인 준비 중..." />}>
              <TimelineView
                phases={filteredPhases.filter(p => (p.board_type || 'main') !== 'main')}
                sections={sections.filter(s => (s.board_type || 'main') !== 'main')}
                onUpdateItem={updateItem}
                onOpenDetail={(itemId) => setUrlState({ itemId })}
                isReadOnly={!user}
                showToast={showToast}
              />
            </Suspense>
          ) : activeView === 'board' ? (
            <div
              className={`flex-1 overflow-x-auto overflow-y-auto pt-10 pb-10 pl-10 custom-scrollbar bg-white dark:bg-bg-base transition-all duration-300 ease-notion flex flex-col gap-20 ${detailItemId && !isDetailFullscreen ? 'pr-4' : 'pr-10'}`}
              onClick={(e) => {
                if (!detailItemId) return;
                if (e.target.closest('button, a, input, textarea, select, [contenteditable="true"], [role="button"], [data-interactive]')) return;
                closeDetailPanel();
              }}
            >

            {/* Separate Board Sections */}
            {[...DISPLAY_BOARDS].sort((a, b) => {
              if (a === 'main') return -1;
              if (b === 'main') return 1;
              const userDept = user?.user_metadata?.department;
              if (userDept === a) return -1;
              if (userDept === b) return 1;
              return 0;
            }).map(boardName => {
              const boardPhases = filteredPhases.filter(p => (p.board_type || 'main') === boardName.toLowerCase() && !p.is_completed);
              const completedPhases = filteredPhases.filter(p => (p.board_type || 'main') === boardName.toLowerCase() && p.is_completed);
              const boardDisplayName = boardName === 'main' ? '전체 프로젝트 보드' : `${boardName} 보드`;
              const boardIcon = boardName === 'main' ? '🌐' : boardName === '개발팀' ? '⚙️' : '📂';
              const isMain = boardName === 'main';
              const isCollapsed = isMain && isMainBoardCollapsed;
              
              return (
                <section key={boardName} className={`flex flex-col gap-8 border-t border-gray-100 dark:border-border-subtle pt-16 first:border-none first:pt-0 ${isCollapsed ? 'pb-2' : ''} transition-all duration-300 ease-notion`}>
                  <div className="flex items-center justify-between px-4 group">
                    <div className="flex items-center gap-4">
                      {isMain && (
                        <button 
                          onClick={() => setIsMainBoardCollapsed(!isMainBoardCollapsed)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-bg-hover transition-all text-gray-400 hover:text-gray-900 dark:hover:text-text-primary cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-border-strong shadow-sm"
                        >
                          <span className={`transform transition-transform duration-300 ease-notion text-2xl ${isMainBoardCollapsed ? '-rotate-90' : 'rotate-0'}`}>▼</span>
                        </button>
                      )}
                      <div className="text-3xl filter drop-shadow-sm">{boardIcon}</div>
                      <div className="flex flex-col">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-text-primary tracking-tight leading-tight">{boardDisplayName}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-bg-elevated text-gray-500 dark:text-text-tertiary rounded-md text-[13px] font-bold tabular-nums border border-gray-100 dark:border-border-subtle shadow-sm uppercase tracking-wider">
                            {boardPhases.length} 프로젝트
                          </span>
                          <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-text-tertiary"></span>
                          <span className="text-[13px] font-bold text-gray-400 dark:text-text-tertiary uppercase tracking-widest">
                            {boardPhases.reduce((acc, p) => acc + p.items.length, 0)} Items
                          </span>
                        </div>
                      </div>
                    </div>
                    {user && !isCollapsed && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => showPrompt('새 섹션 추가', '섹션 이름을 입력하세요', (title) => { if (title) { addSection(boardName.toLowerCase(), title); showToast(`'${title}' 섹션이 생성되었습니다.`); setPrompt(null); } })}
                          className="px-5 py-2.5 bg-gray-50 dark:bg-bg-elevated text-gray-400 dark:text-text-tertiary rounded-xl text-sm font-bold hover:bg-gray-100 dark:hover:bg-bg-hover border border-dashed border-gray-200 dark:border-border-strong transition-all flex items-center gap-2 cursor-pointer hover:text-gray-600 dark:hover:text-text-secondary"
                        >
                          <span className="text-xl">+</span>
                          새 섹션 추가
                        </button>
                        <button
                          onClick={() => {
                            showPrompt(
                              `${boardDisplayName} 프로젝트 추가`,
                              '새 프로젝트의 이름을 입력하세요',
                              (title) => {
                                if (title) {
                                  addPhase(title, boardName.toLowerCase());
                                  showToast(`'${title}' 프로젝트가 생성되었습니다.`);
                                  setPrompt(null);
                                }
                              }
                            );
                          }}
                          className="px-5 py-2.5 bg-gray-50 dark:bg-bg-elevated text-gray-500 dark:text-text-secondary rounded-xl text-sm font-bold hover:bg-gray-100 dark:hover:bg-bg-hover border border-dashed border-gray-300 dark:border-border-strong transition-all flex items-center gap-2 group/add cursor-pointer hover:shadow-md"
                        >
                          <span className="text-xl group-hover/add:text-blue-500 transition-colors">+</span>
                          새 프로젝트 추가
                        </button>
                      </div>
                    )}
                  </div>

                  {!isCollapsed && (() => {
                    const standalonePhases = boardPhases.filter(p => !p.section_id);
                    const boardSections = sections
                      .filter(s => s.board_type === boardName.toLowerCase())
                      .sort((a, b) => a.order_index - b.order_index);
                    const isEmpty = boardPhases.length === 0 && boardSections.length === 0;
                    const projectColumnProps = {
                      onAddItem: addItem, onUpdateItem: updateItem, onDeleteItem: deleteItem,
                      onUpdatePhase: updatePhase, onDeletePhase: deletePhase,
                      onCompletePhase: completePhase,
                      onOpenDetail: (itemId) => setUrlState({ itemId }),
                      onShowConfirm: showConfirm, onShowToast: showToast,
                      currentUserId: user?.id || null,
                      isReadOnly: !user,
                    };

                    return (
                      <div className="flex flex-col gap-8">
                        {isEmpty ? (
                          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-100 dark:border-border-subtle rounded-3xl py-24 bg-gray-50/40 dark:bg-bg-elevated/40 transition-colors duration-200">
                            <div className="flex flex-col items-center text-center animate-fade-in">
                              <div className="w-16 h-16 bg-white dark:bg-bg-base rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-gray-100 dark:border-border-subtle mb-6">🏝️</div>
                              <p className="text-gray-400 dark:text-text-tertiary font-black text-xl mb-6 tracking-tight">이 보드에는 아직 프로젝트가 없습니다.</p>
                              {user && (
                                <button
                                  onClick={() => showPrompt(`${boardDisplayName} 첫 프로젝트 만들기`, '첫 번째 프로젝트의 이름을 입력하세요', (title) => { if (title) { addPhase(title, boardName.toLowerCase()); showToast(`'${title}' 프로젝트가 생성되었습니다.`); setPrompt(null); } })}
                                  className="text-sm font-black text-blue-500 bg-white dark:bg-bg-elevated px-8 py-3.5 rounded-2xl shadow-lg border border-blue-100 dark:border-blue-900/30 hover:bg-blue-50 dark:hover:bg-bg-hover transition-all flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer uppercase tracking-widest"
                                >
                                  + 첫 번째 프로젝트 추가하기
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            {boardSections.length > 0 && (
                              <SortableContext items={boardSections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                {boardSections.map(section => (
                                  <BoardSection
                                    key={section.id}
                                    section={section}
                                    phases={boardPhases.filter(p => p.section_id === section.id)}
                                    isCollapsed={!expandedSections.has(section.id)}
                                    onToggleCollapse={() => setExpandedSections(prev => {
                                      const next = new Set(prev);
                                      next.has(section.id) ? next.delete(section.id) : next.add(section.id);
                                      return next;
                                    })}
                                    onUpdateSection={updateSection}
                                    onDeleteSection={deleteSection}
                                    onAddPhase={addPhase}
                                    onShowPrompt={showPrompt}
                                    {...projectColumnProps}
                                  />
                                ))}
                              </SortableContext>
                            )}

                            {standalonePhases.length > 0 && (
                              <div className="flex gap-12 overflow-x-auto py-3 pb-6 custom-scrollbar min-h-[350px] px-2">
                                <SortableContext items={standalonePhases.map(p => p.id)} strategy={horizontalListSortingStrategy}>
                                  {standalonePhases.map((phase, idx) => (
                                    <ProjectColumn key={phase.id} phase={phase} phaseIndex={idx + 1} {...projectColumnProps} />
                                  ))}
                                </SortableContext>
                              </div>
                            )}

                            {completedPhases.length > 0 && (
                              <div className="mt-2">
                                <button
                                  className="flex items-center gap-2 px-2 py-2 text-sm font-bold text-gray-500 dark:text-text-secondary hover:text-gray-900 dark:hover:text-text-primary transition-colors cursor-pointer"
                                  onClick={() => setExpandedCompletedBoards(prev => {
                                    const next = new Set(prev);
                                    next.has(boardName) ? next.delete(boardName) : next.add(boardName);
                                    return next;
                                  })}
                                >
                                  <ChevronRight
                                    size={14}
                                    className={`transition-transform duration-200 ${expandedCompletedBoards.has(boardName) ? 'rotate-90' : ''}`}
                                  />
                                  <span>완료된 프로젝트</span>
                                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full text-xs font-bold tabular-nums">
                                    {completedPhases.length}
                                  </span>
                                </button>

                                {expandedCompletedBoards.has(boardName) && (
                                  <div className="flex flex-wrap gap-3 px-2 mt-3">
                                    {completedPhases.map(phase => (
                                      <div key={phase.id} className="flex flex-col gap-2">
                                        <button
                                          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-bg-elevated border border-gray-200 dark:border-border-subtle rounded-xl hover:border-green-300 dark:hover:border-green-700 transition-colors cursor-pointer"
                                          onClick={() => setExpandedCompletedPhases(prev => {
                                            const next = new Set(prev);
                                            next.has(phase.id) ? next.delete(phase.id) : next.add(phase.id);
                                            return next;
                                          })}
                                        >
                                          <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                                          <span className="text-sm font-bold text-gray-600 dark:text-text-secondary">{phase.title}</span>
                                          <span className="text-xs text-gray-400 dark:text-text-tertiary tabular-nums">{phase.items.length}개</span>
                                          <ChevronDown
                                            size={12}
                                            className={`text-gray-400 dark:text-text-tertiary transition-transform duration-200 ${expandedCompletedPhases.has(phase.id) ? 'rotate-180' : ''}`}
                                          />
                                        </button>
                                        {expandedCompletedPhases.has(phase.id) && (
                                          <ProjectColumn
                                            phase={phase}
                                            phaseIndex={-1}
                                            {...projectColumnProps}
                                            isCompletedView={true}
                                          />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}
                </section>
              );
            })}
            
            </div>
          ) : (
            <Suspense fallback={<ViewLoadingFallback label="인원관리 화면 준비 중..." />}>
              <PeopleBoard
                teams={peopleTeams}
                loading={peopleLoading}
                error={peopleError}
                onOpenItem={(itemId) => setUrlState({ itemId })}
                projectAssignees={phases.reduce((acc, p) => { acc[p.title] = p.assignees || []; return acc; }, {})}
              />
            </Suspense>
          )}
        </div>

        {/* Side Detail Panel (Fixed on the right when active) */}
        {detailItemId && detailItem && detailPhase && (
          <div 
            className={`fixed top-0 right-0 h-full bg-white dark:bg-bg-base z-[100] overflow-hidden flex ${
              isResizing ? '' : 'transition-all duration-500 ease-notion'
            } ${
              isDetailFullscreen
                ? 'w-screen border-l-0 shadow-none'
                : 'shadow-[-10px_0_40px_rgba(0,0,0,0.06)] border-l border-gray-100 dark:border-border-subtle'
            }`}
            style={isDetailFullscreen ? undefined : { width: `${panelWidth}vw`, minWidth: '450px' }}
          >
            {/* Resize Handle (Using the border as the handle) */}
            {!isDetailFullscreen && (
              <div 
                className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-50 group transition-all duration-300"
                onMouseDown={startResizing}
              >
                <div className="absolute inset-y-0 left-0 w-[2px] bg-gray-100 dark:bg-border-subtle group-hover:bg-blue-500/50 group-active:bg-blue-600 transition-colors"></div>
              </div>
            )}
            
            <div className="flex-1 w-full h-full min-w-0 bg-white dark:bg-bg-base transition-colors duration-200">
              <Suspense fallback={<ViewLoadingFallback label="상세 정보를 불러오는 중..." fullHeight={false} />}>
                <ItemDetailPanel
                  item={detailItem}
                  phase={detailPhase}
                  allItems={phases.flatMap(p => p.items || [])}
                  onClose={closeDetailPanel}
                  isFullscreen={isDetailFullscreen}
                  onToggleFullscreen={() => setUrlState({ fullscreen: !isDetailFullscreen })}
                  onBreadcrumbNavigate={handleBreadcrumbNavigate}
                  onUpdateItem={handleUpdateItem}
                  onUpdatePhase={handleUpdatePhase}
                  onDeleteItem={deleteItem}
                  onDeletePhase={deletePhase}
                  onAddComment={addComment}
                  onUpdateComment={updateComment}
                  onDeleteComment={deleteComment}
                  onOpenDetail={(itemId) => setUrlState({ itemId })}
                  onShowConfirm={showConfirm}
                  onShowToast={showToast}
                  onAddChildPage={addChildPage}
                  onShowPrompt={showPrompt}
                  isReadOnly={!user}
                />
              </Suspense>
            </div>
          </div>
        )}

        {/* Drag Overlay */}
        <DragOverlay dropAnimation={{
          duration: 250,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
          {activeSection ? (
            <div className="bg-white dark:bg-bg-elevated border border-gray-200 dark:border-border-strong rounded-2xl px-6 py-4 shadow-2xl opacity-90 cursor-grabbing">
              <span className="text-base font-black text-gray-900 dark:text-text-primary">{activeSection.title}</span>
            </div>
          ) : activeItem ? (
            <KanbanCard item={activeItem} isDragging />
          ) : activePhase ? (
            <ProjectColumn phase={activePhase} phaseIndex={phases.findIndex(p => p.id === activePhase.id) + 1} isDragging />
          ) : null}
        </DragOverlay>

        {/* 전체 검색 모달 */}
        {showSearch && (
          <Suspense fallback={<ViewLoadingFallback label="검색 창 준비 중..." />}>
            <SearchModal
              phases={phases}
              onOpenDetail={(itemId) => setUrlState({ itemId })}
              onClose={() => setShowSearch(false)}
            />
          </Suspense>
        )}

        {/* Global Feedback Components */}
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        {confirm && (
          <ConfirmModal 
            title={confirm.title} 
            message={confirm.message} 
            type={confirm.type}
            onConfirm={() => { confirm.onConfirm(); setConfirm(null); }} 
            onCancel={() => setConfirm(null)} 
          />
        )}
        {prompt && (
          <InputModal 
            title={prompt.title} 
            placeholder={prompt.placeholder} 
            onConfirm={(val) => { prompt.onConfirm(val); setPrompt(null); }} 
            onCancel={() => setPrompt(null)} 
          />
        )}
      </div>
    </DndContext>
    </AppLayout>
  );
}
