import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CommentSection from './CommentSection';

const TEAMS = ['감정팀', '개발팀', 'AI팀', '기획팀', '지원팀'];

function ItemDetailPanel({ 
  item, phase, allItems = [], onClose, onUpdateItem, isReadOnly,
  isFullscreen = false, onToggleFullscreen,
  onBreadcrumbNavigate,
  onAddComment, onUpdateComment, onDeleteComment, onOpenDetail,
  onShowConfirm, onShowToast
}) {
  const [description, setDescription] = useState(item?.description || '');
  const [isEditingAssignees, setIsEditingAssignees] = useState(false);
  const [assigneeInput, setAssigneeInput] = useState((item?.assignees || []).join(', '));
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isEditingRelations, setIsEditingRelations] = useState(false);
  const [relationSearchQuery, setRelationSearchQuery] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(item?.title || item?.content || '');
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  useEffect(() => {
    setDescription(item?.description || '');
    setAssigneeInput((item?.assignees || []).join(', '));
    setTitleInput(item?.title || item?.content || '');
    setIsEditingRelations(false);
    setRelationSearchQuery('');
    setIsEditingTitle(false);
    setIsEditingDescription(false);
  }, [item]);

  const handleSaveDescription = async () => {
    if (description !== (item.description || '')) {
      await onUpdateItem(phase.id, item.id, { description });
    }
    setIsEditingDescription(false);
  };

  const handleSaveAssignees = async () => {
    const updated = assigneeInput.split(',').map(s => s.trim()).filter(s => s !== '');
    await onUpdateItem(phase.id, item.id, { assignees: updated });
    setIsEditingAssignees(false);
    onShowToast?.('담당자가 업데이트되었습니다.');
  };

  const handleAddTag = async () => {
    if (!newTagInput.trim()) {
      setIsEditingTags(false);
      return;
    }
    const currentTags = item.tags || [];
    if (!currentTags.includes(newTagInput.trim())) {
      await onUpdateItem(phase.id, item.id, { tags: [...currentTags, newTagInput.trim()] });
      onShowToast?.(`태그 #${newTagInput.trim()} 추가됨`);
    }
    setNewTagInput('');
    setIsEditingTags(false);
  };

  const handleRemoveTag = async (tag) => {
    const updated = (item.tags || []).filter(t => t !== tag);
    await onUpdateItem(phase.id, item.id, { tags: updated });
    onShowToast?.(`태그 #${tag} 삭제됨`);
  };

  const handleToggleTeam = async (team) => {
    const currentTeams = item.teams || [];
    const isAdding = !currentTeams.includes(team);
    const updated = currentTeams.includes(team) 
      ? currentTeams.filter(t => t !== team) 
      : [...currentTeams, team];
    await onUpdateItem(phase.id, item.id, { teams: updated });
    onShowToast?.(`${team} ${isAdding ? '추가' : '제외'}됨`);
  };

  const handleAddRelation = async (relatedItemId) => {
    const currentRelations = item.related_items || [];
    if (!currentRelations.includes(relatedItemId)) {
      try {
        await onUpdateItem(phase.id, item.id, { related_items: [...currentRelations, relatedItemId] });
        onShowToast?.('연관 업무가 연결되었습니다.');
      } catch (err) {
        console.error('Failed to add relation:', err);
        onShowToast?.('연관 업무 저장에 실패했습니다.');
        return;
      }
    }
    setRelationSearchQuery('');
    setIsEditingRelations(false);
  };

  const handleRemoveRelation = async (relatedItemId) => {
    const updated = (item.related_items || []).filter(id => id !== relatedItemId);
    try {
      await onUpdateItem(phase.id, item.id, { related_items: updated });
    } catch (err) {
      console.error('Failed to remove relation:', err);
      onShowToast?.('연관 업무 저장에 실패했습니다.');
    }
  };

  const boardType = (phase?.board_type || 'main').toLowerCase();
  const boardLabel = boardType === 'main' ? '전체 보드' : `${phase?.board_type || '팀'} 보드`;
  const statusLabel = item.status === 'done' ? '완료' : item.status === 'in-progress' ? '진행 중' : '미지정';
  const assigneeCount = (item.assignees || []).length;
  const teamCount = (item.teams || []).length;

  const handleQuickToggleDone = async () => {
    const isDone = item.status === 'done' || item.isSelected;
    const nextStatus = isDone ? 'none' : 'done';
    await onUpdateItem(phase.id, item.id, { status: nextStatus, isSelected: !isDone });
    onShowToast?.(isDone ? '완료 표시를 해제했습니다.' : '완료로 표시했습니다.');
  };

  if (!item) return null;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#191919] relative animate-slide-in shadow-2xl transition-colors duration-200">
      {/* Top Header */}
      <div className="px-6 py-3.5 flex justify-between items-start gap-4 bg-white dark:bg-[#191919] border-b border-gray-100 dark:border-[#2f2f2f]">
        <div className="flex items-start gap-3 min-w-0">
          <button onClick={onClose} className="p-1.5 mt-0.5 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <button
            onClick={onToggleFullscreen}
            className="p-1.5 mt-0.5 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors cursor-pointer"
            aria-label={isFullscreen ? 'Exit fullscreen detail panel' : 'Open fullscreen detail panel'}
            title={isFullscreen ? '일반 크기로 보기' : '전체 화면으로 보기'}
          >
            {isFullscreen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6" />
              </svg>
            )}
          </button>

          <div className="min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[11px] font-black text-gray-400 uppercase tracking-widest min-w-0">
              <button
                onClick={() => onBreadcrumbNavigate?.('board', { boardType })}
                className="bg-gray-100 dark:bg-[#2a2a2a] px-2 py-0.5 rounded text-gray-500 dark:text-gray-300 shrink-0 hover:text-gray-800 dark:hover:text-gray-100 cursor-pointer transition-colors"
                title={`${boardLabel}로 이동`}
              >
                📂 {boardLabel}
              </button>
              <span>›</span>
              <button
                onClick={() => onBreadcrumbNavigate?.('phase', { phaseId: phase?.id, boardType })}
                className="bg-gray-100 dark:bg-[#2a2a2a] px-2 py-0.5 rounded text-gray-500 dark:text-gray-300 shrink-0 hover:text-gray-800 dark:hover:text-gray-100 cursor-pointer transition-colors"
                title={`${phase?.title || '분류'}로 이동`}
              >
                🧭 {phase?.title}
              </button>
              <span>›</span>
              <span className="text-gray-900 dark:text-gray-100 truncate max-w-[260px]">{item.title || item.content}</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#3a3a3a]">
                상태: {statusLabel}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#3a3a3a]">
                담당자 {assigneeCount}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#3a3a3a]">
                팀 {teamCount}
              </span>
            </div>
          </div>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleQuickToggleDone}
              className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/25 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/35 transition-colors cursor-pointer"
            >
              {item.status === 'done' || item.isSelected ? '완료 해제' : '완료 처리'}
            </button>
            {!isEditingDescription && (
              <button
                onClick={() => setIsEditingDescription(true)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest bg-gray-100 dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#3a3a3a] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#343434] transition-colors cursor-pointer"
              >
                설명 편집
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto px-10 py-12 flex flex-col gap-12">
          
          {/* Title */}
          {!isEditingTitle ? (
            <h1 
              onClick={() => !isReadOnly && setIsEditingTitle(true)}
              className={`text-4xl font-black text-gray-900 dark:text-[#E3E3E3] leading-tight tracking-tighter outline-none ${!isReadOnly ? 'hover:bg-gray-50 dark:hover:bg-[#242424] cursor-pointer rounded-lg px-2 -ml-2 transition-colors' : ''}`}
            >
              {item.title || item.content}
            </h1>
          ) : (
            <input 
              autoFocus
              className="text-4xl font-black text-gray-900 dark:text-[#E3E3E3] leading-tight tracking-tighter outline-none bg-gray-50 dark:bg-[#242424] rounded-lg px-2 -ml-2 w-full border-none focus:ring-0"
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              onBlur={() => {
                if (titleInput !== (item.title || item.content)) {
                  onUpdateItem(phase.id, item.id, { title: titleInput });
                  onShowToast?.('제목이 업데이트되었습니다.');
                }
                setIsEditingTitle(false);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (titleInput !== (item.title || item.content)) {
                    onUpdateItem(phase.id, item.id, { title: titleInput });
                    onShowToast?.('제목이 업데이트되었습니다.');
                  }
                  setIsEditingTitle(false);
                }
              }}
            />
          )}

          {/* Notion Properties Style */}
          <div className="flex flex-col gap-2">
            {/* Status */}
            <div className="flex items-center min-h-[42px] group">
              <div className="w-40 flex items-center gap-2 text-gray-400 font-bold text-[15px] shrink-0">
                <span className="w-5 text-center text-lg">⚡</span>
                <span>상태</span>
              </div>
              <div className="flex-1 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-[#242424] transition-colors relative">
                <select 
                  disabled={isReadOnly}
                  className="bg-transparent border-none p-0 font-black text-[15px] text-gray-800 dark:text-gray-200 focus:ring-0 cursor-pointer appearance-none uppercase w-full"
                  value={item.status || 'none'}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    onUpdateItem(phase.id, item.id, { status: newStatus });
                    onShowToast?.(`상태가 ${newStatus === 'done' ? '완료' : newStatus === 'in-progress' ? '진행 중' : '미지정'}로 변경됨`);
                  }}
                >
                  <option value="none">⚪ 상태 없음</option>
                  <option value="in-progress">🔵 진행 중</option>
                  <option value="done">🟢 완료</option>
                </select>
              </div>
            </div>

            {/* Assignees */}
            <div className="flex items-center min-h-[42px] group">
              <div className="w-40 flex items-center gap-2 text-gray-400 font-bold text-[15px] shrink-0">
                <span className="w-5 text-center text-lg">👤</span>
                <span>담당자</span>
              </div>
              <div 
                className={`flex-1 px-2 py-1 rounded-lg transition-all min-h-[32px] flex items-center ${!isReadOnly ? 'hover:bg-gray-50 dark:hover:bg-[#242424] cursor-pointer' : ''} ${isEditingAssignees ? 'bg-gray-50 dark:bg-[#242424] ring-2 ring-blue-500/20' : ''}`}
                onClick={() => !isReadOnly && setIsEditingAssignees(true)}
              >
                {!isEditingAssignees ? (
                  <div className="flex flex-wrap gap-1.5 w-full">
                    {(item.assignees || []).length > 0 ? (
                       item.assignees.map(a => <span key={a} className="bg-gray-100 dark:bg-[#2c2c2c] text-gray-700 dark:text-gray-200 px-2.5 py-1 rounded text-[14px] font-bold">@{a}</span>)
                     ) : <span className="text-gray-300 dark:text-gray-500 text-[15px] font-medium">비어 있음</span>}
                   </div>
                 ) : (
                   <input 
                     autoFocus
                     className="w-full bg-transparent border-none p-0 text-[15px] font-bold focus:ring-0 outline-none"
                    placeholder="이름 입력 (쉼표로 구분)..."
                    value={assigneeInput}
                    onChange={e => setAssigneeInput(e.target.value)}
                    onBlur={handleSaveAssignees}
                    onKeyDown={e => e.key === 'Enter' && handleSaveAssignees()}
                  />
                )}
              </div>
            </div>

            {/* Teams */}
            <div className="flex items-start min-h-[42px] group mt-1">
              <div className="w-40 flex items-center gap-2 text-gray-400 font-bold text-[15px] shrink-0 pt-1.5">
                <span className="w-5 text-center text-lg">🏢</span>
                <span>소속 팀</span>
              </div>
              <div className="flex-1 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-[#242424] transition-colors flex flex-wrap gap-1.5 min-h-[32px] items-center">
                {TEAMS.map(team => (
                  <button
                    key={team}
                    disabled={isReadOnly}
                    onClick={() => handleToggleTeam(team)}
                    className={`px-3 py-1 rounded-full text-[13px] font-black transition-all border ${item.teams?.includes(team) ? 'bg-gray-900 border-gray-900 text-white dark:bg-[#383838] dark:border-[#4a4a4a] dark:text-gray-100 shadow-sm' : 'bg-white dark:bg-[#222222] border-gray-200 dark:border-[#3a3a3a] text-gray-400 dark:text-gray-300 hover:border-gray-400 dark:hover:border-[#585858] cursor-pointer'}`}
                  >
                    {team}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags (Free Creation) */}
            <div className="flex items-start min-h-[42px] group mt-1">
              <div className="w-40 flex items-center gap-2 text-gray-400 font-bold text-[15px] shrink-0 pt-1.5">
                <span className="w-5 text-center text-lg">🏷️</span>
                <span>태그</span>
              </div>
              <div 
                className={`flex-1 px-2 py-1 rounded-lg transition-all min-h-[32px] flex flex-wrap gap-1.5 items-center ${!isReadOnly ? 'hover:bg-gray-50 dark:hover:bg-[#242424] cursor-pointer' : ''} ${isEditingTags ? 'bg-gray-50 dark:bg-[#242424] ring-2 ring-blue-500/20' : ''}`}
                onClick={() => !isReadOnly && setIsEditingTags(true)}
              >
                {(item.tags || []).map(tag => (
                  <span key={tag} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/35 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/50 px-2.5 py-1 rounded text-[13px] font-black shadow-sm group/tag">
                    {tag}
                    {!isReadOnly && <button onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }} className="hover:text-red-600 cursor-pointer opacity-0 group-hover/tag:opacity-100 transition-opacity">✕</button>}
                  </span>
                ))}
                {!isReadOnly && (
                  isEditingTags ? (
                    <input 
                      autoFocus
                      placeholder="태그 입력..."
                      className="bg-transparent border-none p-0 text-[13px] font-bold text-gray-800 dark:text-gray-200 focus:ring-0 w-28"
                      value={newTagInput}
                      onChange={e => setNewTagInput(e.target.value)}
                      onBlur={handleAddTag}
                      onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                    />
                  ) : (
                    <span className="text-gray-300 dark:text-gray-500 text-[13px] font-bold">+ 태그 추가</span>
                  )
                )}
                 {(!item.tags || item.tags.length === 0) && !isEditingTags && !isReadOnly && <span className="text-gray-300 dark:text-gray-500 text-[15px] font-medium ml-1">비어 있음</span>}
               </div>
             </div>

            {/* Related Items (Relations) */}
            <div className="flex items-start min-h-[42px] group mt-1">
              <div className="w-40 flex items-center gap-2 text-gray-400 font-bold text-[15px] shrink-0 pt-1.5">
                <span className="w-5 text-center text-lg">🔗</span>
                <span>연관 업무</span>
              </div>
              <div 
                className={`flex-1 px-2 py-1 rounded-lg transition-all min-h-[32px] flex flex-col gap-1.5 justify-center ${!isReadOnly ? 'hover:bg-gray-50 dark:hover:bg-[#242424]' : ''} ${isEditingRelations ? 'bg-gray-50 dark:bg-[#242424] ring-2 ring-blue-500/20' : ''}`}
                onClick={() => { if (!isReadOnly && !isEditingRelations) setIsEditingRelations(true); }}
              >
                <div className="flex flex-wrap gap-1.5 items-center">
                  {(item.related_items || []).map(relatedId => {
                    const relatedItem = allItems.find(i => i.id === relatedId);
                    if (!relatedItem) return null;
                    return (
                      <span 
                        key={relatedId} 
                        onClick={(e) => { e.stopPropagation(); onOpenDetail?.(relatedId); }}
                        className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/25 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800/40 px-2.5 py-1 rounded text-[13px] font-bold shadow-sm group/rel cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                      >
                        ↗ {relatedItem.title || relatedItem.content}
                        {!isReadOnly && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRemoveRelation(relatedId); }} 
                            className="hover:text-red-600 cursor-pointer opacity-0 group-hover/rel:opacity-100 transition-opacity ml-1"
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    );
                  })}
                  {!isReadOnly && !isEditingRelations && (
                    <span className="text-gray-300 dark:text-gray-500 text-[13px] font-bold cursor-pointer hover:text-gray-500 dark:hover:text-gray-300">+ 연관 업무 추가</span>
                  )}
                   {(!item.related_items || item.related_items.length === 0) && !isEditingRelations && !isReadOnly && (
                     <span className="text-gray-300 dark:text-gray-500 text-[15px] font-medium ml-1">비어 있음</span>
                   )}
                </div>

                {/* Relation Search Dropdown */}
                {isEditingRelations && !isReadOnly && (
                  <div className="relative w-full mt-1">
                    <input 
                      autoFocus
                      placeholder="업무 검색..."
                      className="w-full bg-white dark:bg-[#242424] border border-gray-200 dark:border-[#3a3a3a] p-2.5 rounded text-[13px] font-bold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/40 outline-none shadow-sm"
                      value={relationSearchQuery}
                      onChange={e => setRelationSearchQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Escape') setIsEditingRelations(false); }}
                    />
                    <div className="absolute top-full left-0 w-full max-h-48 overflow-y-auto bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#3a3a3a] rounded-b shadow-lg z-50 mt-1 custom-scrollbar">
                      {allItems
                        .filter(i => i.id !== item.id && !(item.related_items || []).includes(i.id))
                        .filter(i => !relationSearchQuery || (i.title || i.content).toLowerCase().includes(relationSearchQuery.toLowerCase()))
                        .map(searchItem => (
                          <div 
                            key={searchItem.id}
                            onClick={(e) => { e.stopPropagation(); handleAddRelation(searchItem.id); }}
                            className="p-2.5 text-[13px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] cursor-pointer border-b border-gray-50 dark:border-[#2f2f2f] last:border-none"
                          >
                            <span className="text-gray-400 mr-2 text-[10px] uppercase">{searchItem.teams?.[0] || '전체'}</span>
                            {searchItem.title || searchItem.content}
                          </div>
                        ))}
                      {allItems.filter(i => i.id !== item.id && !(item.related_items || []).includes(i.id)).filter(i => !relationSearchQuery || (i.title || i.content).toLowerCase().includes(relationSearchQuery.toLowerCase())).length === 0 && (
                        <div className="p-3 text-[11px] text-gray-400 text-center">검색 결과가 없습니다.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-gray-100 dark:bg-[#2f2f2f] my-4"></div>

          {/* Description */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-[15px] font-black text-gray-400 uppercase tracking-[0.2em]">상세 설명 (Wiki)</h3>
                {isEditingDescription && <span className="text-[10px] text-green-500 font-black animate-pulse flex items-center gap-1"><span>●</span> Editing...</span>}
              </div>
              {!isReadOnly && !isEditingDescription && (
                <button 
                  onClick={() => setIsEditingDescription(true)}
                  className="text-[12px] font-black text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 uppercase tracking-widest transition-colors"
                >
                  Edit Markdown
                </button>
              )}
            </div>
            
            {!isEditingDescription || isReadOnly ? (
              <div 
                onClick={() => !isReadOnly && setIsEditingDescription(true)}
                className={`detail-markdown prose prose-slate dark:prose-invert max-w-none text-[18px] text-gray-800 dark:text-gray-200 leading-relaxed min-h-[300px] font-medium p-4 -m-4 rounded-xl transition-colors ${!isReadOnly ? 'hover:bg-gray-50 dark:hover:bg-[#242424] cursor-pointer' : ''}`}
              >
                {description ? (
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-300 hover:underline decoration-2 underline-offset-4" onClick={e => e.stopPropagation()} />,
                      h1: ({...props}) => <h1 {...props} className="text-3xl font-black mt-8 mb-4 tracking-tighter" />,
                      h2: ({...props}) => <h2 {...props} className="text-2xl font-black mt-6 mb-3 tracking-tighter" />,
                      h3: ({...props}) => <h3 {...props} className="text-xl font-black mt-4 mb-2 tracking-tighter" />,
                      ul: ({...props}) => <ul {...props} className="list-disc pl-5 my-4 space-y-2" />,
                      ol: ({...props}) => <ol {...props} className="list-decimal pl-5 my-4 space-y-2" />,
                      blockquote: ({...props}) => <blockquote {...props} className="border-l-4 border-gray-200 dark:border-[#3a3a3a] pl-4 italic my-6 text-gray-600 dark:text-gray-300" />,
                      table: ({...props}) => (
                        <div className="detail-markdown-scroll my-5">
                          <table {...props} className="detail-markdown-table" />
                        </div>
                      ),
                      pre: ({...props}) => (
                        <div className="detail-markdown-scroll my-4">
                          <pre {...props} className="detail-markdown-pre" />
                        </div>
                      ),
                      code: ({inline, ...props}) => (
                        inline 
                          ? <code {...props} className="bg-gray-100 dark:bg-[#2a2a2a] text-red-500 dark:text-red-300 px-1.5 py-0.5 rounded text-sm font-bold" />
                          : <code {...props} className="detail-markdown-codeblock" />
                      )
                    }}
                  >
                    {description}
                  </ReactMarkdown>
                ) : (
                  <span className="text-[17px] text-gray-300 dark:text-gray-500 italic font-normal">작성된 상세 내용이 없습니다. 클릭하여 내용을 입력하세요.</span>
                )}
              </div>
            ) : (
              <textarea
                autoFocus
                className="w-full min-h-[400px] text-[18px] text-gray-800 dark:text-[#E3E3E3] leading-relaxed focus:outline-none resize-none bg-gray-50 dark:bg-[#252525] p-6 rounded-2xl font-medium placeholder-gray-300 dark:placeholder-gray-500 border-none ring-1 ring-gray-100 dark:ring-[#373737] focus:ring-blue-500/20 shadow-inner"
                placeholder="지침, 레퍼런스, 상세 업무 내용을 자유롭게 기록하세요... (마크다운 지원)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleSaveDescription}
              />
            )}
          </div>

          <div className="h-[1px] bg-gray-100 dark:bg-[#2f2f2f] my-4"></div>

          {/* Comments */}
          <div className="flex flex-col gap-8 pb-32">
            <h3 className="text-[15px] font-black text-gray-400 uppercase tracking-[0.2em]">팀 코멘트</h3>
            <CommentSection 
              phaseId={phase.id} itemId={item.id} comments={item.comments || []} 
              onAddComment={onAddComment} onUpdateComment={onUpdateComment} onDeleteComment={onDeleteComment}
              onShowConfirm={onShowConfirm} onShowToast={onShowToast}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ItemDetailPanel;
