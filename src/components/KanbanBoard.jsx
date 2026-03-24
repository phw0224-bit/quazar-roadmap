import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
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
} from '@dnd-kit/sortable';
import { useKanbanData } from '../hooks/useKanbanData';
import { useAuth } from '../hooks/useAuth';
import API from '../api/kanbanAPI';
import PhaseColumn from './PhaseColumn';
import KanbanCard from './KanbanCard';
import ItemDetailPanel from './ItemDetailPanel';
import PeopleBoard from './PeopleBoard';

import { Toast, ConfirmModal, InputModal } from './UI/Feedback';

const TEAMS = [
  { name: '감정팀', color: 'bg-slate-200 text-slate-800' },
  { name: '개발팀', color: 'bg-[#e2e8f0] text-gray-700' },
  { name: 'AI팀', color: 'bg-[#c6f6d5] text-green-800' },
  { name: '기획팀', color: 'bg-[#e9d8fd] text-purple-800' },
  { name: '지원팀', color: 'bg-[#fed7e2] text-pink-800' },
];

const DISPLAY_BOARDS = ['main', '개발팀', 'AI팀', '지원팀'];

const CHANNELS = [
  { name: 'B2C 앱 플로우', color: 'text-blue-700' },
  { name: 'B2B 오프라인 (캐시카우)', color: 'text-slate-700' },
  { name: '리텐션 & 성장', color: 'text-green-700' },
];

const GLOBAL_TAGS = [
  { name: 'AI 핵심', color: 'bg-[#e0e7ff] text-[#4338ca]' },
  { name: 'B2B', color: 'bg-[#fef3c7] text-[#92400e]' },
  { name: '캐시카우', color: 'bg-[#fef9c3] text-[#854d0e]' },
  { name: '핵심 단계', color: 'bg-[#fee2e2] text-[#b91c1c]' },
  { name: '데이터 루프', color: 'bg-[#e6fffa] text-[#2c7a7b]' },
  { name: '결제', color: 'bg-[#fdf2f8] text-[#9d174d]' },
];

export default function KanbanBoard({ onShowLogin }) {
  const {
    phases, loading, error, addPhase, addItem, updateItem, deleteItem,
    moveItem, updatePhase, deletePhase, movePhase, addComment, updateComment, deleteComment,
  } = useKanbanData();

  const { user, logout } = useAuth();
  const [peopleTeams, setPeopleTeams] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [peopleError, setPeopleError] = useState(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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
        if (!isMounted) return;
        setPeopleLoading(false);
      }
    };

    fetchPeopleData();

    return () => {
      isMounted = false;
    };
  }, []);

  const [activeId, setActiveId] = useState(null);
  const [detailItemId, setDetailItemId] = useState(null);
  const [panelWidth, setPanelWidth] = useState(50); // percentage width
  const [isResizing, setIsResizing] = useState(false);
  const [isDetailFullscreen, setIsDetailFullscreen] = useState(false);
  const [isMainBoardCollapsed, setIsMainBoardCollapsed] = useState(true);
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [activeView, setActiveView] = useState('board');

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

  const findContainer = (id) => {
    if (phases.find((p) => p.id === id)) return id;
    const phase = phases.find((p) => p.items.some((i) => i.id === id));
    return phase ? phase.id : null;
  };

  const handleDragStart = (event) => {
    if (!user) return;
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    if (!user) return;
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Phase 이동 (가로 이동)
    if (active.data.current?.type === 'Phase') {
      if (activeId !== overId) {
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

  const stopResizing = () => {
    setIsResizing(false);
  };

  const resize = (e) => {
    if (isResizing) {
      const newWidth = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
      if (newWidth > 20 && newWidth < 80) {
        setPanelWidth(newWidth);
      }
    }
  };

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing]);

  const handleAddPhase = async () => {
    if (!newPhaseName.trim()) return;
    await addPhase(newPhaseName);
    setNewPhaseName('');
    setShowAddPhase(false);
  };

  if (loading) return <div className="w-full min-h-screen bg-white dark:bg-[#191919] flex items-center justify-center font-sans text-gray-400 tracking-widest uppercase">Loading Workspace...</div>;
  
  const totalItems = phases.reduce((acc, p) => acc + p.items.length, 0);
  const activeItem = phases.flatMap(p => p.items).find(i => i.id === activeId);
  const activePhase = phases.find(p => p.id === activeId);

  const detailItem = detailItemId ? phases.flatMap(p => p.items).find(i => i.id === detailItemId) : null;
  const detailPhase = detailItem ? phases.find(p => p.items.some(i => i.id === detailItemId)) : null;
  const totalMembers = peopleTeams.reduce((acc, team) => acc + team.members.length, 0);
  const closeDetailPanel = () => {
    setDetailItemId(null);
    setIsDetailFullscreen(false);
  };
  const handleBreadcrumbNavigate = (type, payload = {}) => {
    setActiveView('board');
    closeDetailPanel();

    if (type !== 'phase' || !payload.phaseId) return;

    window.requestAnimationFrame(() => {
      const target = document.getElementById(`phase-${payload.phaseId}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="w-full h-screen bg-white dark:bg-[#191919] font-sans flex overflow-hidden">
        
        {/* Sidebar Space (Notion style simple sidebar if needed, but we use top header) */}
        
        {/* Main Content Area */}
          <div 
            className={`flex-1 flex flex-col min-w-0 ${isResizing ? 'select-none pointer-events-none' : 'transition-all duration-300'}`}
            style={{ marginRight: detailItemId && !isDetailFullscreen ? `${panelWidth}vw` : '0' }}
          >
          {/* Notion Style Header */}
          <header className="px-10 py-6 flex justify-between items-center bg-white dark:bg-[#191919] border-b border-gray-100 dark:border-[#2f2f2f]">
            <div className="flex items-center gap-4">
              <div className="text-3xl">📂</div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-[#E3E3E3] tracking-tight leading-none">
                {activeView === 'board' ? '프로젝트 보드' : '인원 관리'}
              </h1>
              <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-gray-100 dark:bg-[#252525] border border-gray-200 dark:border-[#353535]">
                <button
                  onClick={() => setActiveView('board')}
                  className={`px-3 py-1.5 rounded-md text-sm font-black transition-colors cursor-pointer ${
                    activeView === 'board'
                      ? 'bg-white dark:bg-[#343434] text-gray-800 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  보드
                </button>
                <button
                  onClick={() => setActiveView('people')}
                  className={`px-3 py-1.5 rounded-md text-sm font-black transition-colors cursor-pointer ${
                    activeView === 'people'
                      ? 'bg-white dark:bg-[#343434] text-gray-800 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  인원관리
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {mounted && (
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-2 rounded-lg bg-gray-50 dark:bg-[#252525] text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer border border-gray-100 dark:border-[#373737]"
                  aria-label="Toggle Dark Mode"
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              )}
              {user ? (
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-[#252525] px-4 py-2 rounded-lg border border-gray-100 dark:border-[#2f2f2f] shadow-sm">
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] font-black text-gray-800 dark:text-[#D1D1D1] leading-tight">{user?.user_metadata?.name || user?.email?.split('@')[0]}</span>
                    <button onClick={logout} className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest hover:text-red-500 transition-colors">Sign Out</button>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-800 dark:bg-[#3f4d5c] flex items-center justify-center text-white text-[12px] font-black shadow-inner uppercase">
                    {(user?.user_metadata?.name || user?.email || 'U').charAt(0)}
                  </div>
                </div>
              ) : (
                <button onClick={onShowLogin} className="px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-black dark:hover:bg-gray-100 transition-all shadow-md">Login to Edit</button>
              )}
            </div>
          </header>

          {/* Filter Bar (Notion Style) */}
          {activeView === 'board' && (
            <div className="px-10 py-3 border-b border-gray-100 dark:border-[#2f2f2f] flex items-center gap-6 overflow-x-auto no-scrollbar bg-white dark:bg-[#191919]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest whitespace-nowrap">Filter →</span>
              <div className="flex gap-1.5">
                {TEAMS.map(team => (
                  <button
                    key={team.name}
                    onClick={() => setSelectedTeam(selectedTeam === team.name ? null : team.name)}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all border ${selectedTeam === team.name ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white text-white dark:text-gray-900 shadow-md' : 'bg-white dark:bg-[#252525] border-gray-200 dark:border-[#373737] text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'}`}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-4 w-[1px] bg-gray-200 dark:bg-gray-700"></div>

            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <button
                  onClick={() => setSelectedStatus(selectedStatus === 'in-progress' ? null : 'in-progress')}
                  className={`px-4 py-1.5 rounded-[4px] text-sm font-black tracking-tight border transition-all ${selectedStatus === 'in-progress' ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white dark:bg-[#252525] border-gray-200 dark:border-[#373737] text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'}`}
                >
                  진행 중
                </button>
                <button
                  onClick={() => setSelectedStatus(selectedStatus === 'done' ? null : 'done')}
                  className={`px-4 py-1.5 rounded-[4px] text-sm font-black tracking-tight border transition-all ${selectedStatus === 'done' ? 'bg-green-600 border-green-600 text-white shadow-md' : 'bg-white dark:bg-[#252525] border-gray-200 dark:border-[#373737] text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'}`}
                >
                  완료
                </button>
              </div>
            </div>
            </div>
          )}

          {/* Board Scroll Area */}
          {activeView === 'board' ? (
            <div className="flex-1 overflow-x-auto overflow-y-auto p-10 custom-scrollbar bg-white dark:bg-[#191919] flex flex-col gap-16">
            
            {/* Separate Board Sections (Truly separate boards, not just filtered views) */}
            {/* We render only the boards in DISPLAY_BOARDS list */}
            {DISPLAY_BOARDS.sort((a, b) => {
              // 1. 'main' board is always at the absolute top
              if (a === 'main') return -1;
              if (b === 'main') return 1;

              // 2. User's department board comes right after 'main' if it's in display list
              const userDept = user?.user_metadata?.department;
              if (userDept === a) return -1;
              if (userDept === b) return 1;
              
              return 0;
            }).map(boardName => {
              // Filter phases belonging to this specific board.
              const boardPhases = phases.filter(p => (p.board_type || 'main') === boardName.toLowerCase());
              
              const boardDisplayName = boardName === 'main' ? '전체 프로젝트 보드' : `${boardName} 보드`;
              const boardIcon = boardName === 'main' ? '🌐' : boardName === '개발팀' ? '⚙️' : '📂';
              const isMain = boardName === 'main';
              const isCollapsed = isMain && isMainBoardCollapsed;
              
              return (
                <section key={boardName} className={`flex flex-col gap-6 border-t border-gray-100 dark:border-[#2f2f2f] pt-12 first:border-none first:pt-0 ${isCollapsed ? 'pb-2' : ''}`}>
                  <div className="flex items-center justify-between px-2 group">
                    <div className="flex items-center gap-3">
                      {isMain && (
                        <button 
                          onClick={() => setIsMainBoardCollapsed(!isMainBoardCollapsed)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-all text-gray-400 hover:text-gray-900"
                        >
                          <span className={`transform transition-transform duration-200 text-xl ${isMainBoardCollapsed ? '-rotate-90' : 'rotate-0'}`}>▼</span>
                        </button>
                      )}
                      <div className="text-2xl">{boardIcon}</div>
                      <h2 className="text-xl font-black text-gray-900 dark:text-[#E3E3E3] tracking-tight">{boardDisplayName}</h2>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-[#252525] text-gray-500 dark:text-gray-400 rounded-full text-[11px] font-bold">
                        {boardPhases.length} Phases
                      </span>
                    </div>
                    {user && !isCollapsed && (
                      <button 
                        onClick={() => {
                          showPrompt(
                            `${boardDisplayName} 단계 추가`, 
                            '단계 이름을 입력하세요 (예: 테스트, 배포 중)', 
                            (title) => {
                              if (title) {
                                addPhase(title, boardName.toLowerCase());
                                showToast(`${title} 단계가 추가되었습니다.`);
                                setPrompt(null);
                              }
                            }
                          );
                        }}
                        className="px-3 py-1.5 bg-gray-50 dark:bg-[#252525] text-gray-500 dark:text-gray-400 rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-gray-100 border border-dashed border-gray-300 dark:border-[#373737] transition-all"
                      >
                        + Add Phase to {boardName}
                      </button>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="flex gap-10 overflow-x-auto pb-4 custom-scrollbar min-h-[300px]">
                      {boardPhases.length > 0 ? (
                        <SortableContext items={boardPhases.map(p => p.id)} strategy={horizontalListSortingStrategy}>
                          {boardPhases.map((phase, idx) => (
                            <PhaseColumn
                              key={phase.id} phase={phase} phaseIndex={idx + 1}
                              selectedTeam={selectedTeam} selectedTag={selectedTag} selectedStatus={selectedStatus}
                              onAddItem={addItem} onUpdateItem={updateItem} onDeleteItem={deleteItem} onUpdatePhase={updatePhase} onDeletePhase={deletePhase}
                              onAddComment={addComment} onUpdateComment={updateComment} onDeleteComment={deleteComment}
                              onOpenDetail={setDetailItemId}
                              onShowConfirm={showConfirm}
                              onShowToast={showToast}
                              isReadOnly={!user}
                            />
                          ))}
                        </SortableContext>
                      ) : (
                        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-100 rounded-2xl py-20 bg-gray-50/30">
                          <div className="text-center">
                            <p className="text-gray-300 font-bold text-sm mb-4">이 보드에는 아직 단계가 없습니다.</p>
                            <button 
                              onClick={() => {
                                showPrompt(
                                  `${boardDisplayName} 첫 단계 만들기`, 
                                  '단계 이름을 입력하세요', 
                                  (title) => {
                                    if (title) {
                                      addPhase(title, boardName.toLowerCase());
                                      showToast(`${title} 단계가 추가되었습니다.`);
                                      setPrompt(null);
                                    }
                                  }
                                );
                              }}
                              className="text-[11px] font-black text-blue-500 bg-white dark:bg-[#252525] px-4 py-2 rounded-lg shadow-sm border border-blue-100 dark:border-blue-900/30 hover:bg-blue-50 transition-all"
                            >
                              + 첫 번째 단계 만들기
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
            
            </div>
          ) : (
            <PeopleBoard
              teams={peopleTeams}
              loading={peopleLoading}
              error={peopleError}
              onOpenItem={(itemId) => setDetailItemId(itemId)}
            />
          )}
        </div>

        {/* Side Detail Panel (Fixed on the right when active) */}
        {detailItemId && detailItem && detailPhase && (
          <div 
            className={`fixed top-0 right-0 h-full bg-white dark:bg-[#191919] z-[100] dark:border-[#2f2f2f] overflow-hidden flex ${
              isDetailFullscreen
                ? 'w-screen border-l-0 shadow-none'
                : 'shadow-[-10px_0_30px_rgba(0,0,0,0.05)] border-l border-gray-100'
            }`}
            style={isDetailFullscreen ? undefined : { width: `${panelWidth}vw`, minWidth: '400px' }}
          >
            {/* Resize Handle */}
            {!isDetailFullscreen && (
              <div 
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/45 active:bg-blue-500/70 z-50 group"
                onMouseDown={startResizing}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-gray-300 dark:bg-[#373737] rounded-full group-hover:bg-blue-500"></div>
              </div>
            )}
            
            <div className="flex-1 w-full h-full min-w-0 bg-white dark:bg-[#191919]">
              <ItemDetailPanel
                item={detailItem}
                phase={detailPhase}
                allItems={phases.flatMap(p => p.items)}
                onClose={closeDetailPanel}
                isFullscreen={isDetailFullscreen}
                onToggleFullscreen={() => setIsDetailFullscreen(prev => !prev)}
                onBreadcrumbNavigate={handleBreadcrumbNavigate}
                onUpdateItem={updateItem}
                onAddComment={addComment}
                onUpdateComment={updateComment}
                onDeleteComment={deleteComment}
                onOpenDetail={setDetailItemId}
                onShowConfirm={showConfirm}
                onShowToast={showToast}
                isReadOnly={!user}
              />
            </div>
          </div>
        )}

        {/* Drag Overlay */}
        <DragOverlay>
          {activeItem ? <KanbanCard item={activeItem} isDragging /> : null}
          {activePhase ? <PhaseColumn phase={activePhase} phaseIndex={phases.findIndex(p => p.id === activePhase.id) + 1} isDragging /> : null}
        </DragOverlay>

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
  );
}
