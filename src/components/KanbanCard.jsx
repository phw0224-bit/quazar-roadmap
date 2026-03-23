import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CommentSection from './CommentSection';

const STATUS_MAP = {
  'in-progress': { label: '진행 중', color: 'bg-blue-100 text-blue-800 ring-1 ring-blue-300 shadow-sm' },
  done: { label: '완료', color: 'bg-green-100 text-green-900 font-black ring-2 ring-green-300 shadow-md' },
};

const TEAM_COLORS = {
  '감정팀': 'bg-[#ffcc00] text-black ring-1 ring-[#e6b800]',
  '개발팀': 'bg-[#e2e8f0] text-gray-900 ring-1 ring-gray-400',
  'AI팀': 'bg-[#c6f6d5] text-green-900 ring-1 ring-green-400',
  '기획팀': 'bg-[#e9d8fd] text-purple-900 ring-1 ring-purple-400',
  '지원팀': 'bg-[#fed7e2] text-pink-900 ring-1 ring-pink-400',
};

const GLOBAL_TAGS = [
  { name: 'AI 핵심', color: 'bg-[#e0e7ff] text-[#312e81] ring-1 ring-[#a5b4fc]' },
  { name: 'B2B', color: 'bg-[#fef3c7] text-[#78350f] ring-1 ring-[#fcd34d]' },
  { name: '캐시카우', color: 'bg-[#fef9c3] text-[#713f12] ring-1 ring-[#fde047]' },
  { name: '핵심 단계', color: 'bg-[#fee2e2] text-[#991b1b] ring-1 ring-[#fca5a5]' },
  { name: '데이터 루프', color: 'bg-[#e6fffa] text-[#134e4a] ring-1 ring-[#5eead4]' },
  { name: '결제', color: 'bg-[#fdf2f8] text-[#831843] ring-1 ring-[#f9a8d4]' },
];

const TEAMS = ['감정팀', '개발팀', 'AI팀', '기획팀', '지원팀'];

export default function KanbanCard({
  item, itemIndex, phaseId, accentColor, selectedTeam, selectedTag, selectedStatus,
  onUpdateItem, onDeleteItem, onAddComment, onUpdateComment, onDeleteComment,
  isDragging = false, isReadOnly = false,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ 
    id: item.id,
    disabled: isReadOnly,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const [showEditContent, setShowEditContent] = useState(false);
  const [editedItem, setEditedItem] = useState({ 
    title: item.title || '', content: item.content || '',
    teams: item.teams || [], assignees: item.assignees || [], tags: item.tags || []
  });
  const [assigneeInput, setAssigneeInput] = useState((item.assignees || []).join(', '));
  const [showComments, setShowComments] = useState(false);

  const isTeamMatch = selectedTeam && (item.teams || []).includes(selectedTeam);
  const isTagMatch = selectedTag && (item.tags || []).includes(selectedTag);
  const isStatusMatch = selectedStatus && item.status === selectedStatus;
  const isHighlighted = isTeamMatch || isTagMatch || isStatusMatch;

  const handleUpdate = async (e) => {
    e?.stopPropagation();
    const updatedAssignees = assigneeInput.split(',').map(s => s.trim()).filter(s => s !== '');
    await onUpdateItem(phaseId, item.id, { ...editedItem, assignees: updatedAssignees });
    setShowEditContent(false);
  };

  const handleToggleTag = (tagName) => {
    const newTags = editedItem.tags.includes(tagName)
      ? editedItem.tags.filter(t => t !== tagName)
      : [...editedItem.tags, tagName];
    setEditedItem({ ...editedItem, tags: newTags });
  };

  const handleToggleTeam = (teamName) => {
    const newTeams = editedItem.teams.includes(teamName)
      ? editedItem.teams.filter(t => t !== teamName)
      : [...editedItem.teams, teamName];
    setEditedItem({ ...editedItem, teams: newTeams });
  };

  const stopProp = (e) => e.stopPropagation();

  return (
    <div
      ref={setNodeRef} style={style}
      className={`relative bg-white border rounded-[4px] p-3 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-md group flex flex-col gap-2
      ${isReadOnly ? 'cursor-default' : 'cursor-grab'}
      ${item.isSelected ? 'border-blue-600 bg-blue-50/20 ring-1 ring-blue-600/10' : 'border-gray-200'} 
      ${isHighlighted ? 'border-2 !border-brand-gold shadow-md ring-1 ring-brand-gold/20 scale-[1.01] z-10' : ''}
      ${isSortableDragging || isDragging ? 'opacity-50 shadow-lg ring-2 ring-brand-gold z-50' : 'opacity-100'}`}
      {...attributes} {...listeners}
    >
      <div className="flex items-start gap-3">
        <div className={`text-[16px] font-black min-w-[20px] text-right pt-0.5 leading-none ${isHighlighted ? 'text-brand-gold' : (accentColor || 'text-gray-300')}`}>
          {itemIndex?.toString().padStart(2, '0')}
        </div>
        
        <div className="flex-1 flex flex-col gap-1.5">
          {!showEditContent ? (
            <>
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 flex flex-col gap-1">
                  <h3 className={`m-0 text-[18px] font-black leading-[1.3] tracking-tighter transition-colors ${isHighlighted ? 'text-brand-gold' : 'text-gray-900'}`}>
                    {item.title || item.content}
                  </h3>
                  {item.title && item.content && (
                    <p className="m-0 text-[14px] font-bold text-gray-600 leading-[1.6]">{item.content}</p>
                  )}
                </div>
                
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div 
                    onClick={(e) => { 
                      if (isReadOnly) return;
                      e.stopPropagation(); 
                      onUpdateItem(phaseId, item.id, { isSelected: !item.isSelected }); 
                    }} 
                    onPointerDown={stopProp}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isReadOnly ? 'cursor-default' : 'cursor-pointer'} ${item.isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'border-gray-200 bg-white hover:border-blue-400'}`}
                  >
                    {item.isSelected && <span className="text-[12px] font-black">✓</span>}
                  </div>
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
                    <span key={tagName} className={`px-2 py-1 rounded-[3px] text-[12px] font-black tracking-tight shadow-sm ${tagInfo.color}`}>
                      {tagName}
                    </span>
                  ) : null;
                })}
                {(item.teams || []).map(team => (
                  <span key={team} className={`px-2 py-1 rounded-full text-[12px] font-black shadow-sm ${TEAM_COLORS[team]}`}>
                    {team}
                  </span>
                ))}
                {(item.assignees || []).map(person => (
                  <span key={person} className="bg-white border border-gray-100 text-gray-800 px-2 py-1 rounded-full text-[12px] font-black shadow-sm">
                    👤 {person}
                  </span>
                ))}
              </div>

              <div className="flex justify-between items-center mt-2.5" onPointerDown={stopProp}>
                <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isReadOnly && (
                    <>
                      <select 
                        className="text-[12px] font-black bg-transparent border-none focus:outline-none cursor-pointer text-gray-400 hover:text-brand-gold"
                        value={item.status || 'none'}
                        onChange={(e) => { e.stopPropagation(); onUpdateItem(phaseId, item.id, { status: e.target.value }); }}
                        onPointerDown={stopProp}
                      >
                        <option value="none">상태 없음</option>
                        <option value="in-progress">진행 중</option>
                        <option value="done">완료</option>
                      </select>
                      <button className="text-[12px] text-gray-400 hover:text-brand-gold font-black uppercase tracking-widest cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowEditContent(true); }} onPointerDown={stopProp}>Edit</button>
                      <button className="text-[12px] text-gray-400 hover:text-red-500 font-black uppercase tracking-widest cursor-pointer" onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete item?')) onDeleteItem(phaseId, item.id); }} onPointerDown={stopProp}>Del</button>
                    </>
                  )}
                </div>
                <button className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[12px] font-black transition-colors cursor-pointer ${showComments ? 'text-brand-gold bg-amber-50' : 'text-gray-300 hover:text-gray-500'}`} onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }} onPointerDown={stopProp}>
                  <span>💬</span> {(item.comments || []).length > 0 && <span>{(item.comments || []).length}</span>}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3 py-1" onPointerDown={stopProp}>
              <input type="text" className="w-full p-2.5 border border-brand-gold rounded text-[16px] font-black focus:outline-none bg-white shadow-sm" value={editedItem.title} onChange={(e) => setEditedItem({...editedItem, title: e.target.value})} placeholder="Title" />
              <textarea className="w-full p-2.5 border border-gray-200 rounded text-[14px] font-bold resize-y min-h-[60px] focus:outline-none bg-white shadow-sm" value={editedItem.content} onChange={(e) => setEditedItem({...editedItem, content: e.target.value})} placeholder="Content" />
              
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded w-fit">Assignees (Comma)</span>
                <input type="text" className="w-full p-2 border border-gray-200 rounded text-[13px] font-black focus:outline-none" value={assigneeInput} onChange={e => setAssigneeInput(e.target.value)} placeholder="홍길동, 김철수" />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded w-fit">Global Tags</span>
                <div className="flex flex-wrap gap-2">
                  {GLOBAL_TAGS.map(tag => (
                    <button key={tag.name} onClick={() => handleToggleTag(tag.name)} className={`px-2.5 py-1.5 rounded-[4px] text-[12px] font-black transition-all cursor-pointer shadow-sm ${editedItem.tags.includes(tag.name) ? tag.color : 'bg-gray-100 text-gray-400 opacity-60'}`}>{tag.name}</button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded w-fit">Teams</span>
                <div className="flex flex-wrap gap-2">
                  {TEAMS.map(team => (
                    <button key={team} onClick={() => handleToggleTeam(team)} className={`px-2.5 py-1.5 rounded-full text-[12px] font-black transition-all cursor-pointer shadow-sm ${editedItem.teams.includes(team) ? TEAM_COLORS[team] : 'bg-gray-100 text-gray-400 opacity-60'}`}>{team}</button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <button onClick={handleUpdate} className="flex-1 py-2 bg-brand-gold text-white rounded text-[13px] font-black tracking-widest hover:bg-[#b38f4d] cursor-pointer shadow-md">SAVE</button>
                <button onClick={(e) => { e.stopPropagation(); setShowEditContent(false); }} className="flex-1 py-2 bg-gray-200 text-gray-700 rounded text-[13px] font-black tracking-widest hover:bg-gray-300 cursor-pointer">CANCEL</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showComments && (
        <div className="w-full mt-2 pt-2 border-t border-gray-50" onPointerDown={stopProp}>
          <CommentSection phaseId={phaseId} itemId={item.id} comments={item.comments || []} onAddComment={onAddComment} onUpdateComment={onUpdateComment} onDeleteComment={onDeleteComment} />
        </div>
      )}
    </div>
  );
}
