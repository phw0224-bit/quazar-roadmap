import { useState } from 'react';
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
import PhaseColumn from './PhaseColumn';
import KanbanCard from './KanbanCard';

const TEAMS = [
  { name: '감정팀', color: 'bg-[#ffcc00] text-black' },
  { name: '개발팀', color: 'bg-[#e2e8f0] text-gray-700' },
  { name: 'AI팀', color: 'bg-[#c6f6d5] text-green-800' },
  { name: '기획팀', color: 'bg-[#e9d8fd] text-purple-800' },
  { name: '지원팀', color: 'bg-[#fed7e2] text-pink-800' },
];

const CHANNELS = [
  { name: 'B2C 앱 플로우', color: 'text-blue-700' },
  { name: 'B2B 오프라인 (캐시카우)', color: 'text-amber-700' },
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

  const [activeId, setActiveId] = useState(null);
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { distance: 8 }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

    if (active.data.current?.type === 'Phase') {
      if (activeId !== overId) {
        const newIndex = phases.findIndex((p) => p.id === overId);
        if (newIndex !== -1) await movePhase(activeId, newIndex);
      }
      return;
    }

    let sourcePhaseId = null;
    for (const phase of phases) {
      if (phase.items.some(i => i.id === activeId)) { sourcePhaseId = phase.id; break; }
    }
    if (!sourcePhaseId) return;

    let targetPhaseId = null;
    let targetIndex = 0;
    const overAsPhase = phases.find(p => p.id === overId);
    if (overAsPhase) {
      targetPhaseId = overId;
      targetIndex = overAsPhase.items.length;
    } else {
      for (const phase of phases) {
        const idx = phase.items.findIndex(i => i.id === overId);
        if (idx !== -1) { targetPhaseId = phase.id; targetIndex = idx; break; }
      }
    }
    if (targetPhaseId) await moveItem(sourcePhaseId, targetPhaseId, activeId, targetIndex);
  };

  const handleAddPhase = async () => {
    if (!newPhaseName.trim()) return;
    await addPhase(newPhaseName);
    setNewPhaseName('');
    setShowAddPhase(false);
  };

  if (loading) return <div className="w-full min-h-screen bg-[#fcfbf7] flex items-center justify-center font-serif text-[#c5a059] tracking-widest uppercase">Loading Roadmap...</div>;
  
  const totalItems = phases.reduce((acc, p) => acc + p.items.length, 0);
  const activeItem = phases.flatMap(p => p.items).find(i => i.id === activeId);
  const activePhase = phases.find(p => p.id === activeId);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="w-full min-h-screen bg-[#fcfbf7] p-0 font-sans flex flex-col">
        {/* Main Header */}
        <header className="px-10 py-4 border-b border-gray-200 flex justify-between items-center bg-white shadow-sm overflow-hidden">
          {/* Left: Logo & Title */}
          <div className="flex items-center gap-4">
            <div className="text-2xl font-serif font-bold tracking-widest text-[#c5a059]">LD</div>
            <div className="h-8 w-[1px] bg-gray-300 mx-2"></div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-gray-800 uppercase leading-tight">Luxury Detective — 전체 비즈니스 플로우 맵</h1>
              <p className="text-[10px] text-gray-400 font-medium tracking-wider">대한명품감정원 포함 · 실무 미팅용 · v2.0 · 2026</p>
            </div>
          </div>

          {/* Center: Team Filters */}
          <div className="flex items-center gap-2">
            {TEAMS.map(team => (
              <button
                key={team.name}
                onClick={() => setSelectedTeam(selectedTeam === team.name ? null : team.name)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${team.color} ${selectedTeam === team.name ? 'ring-2 ring-offset-2 ring-[#c5a059] scale-105 shadow-md' : 'opacity-60 hover:opacity-100'}`}
              >
                {team.name}
              </button>
            ))}
          </div>
          
          {/* Right: Stats & Profile */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-6 pr-6 border-r border-gray-100 h-10">
              <div className="text-center">
                <div className="text-lg font-serif text-[#c5a059] leading-tight">{phases.length}</div>
                <div className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">PHASES</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-serif text-[#c5a059] leading-tight">{totalItems}</div>
                <div className="text-[8px] text-gray-400 font-bold uppercase tracking-widest text-nowrap">세부 단계</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-blue-800 leading-tight">B2C+B2B</div>
                <div className="text-[8px] text-gray-400 font-bold uppercase tracking-widest text-nowrap">듀얼 채널</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-[#c5a059] leading-tight text-center">★</div>
                <div className="text-[8px] text-gray-400 font-bold uppercase tracking-widest text-nowrap">캐시카우 포함</div>
              </div>
            </div>

            {/* Profile Section */}
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-800 uppercase tracking-tight">{user?.user_metadata?.name || user?.email?.split('@')[0]}</span>
                      <div className="h-2 w-[1px] bg-gray-200"></div>
                      <button 
                        onClick={logout}
                        className="text-[9px] font-bold text-gray-400 uppercase tracking-widest hover:text-red-500 transition-colors"
                      >
                        Sign Out
                      </button>
                    </div>
                    <span className="text-[9px] text-[#c5a059] font-bold uppercase tracking-widest leading-none mt-0.5">{user?.user_metadata?.department || 'Member'}</span>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#fcfbf7] to-gray-100 border border-gray-200 flex items-center justify-center text-[11px] font-serif font-bold text-[#c5a059] shadow-inner uppercase">
                    {(user?.user_metadata?.name || user?.email || 'U').charAt(0)}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-end">
                  <button 
                    onClick={onShowLogin} 
                    className="px-4 py-1.5 bg-[#c5a059] text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-[#b38f4d] transition-colors shadow-sm cursor-pointer"
                  >
                    Login to Edit
                  </button>
                  <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-1">Read Only Mode</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Secondary Header (Filters) */}
        <div className="px-10 py-4 flex flex-wrap items-center gap-8 bg-[#fcfbf7] border-b border-gray-100 shadow-inner">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">채널 구분 →</span>
            <div className="flex gap-4">
              {CHANNELS.map(ch => (
                <div key={ch.name} className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
                  <div className={`w-2 h-2 rounded-full bg-current ${ch.color}`}></div>
                  <span className={`text-[11px] font-bold ${ch.color}`}>{ch.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="h-4 w-[1px] bg-gray-300"></div>

          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">태그 →</span>
            <div className="flex gap-2">
              {GLOBAL_TAGS.map(tag => (
                <button
                  key={tag.name}
                  onClick={() => setSelectedTag(selectedTag === tag.name ? null : tag.name)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${tag.color} ${selectedTag === tag.name ? 'ring-2 ring-offset-1 ring-gray-400 scale-105 shadow-sm' : 'opacity-60 hover:opacity-100'}`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          <div className="h-4 w-[1px] bg-gray-300"></div>

          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">상태 →</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedStatus(selectedStatus === 'in-progress' ? null : 'in-progress')}
                className={`px-3 py-1 rounded-[4px] text-[11px] font-black tracking-tight shadow-md transition-all cursor-pointer ${selectedStatus === 'in-progress' ? 'bg-blue-600 text-white ring-2 ring-offset-2 ring-blue-600' : 'bg-blue-100 text-blue-800 opacity-60 hover:opacity-100'}`}
              >
                진행 중
              </button>
              <button
                onClick={() => setSelectedStatus(selectedStatus === 'done' ? null : 'done')}
                className={`px-3 py-1 rounded-[4px] text-[11px] font-black tracking-tight shadow-md transition-all cursor-pointer ${selectedStatus === 'done' ? 'bg-green-600 text-white ring-2 ring-offset-2 ring-green-600' : 'bg-green-100 text-green-900 opacity-60 hover:opacity-100'}`}
              >
                완료
              </button>
            </div>
          </div>
        </div>

          {/* Board */}
          <div className="flex-1 overflow-x-auto p-10 custom-scrollbar">
          <div className="flex gap-8 pb-10">
            <SortableContext items={phases.map(p => p.id)} strategy={horizontalListSortingStrategy}>
              {phases.map((phase, idx) => (
                <PhaseColumn
                  key={phase.id} phase={phase} phaseIndex={idx + 1} selectedTeam={selectedTeam} selectedTag={selectedTag} selectedStatus={selectedStatus}
                  onAddItem={addItem} onUpdateItem={updateItem} onDeleteItem={deleteItem} onUpdatePhase={updatePhase} onDeletePhase={deletePhase}
                  onAddComment={addComment} onUpdateComment={updateComment} onDeleteComment={deleteComment}
                  isReadOnly={!user}
                />
              ))}
            </SortableContext>

            {user && (
              <div className="flex flex-col min-w-[320px] max-w-[320px] justify-start mt-2">
                {!showAddPhase ? (
                  <button className="w-full py-4 bg-transparent text-gray-400 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer font-bold text-xs uppercase tracking-widest transition-all hover:bg-white hover:text-brand-gold hover:border-brand-gold" onClick={() => setShowAddPhase(true)}>+ Add Phase</button>
                ) : (
                  <div className="flex flex-col gap-3 bg-white p-5 rounded-lg shadow-xl border border-gray-100">
                    <input type="text" placeholder="Phase Name..." className="p-3 bg-gray-50 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-gold" value={newPhaseName} onChange={(e) => setNewPhaseName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddPhase()} autoFocus />
                    <div className="flex gap-2">
                      <button onClick={handleAddPhase} className="flex-1 py-2 bg-brand-gold text-white rounded font-bold text-xs uppercase tracking-widest hover:bg-[#b38f4d]">ADD</button>
                      <button onClick={() => { setShowAddPhase(false); setNewPhaseName(''); }} className="flex-1 py-2 bg-gray-100 text-gray-400 rounded font-bold text-xs uppercase tracking-widest hover:bg-gray-200">CANCEL</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeItem ? <KanbanCard item={activeItem} isDragging /> : null}
        {activePhase ? <PhaseColumn phase={activePhase} phaseIndex={phases.findIndex(p => p.id === activePhase.id) + 1} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
