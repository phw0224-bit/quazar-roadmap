import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import KanbanCard from './KanbanCard';

const colorThemeMap = {
  blue: { bg: 'bg-[#f0f7ff]', border: 'border-[#bcd9ff]', accent: 'text-[#1a73e8]', headerBg: 'border-t-[#1a73e8]' },
  green: { bg: 'bg-[#f0fff4]', border: 'border-[#c6f6d5]', accent: 'text-[#2f855a]', headerBg: 'border-t-[#2f855a]' },
  purple: { bg: 'bg-[#faf5ff]', border: 'border-[#e9d8fd]', accent: 'text-[#6b46c1]', headerBg: 'border-t-[#6b46c1]' },
  gold: { bg: 'bg-[#fffaf0]', border: 'border-[#feebc8]', accent: 'text-[#c05621]', headerBg: 'border-t-[#c05621]' },
  pink: { bg: 'bg-[#fff5f7]', border: 'border-[#fed7e2]', accent: 'text-[#b83280]', headerBg: 'border-t-[#b83280]' },
  rose: { bg: 'bg-[#fff1f2]', border: 'border-[#fecdd3]', accent: 'text-[#e11d48]', headerBg: 'border-t-[#e11d48]' },
  emerald: { bg: 'bg-[#ecfdf5]', border: 'border-[#a7f3d0]', accent: 'text-[#059669]', headerBg: 'border-t-[#059669]' },
  indigo: { bg: 'bg-[#eef2ff]', border: 'border-[#c7d2fe]', accent: 'text-[#4f46e5]', headerBg: 'border-t-[#4f46e5]' },
  teal: { bg: 'bg-[#f0fdfa]', border: 'border-[#99f6e4]', accent: 'text-[#0d9488]', headerBg: 'border-t-[#0d9488]' },
};

const TEAM_COLORS = {
  '감정팀': 'bg-[#ffcc00] text-black',
  '개발팀': 'bg-[#e2e8f0] text-gray-700',
  'AI팀': 'bg-[#c6f6d5] text-green-800',
  '기획팀': 'bg-[#e9d8fd] text-purple-800',
  '지원팀': 'bg-[#fed7e2] text-pink-800',
};

const TEAMS = ['감정팀', '개발팀', 'AI팀', '기획팀', '지원팀'];

export default function PhaseColumn({
  phase, phaseIndex, selectedTeam, selectedTag, selectedStatus, isDragging: isDraggingProp = false,
  onAddItem, onUpdateItem, onDeleteItem, onUpdatePhase, onDeletePhase,
  onAddComment, onUpdateComment, onDeleteComment,
  isReadOnly = false,
}) {
  const theme = colorThemeMap[phase.color] || colorThemeMap.blue;
  const { setNodeRef: setDroppableRef } = useDroppable({ id: phase.id });
  const { attributes, listeners, setNodeRef: setSortableRef, transform, transition, isDragging: isSortableDragging } = useSortable({
    id: phase.id, data: { type: 'Phase', phase },
    disabled: isReadOnly,
  });

  const isDragging = isDraggingProp || isSortableDragging;
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const setNodeRef = (node) => { setDroppableRef(node); setSortableRef(node); };

  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemContent, setNewItemContent] = useState('');
  const [showEditPhase, setShowEditPhase] = useState(false);
  const [editedPhase, setEditedPhase] = useState({ title: phase.title, color: phase.color || 'blue', assignees: phase.assignees || [], teams: phase.teams || [] });
  const [assigneeInput, setAssigneeInput] = useState((phase.assignees || []).join(', '));

  // 필터링 강조 로직
  const isTeamMatch = selectedTeam && (phase.teams || []).includes(selectedTeam);
  const isTagMatch = selectedTag && phase.items.some(item => (item.tags || []).includes(selectedTag));
  const isHighlighted = isTeamMatch || isTagMatch;

  const handleUpdatePhase = async () => {
    const updatedAssignees = assigneeInput.split(',').map(s => s.trim()).filter(s => s !== '');
    await onUpdatePhase(phase.id, { ...editedPhase, assignees: updatedAssignees });
    setShowEditPhase(false);
  };

  const handleToggleTeam = (teamName) => {
    const newTeams = editedPhase.teams.includes(teamName) ? editedPhase.teams.filter(t => t !== teamName) : [...editedPhase.teams, teamName];
    setEditedPhase({ ...editedPhase, teams: newTeams });
  };

  const stopProp = (e) => e.stopPropagation();

  return (
    <div 
      ref={setNodeRef} style={style}
      className={`flex flex-col min-w-[320px] max-w-[320px] rounded-t-lg transition-all border-x border-b ${theme.bg} ${theme.border} 
      ${isHighlighted ? 'ring-4 ring-brand-gold shadow-[0_20px_50px_rgba(197,160,89,0.3)] z-10 scale-[1.02] !border-brand-gold' : 'shadow-sm'} 
      ${isDragging ? 'z-50 shadow-2xl scale-105' : ''}`}
    >
      <div {...attributes} {...listeners} className={`p-4 mb-2 border-t-4 ${theme.headerBg} group ${isReadOnly ? '' : 'cursor-grab active:cursor-grabbing'} relative`}>
        {!showEditPhase ? (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <span className={`text-[10px] font-bold uppercase tracking-tighter ${theme.accent}`}>PHASE {phaseIndex.toString().padStart(2, '0')}</span>
              <div className="flex flex-wrap gap-1 justify-end max-w-[70%]">
                {(phase.teams || []).map(team => <span key={team} className={`px-2 py-0.5 rounded-full text-[9px] font-bold shadow-sm ${TEAM_COLORS[team]}`}>{team}</span>)}
                {(phase.assignees || []).map(person => <span key={person} className="bg-[#f3e8ff] text-purple-900 px-2 py-0.5 rounded-full text-[9px] font-bold shadow-sm">👤 {person}</span>)}
              </div>
            </div>
            <div className="flex justify-between items-center group/title">
              <h2 className={`text-[15px] font-extrabold leading-tight transition-colors ${isHighlighted ? 'text-brand-gold' : 'text-gray-900'}`}>{phase.title}</h2>
              {!isReadOnly && (
                <div className="flex gap-1 opacity-0 group-hover/title:opacity-100" onPointerDown={stopProp}>
                  <button className="text-[9px] text-gray-400 hover:text-brand-gold font-bold cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowEditPhase(true); }}>Edit</button>
                  <button className="text-[9px] text-gray-400 hover:text-red-500 font-bold cursor-pointer" onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete?')) onDeletePhase(phase.id); }}>Del</button>
                </div>
              )}
            </div>
            <div className={`text-[10px] font-bold ${theme.accent}`}>{phase.items.length} 단계</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 py-1" onPointerDown={stopProp}>
            <input type="text" className="w-full p-1.5 border border-brand-gold rounded text-xs focus:outline-none" value={editedPhase.title} onChange={e => setEditedPhase({...editedPhase, title: e.target.value})} placeholder="Title" />
            <input type="text" className="w-full p-1.5 border border-gray-200 rounded text-xs focus:outline-none" value={assigneeInput} onChange={e => setAssigneeInput(e.target.value)} placeholder="Assignees" />
            <div className="flex flex-wrap gap-1">
              {TEAMS.map(t => <button key={t} onClick={() => handleToggleTeam(t)} className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${editedPhase.teams.includes(t) ? TEAM_COLORS[t] : 'bg-gray-100 text-gray-400'}`}>{t}</button>)}
            </div>
            {/* Color Picker */}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {Object.keys(colorThemeMap).map(c => (
                <button 
                  key={c} 
                  onClick={() => setEditedPhase({...editedPhase, color: c})}
                  className={`w-4 h-4 rounded-full border ${editedPhase.color === c ? 'ring-2 ring-offset-1 ring-gray-400' : 'border-gray-200'} ${colorThemeMap[c].bg.replace('bg-', 'bg')}`}
                  style={{ backgroundColor: colorThemeMap[c].accent.match(/\[(.*?)\]/)?.[1] }}
                />
              ))}
            </div>
            <div className="flex gap-1">
              <button onClick={handleUpdatePhase} className="flex-1 py-1 bg-brand-gold text-white rounded text-[10px] font-bold cursor-pointer">SAVE</button>
              <button onClick={() => setShowEditPhase(false)} className="flex-1 py-1 bg-gray-200 text-gray-600 rounded text-[10px] font-bold cursor-pointer">CANCEL</button>
            </div>
          </div>
        )}
      </div>

      <SortableContext items={phase.items.map(i => i.id)} strategy={verticalListSortingStrategy} disabled={isReadOnly}>
        <div ref={setNodeRef} className="flex-1 flex flex-col gap-1.5 p-3 min-h-[100px]">
          {phase.items.map((item, idx) => (
            <KanbanCard
              key={item.id} item={item} itemIndex={idx + 1} phaseId={phase.id} accentColor={theme.accent}
              selectedTeam={selectedTeam} selectedTag={selectedTag} selectedStatus={selectedStatus}
              onUpdateItem={onUpdateItem} onDeleteItem={onDeleteItem} onAddComment={onAddComment} onUpdateComment={onUpdateComment} onDeleteComment={onDeleteComment}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>
      </SortableContext>

      {!isReadOnly && (
        <div className="p-3 pt-1">
          {!showAddItem ? (
            <button className="w-full py-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest hover:text-brand-gold transition-colors text-center border border-dashed border-transparent hover:border-gray-300 rounded cursor-pointer" onClick={() => setShowAddItem(true)}>+ Add Step</button>
          ) : (
            <div className="flex flex-col gap-2 bg-white p-3 rounded shadow-lg border border-gray-100" onPointerDown={e => e.stopPropagation()}>
              <input type="text" placeholder="Step title..." className="w-full p-2 border border-gray-200 rounded text-xs font-bold focus:outline-none" value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} autoFocus />
              <textarea placeholder="Step content..." className="w-full p-2 border border-gray-200 rounded text-xs focus:outline-none min-h-[50px]" value={newItemContent} onChange={e => setNewItemContent(e.target.value)} />
              <div className="flex gap-1.5">
                <button onClick={async () => { if(newItemTitle.trim()) { await onAddItem(phase.id, newItemTitle, newItemContent); setNewItemTitle(''); setNewItemContent(''); setShowAddItem(false); } }} className="flex-1 py-1.5 bg-brand-gold text-white rounded text-[10px] font-bold cursor-pointer">ADD</button>
                <button onClick={() => setShowAddItem(false)} className="flex-1 py-1.5 bg-gray-100 text-gray-400 rounded text-[10px] font-bold cursor-pointer">CANCEL</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
