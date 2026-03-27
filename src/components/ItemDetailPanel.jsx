import { useState, useEffect, useRef } from 'react';
import {
  ChevronsRight, Maximize2, Minimize2, ChevronRight, CheckCircle2,
  Clock, Users, Building2, Tag, Link2, FileText, Plus, X,
  MessageSquare, Search, ArrowUpRight, AlignCenter, AlignJustify
} from 'lucide-react';
import CommentSection from './CommentSection';
import TiptapEditor from './TiptapEditor';
import { TEAMS, STATUS_MAP } from '../lib/constants';

function ItemDetailPanel({ 
  item, phase, allItems = [], onClose, onUpdateItem, isReadOnly,
  isFullscreen = false, onToggleFullscreen,
  onBreadcrumbNavigate,
  onAddComment, onUpdateComment, onDeleteComment, onOpenDetail,
  onShowConfirm, onShowToast
}) {
  const stopProp = (e) => e.stopPropagation();
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
  const [isWideView, setIsWideView] = useState(false);
  const isCancellingDescriptionRef = useRef(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setDescription(item?.description || '');
    setAssigneeInput((item?.assignees || []).join(', '));
    setTitleInput(item?.title || item?.content || '');
    setIsEditingRelations(false);
    setRelationSearchQuery('');
    setIsEditingTitle(false);
    setIsEditingDescription(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [item]);

  const handleSaveDescription = async () => {
    if (description !== (item.description || '')) {
      await onUpdateItem(phase.id, item.id, { description });
      onShowToast?.('상세 설명이 저장되었습니다.');
    }
    setIsEditingDescription(false);
  };

  const handleDescriptionBlur = () => {
    if (isCancellingDescriptionRef.current) return;
    handleSaveDescription();
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
      } catch {
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
    } catch {
      onShowToast?.('연관 업무 저장에 실패했습니다.');
    }
  };

  const boardType = (phase?.board_type || 'main').toLowerCase();
  const boardLabel = boardType === 'main' ? '전체 보드' : `${phase?.board_type || '팀'} 보드`;
  const statusInfo = STATUS_MAP[item.status || 'none'];
  const assigneeCount = (item.assignees || []).length;
  const teamCount = (item.teams || []).length;

  const handleQuickToggleDone = async () => {
    const isDone = item.status === 'done';
    const nextStatus = isDone ? 'none' : 'done';
    await onUpdateItem(phase.id, item.id, { status: nextStatus });
    onShowToast?.(isDone ? '완료 표시를 해제했습니다.' : '완료로 표시했습니다.');
  };

  if (!item) return null;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-bg-base relative animate-slide-in">
      {/* Top Header */}
      <div className="px-8 py-4 flex justify-between items-start gap-4 bg-white/80 dark:bg-bg-base/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 dark:border-border-subtle">
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex items-center gap-1.5">
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-bg-hover rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-text-primary transition-all duration-200 cursor-pointer">
              <ChevronsRight size={20} strokeWidth={2.5} />
            </button>
            <button
              onClick={onToggleFullscreen}
              className="p-2 hover:bg-gray-100 dark:hover:bg-bg-hover rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-text-primary transition-all duration-200 cursor-pointer"
              aria-label={isFullscreen ? '창 모드로 전환' : '전체 화면으로 전환'}
              title={isFullscreen ? '창 모드로 전환' : '전체 화면으로 전환'}
            >
              {isFullscreen ? <Minimize2 size={20} strokeWidth={2.5} /> : <Maximize2 size={20} strokeWidth={2.5} />}
            </button>
            <button
              onClick={() => setIsWideView(v => !v)}
              className={`p-2 rounded-xl transition-all duration-200 cursor-pointer ${isWideView ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-bg-hover hover:text-gray-900 dark:hover:text-text-primary'}`}
              title={isWideView ? '기본 너비로 보기' : '넓게 보기'}
            >
              {isWideView ? <AlignCenter size={20} strokeWidth={2.5} /> : <AlignJustify size={20} strokeWidth={2.5} />}
            </button>
          </div>

          <div className="min-w-0 flex flex-col gap-2.5">
            <nav className="flex items-center gap-2 text-[13px] font-black uppercase tracking-widest min-w-0">
              <button
                onClick={() => onBreadcrumbNavigate?.('board', { boardType })}
                className="bg-gray-100 dark:bg-bg-hover px-2.5 py-1 rounded-lg text-gray-500 dark:text-text-secondary shrink-0 hover:text-gray-900 dark:hover:text-text-primary cursor-pointer transition-all border border-transparent hover:border-gray-200 dark:hover:border-border-strong"
              >
                📂 {boardLabel}
              </button>
              <ChevronRight size={12} strokeWidth={3} className="text-gray-300 dark:text-text-tertiary" />
              <button
                onClick={() => onBreadcrumbNavigate?.('project', { projectId: phase?.id, boardType })}
                className="bg-gray-100 dark:bg-bg-hover px-2.5 py-1 rounded-lg text-gray-500 dark:text-text-secondary shrink-0 hover:text-gray-900 dark:hover:text-text-primary cursor-pointer transition-all border border-transparent hover:border-gray-200 dark:hover:border-border-strong"
              >
                🧭 {phase?.title}
              </button>
              <ChevronRight size={12} strokeWidth={3} className="text-gray-300 dark:text-text-tertiary" />
              <span className="text-gray-900 dark:text-text-primary truncate font-black">{item.title || item.content}</span>
            </nav>

            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest shadow-sm border border-white/20 dark:border-black/10 transition-colors ${statusInfo.color}`}>
                상태: {statusInfo.label}
              </span>
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest bg-gray-50 dark:bg-bg-hover text-gray-500 dark:text-text-secondary border border-gray-200 dark:border-border-subtle shadow-sm tabular-nums">
                담당자 {assigneeCount}
              </span>
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest bg-gray-50 dark:bg-bg-hover text-gray-500 dark:text-text-secondary border border-gray-200 dark:border-border-subtle shadow-sm tabular-nums">
                팀 {teamCount}
              </span>
            </div>
          </div>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-3 shrink-0 pt-1">
            <button
              onClick={handleQuickToggleDone}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-md hover:shadow-lg active:scale-95 border ${
                item.status === 'done'
                  ? 'bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600'
                  : 'bg-white dark:bg-bg-elevated border-gray-200 dark:border-border-subtle text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
              }`}
            >
              <CheckCircle2 size={16} strokeWidth={3} />
              {item.status === 'done' ? '완료 취소' : '완료 처리'}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-bg-base transition-colors duration-200">
        <div className={`${isWideView ? 'px-24' : 'max-w-4xl mx-auto px-12'} py-16 flex flex-col gap-16 transition-all duration-300`}>
          
          {/* Title */}
          <div className="flex flex-col gap-4">
            <span className="text-[11px] font-black text-blue-500 uppercase tracking-[0.3em] ml-1">Work Item Title</span>
            {!isEditingTitle ? (
              <h1 
                onClick={() => !isReadOnly && setIsEditingTitle(true)}
                className={`text-display text-gray-900 dark:text-text-primary outline-none transition-all duration-200 ${!isReadOnly ? 'hover:bg-gray-50 dark:hover:bg-bg-hover cursor-pointer rounded-2xl p-2 -ml-2' : ''}`}
              >
                {item.title || item.content}
              </h1>
            ) : (
              <input 
                autoFocus
                className="text-display text-gray-900 dark:text-text-primary bg-gray-50 dark:bg-bg-hover rounded-2xl p-2 -ml-2 w-full border-none focus:ring-4 focus:ring-blue-500/10"
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
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
              />
            )}
          </div>

          {/* Notion Properties Style */}
          <div className="bg-gray-50/50 dark:bg-bg-elevated/30 rounded-3xl p-8 border border-gray-100 dark:border-border-subtle flex flex-col gap-4">
            {/* Status */}
            <div className="flex items-center min-h-[48px] group">
              <div className="w-48 flex items-center gap-3 text-gray-400 dark:text-text-tertiary shrink-0">
                <Clock size={18} strokeWidth={2.5} />
                <span className="text-[13px] font-black uppercase tracking-widest">현재 상태</span>
              </div>
              <div className="flex-1 px-3 py-2 rounded-xl hover:bg-white dark:hover:bg-bg-hover hover:shadow-sm hover:ring-1 hover:ring-gray-100 dark:hover:ring-border-subtle transition-all relative">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${item.status === 'done' ? 'bg-emerald-500' : item.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                  <select
                    disabled={isReadOnly}
                    className="bg-white dark:bg-bg-elevated border-none p-0 text-sm font-black text-gray-800 dark:text-text-primary focus:ring-0 cursor-pointer appearance-none w-full relative z-10 dark:color-scheme-dark"
                    value={item.status || 'none'}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      onUpdateItem(phase.id, item.id, { status: newStatus });
                      onShowToast?.(`상태가 ${STATUS_MAP[newStatus].label}로 변경됨`);
                    }}
                  >
                    <option value="none">⚪ 미지정</option>
                    <option value="in-progress">🔵 진행 중</option>
                    <option value="done">🟢 완료</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Assignees */}
            <div className="flex items-center min-h-[48px] group">
              <div className="w-48 flex items-center gap-3 text-gray-400 dark:text-text-tertiary shrink-0">
                <Users size={18} strokeWidth={2.5} />
                <span className="text-[13px] font-black uppercase tracking-widest">담당 인원</span>
              </div>
              <div 
                className={`flex-1 px-3 py-2 rounded-xl transition-all min-h-[40px] flex items-center ${!isReadOnly ? 'hover:bg-white dark:hover:bg-bg-hover hover:shadow-sm hover:ring-1 hover:ring-gray-100 dark:hover:ring-border-subtle cursor-pointer' : ''} ${isEditingAssignees ? 'bg-white dark:bg-bg-hover ring-2 ring-blue-500/20 border-blue-500/30 shadow-md' : ''}`}
                onClick={() => !isReadOnly && setIsEditingAssignees(true)}
              >
                {!isEditingAssignees ? (
                  <div className="flex flex-wrap gap-2 w-full">
                    {(item.assignees || []).length > 0 ? (
                       item.assignees.map(a => <span key={a} className="bg-gray-100 dark:bg-bg-base text-gray-800 dark:text-text-primary px-3 py-1 rounded-lg text-[13px] font-black border border-gray-200 dark:border-border-subtle shadow-sm">@{a}</span>)
                     ) : <span className="text-[13px] font-bold text-gray-300 dark:text-text-tertiary italic">비어 있음</span>}
                   </div>
                 ) : (
                   <input
                     autoFocus
                     className="w-full bg-transparent border-none p-0 text-sm font-black text-gray-900 dark:text-text-primary placeholder:text-gray-400 dark:placeholder:text-text-tertiary focus:ring-0 outline-none"
                    placeholder="이름 입력 (쉼표로 구분)..."
                    value={assigneeInput}
                    onChange={e => setAssigneeInput(e.target.value)}
                    onBlur={handleSaveAssignees}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveAssignees();
                      if (e.key === 'Escape') setIsEditingAssignees(false);
                    }}
                  />
                )}
              </div>
            </div>

            {/* Teams */}
            <div className="flex items-start min-h-[48px] group">
              <div className="w-48 flex items-center gap-3 text-gray-400 dark:text-text-tertiary shrink-0 pt-2.5">
                <Building2 size={18} strokeWidth={2.5} />
                <span className="text-[13px] font-black uppercase tracking-widest">관련 팀</span>
              </div>
              <div className="flex-1 px-3 py-2 rounded-xl hover:bg-white dark:hover:bg-bg-hover transition-all flex flex-wrap gap-2 min-h-[40px] items-center">
                {TEAMS.map(team => (
                  <button
                    key={team.name}
                    disabled={isReadOnly}
                    onClick={() => handleToggleTeam(team.name)}
                    className={`px-3.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all border ${item.teams?.includes(team.name) ? 'bg-gray-900 border-gray-900 text-white dark:bg-white dark:border-white dark:text-gray-900 shadow-md scale-105' : 'bg-white dark:bg-bg-base border-gray-200 dark:border-border-subtle text-gray-400 dark:text-text-tertiary hover:border-gray-400 dark:hover:border-border-strong cursor-pointer'} disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="flex items-start min-h-[48px] group">
              <div className="w-48 flex items-center gap-3 text-gray-400 dark:text-text-tertiary shrink-0 pt-2.5">
                <Tag size={18} strokeWidth={2.5} />
                <span className="text-[13px] font-black uppercase tracking-widest">태그</span>
              </div>
              <div 
                className={`flex-1 px-3 py-2 rounded-xl transition-all min-h-[40px] flex flex-wrap gap-2 items-center ${!isReadOnly ? 'hover:bg-white dark:hover:bg-bg-hover hover:shadow-sm hover:ring-1 hover:ring-gray-100 dark:hover:ring-border-subtle cursor-pointer' : ''} ${isEditingTags ? 'bg-white dark:bg-bg-hover ring-2 ring-blue-500/20 border-blue-500/30 shadow-md' : ''}`}
                onClick={() => !isReadOnly && setIsEditingTags(true)}
              >
                {(item.tags || []).map(tag => (
                  <span key={tag} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-text-secondary border border-slate-200 dark:border-border-subtle px-3 py-1 rounded-lg font-mono text-[11px] font-black uppercase shadow-sm group/tag">
                    #{tag}
                    {!isReadOnly && <button onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }} className="hover:text-red-600 cursor-pointer opacity-0 group-hover/tag:opacity-100 transition-opacity"><X size={10} strokeWidth={4} /></button>}
                  </span>
                ))}
                {!isReadOnly && (
                  isEditingTags ? (
                    <input 
                      autoFocus
                      placeholder="태그 입력..."
                      className="bg-transparent border-none p-0 font-mono text-[13px] font-black text-gray-900 dark:text-text-primary focus:ring-0 w-32 uppercase"
                      value={newTagInput}
                      onChange={e => setNewTagInput(e.target.value)}
                      onBlur={handleAddTag}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddTag();
                        if (e.key === 'Escape') setIsEditingTags(false);
                      }}
                    />
                  ) : (
                    <span className="text-[11px] font-black text-blue-500 uppercase tracking-widest">+ 태그 추가</span>
                  )
                )}
                 {(!item.tags || item.tags.length === 0) && !isEditingTags && !isReadOnly && <span className="text-[13px] font-bold text-gray-300 dark:text-text-tertiary italic ml-1">비어 있음</span>}
               </div>
             </div>

            {/* Relations */}
            <div className="flex items-start min-h-[48px] group">
              <div className="w-48 flex items-center gap-3 text-gray-400 dark:text-text-tertiary shrink-0 pt-2.5">
                <Link2 size={18} strokeWidth={2.5} />
                <span className="text-[13px] font-black uppercase tracking-widest">연관 업무</span>
              </div>
              <div 
                className={`flex-1 px-3 py-2 rounded-xl transition-all min-h-[40px] flex flex-col gap-2 justify-center ${!isReadOnly ? 'hover:bg-white dark:hover:bg-bg-hover hover:shadow-sm hover:ring-1 hover:ring-gray-100 dark:hover:ring-border-subtle' : ''} ${isEditingRelations ? 'bg-white dark:bg-bg-hover ring-2 ring-blue-500/20 border-blue-500/30 shadow-md' : ''}`}
                onClick={() => { if (!isReadOnly && !isEditingRelations) setIsEditingRelations(true); }}
              >
                <div className="flex flex-wrap gap-2 items-center">
                  {(item.related_items || []).map(relatedId => {
                    const relatedItem = allItems.find(i => i.id === relatedId);
                    if (!relatedItem) return null;
                    return (
                      <span 
                        key={relatedId} 
                        onClick={(e) => { e.stopPropagation(); onOpenDetail?.(relatedId); }}
                        className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/40 px-3 py-1.5 rounded-xl text-[13px] font-black shadow-sm group/rel cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all hover:scale-105 active:scale-95"
                      >
                        <ArrowUpRight size={12} strokeWidth={3} />
                        {relatedItem.title || relatedItem.content}
                        {!isReadOnly && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRemoveRelation(relatedId); }} 
                            className="hover:text-red-600 cursor-pointer opacity-0 group-hover/rel:opacity-100 transition-opacity ml-1"
                          >
                            <X size={12} strokeWidth={4} />
                          </button>
                        )}
                      </span>
                    );
                  })}
                  {!isReadOnly && !isEditingRelations && (
                    <span className="text-[11px] font-black text-blue-500 uppercase tracking-widest cursor-pointer">+ 업무 연결</span>
                  )}
                   {(!item.related_items || item.related_items.length === 0) && !isEditingRelations && !isReadOnly && (
                     <span className="text-[13px] font-bold text-gray-300 dark:text-text-tertiary italic ml-1">비어 있음</span>
                   )}
                </div>

                {/* Relation Search Dropdown */}
                {isEditingRelations && !isReadOnly && (
                  <div className="relative w-full mt-2 animate-in fade-in slide-in-from-top-2 duration-200" onClick={stopProp}>
                    <div className="relative flex items-center">
                      <Search size={14} className="absolute left-3 text-gray-400" />
                      <input 
                        autoFocus
                        placeholder="연결할 업무를 검색하세요..."
                        className="w-full bg-white dark:bg-bg-base border border-gray-200 dark:border-border-subtle pl-10 pr-4 py-2.5 rounded-xl text-sm font-bold text-gray-900 dark:text-text-primary focus:ring-4 focus:ring-blue-500/10 outline-none shadow-sm transition-all"
                        value={relationSearchQuery}
                        onChange={e => setRelationSearchQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') setIsEditingRelations(false); }}
                      />
                    </div>
                    <div className="absolute top-full left-0 w-full max-h-60 overflow-y-auto bg-white dark:bg-bg-elevated border border-gray-200 dark:border-border-subtle rounded-2xl shadow-2xl z-[100] mt-2 p-2 custom-scrollbar animate-in zoom-in-95 duration-200">
                      {allItems
                        .filter(i => i.id !== item.id && !(item.related_items || []).includes(i.id))
                        .filter(i => !relationSearchQuery || (i.title || i.content).toLowerCase().includes(relationSearchQuery.toLowerCase()))
                        .map(searchItem => (
                          <div 
                            key={searchItem.id}
                            onClick={() => handleAddRelation(searchItem.id)}
                            className="p-3 rounded-xl text-sm font-bold text-gray-700 dark:text-text-secondary hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-300 cursor-pointer transition-colors flex items-center justify-between group/searchitem"
                          >
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-0.5 bg-gray-100 dark:bg-bg-hover text-[11px] font-black text-gray-400 uppercase rounded-md group-hover/searchitem:bg-blue-100 dark:group-hover/searchitem:bg-blue-900/30 group-hover/searchitem:text-blue-500 transition-colors">
                                {searchItem.teams?.[0] || '전체'}
                              </span>
                              {searchItem.title || searchItem.content}
                            </div>
                            <Plus size={14} className="opacity-0 group-hover/searchitem:opacity-100 transition-opacity" />
                          </div>
                        ))}
                      {allItems.filter(i => i.id !== item.id && !(item.related_items || []).includes(i.id)).filter(i => !relationSearchQuery || (i.title || i.content).toLowerCase().includes(relationSearchQuery.toLowerCase())).length === 0 && (
                        <div className="p-8 text-center text-[13px] font-bold text-gray-400 dark:text-text-tertiary italic">검색 결과가 없습니다.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-border-subtle pb-4">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-gray-400" />
                <h3 className="text-[13px] font-black text-gray-400 dark:text-text-tertiary uppercase tracking-[0.2em]">상세 설명 (Wiki)</h3>
                {isEditingDescription && <span className="text-[11px] text-emerald-500 font-black animate-pulse flex items-center gap-1.5 ml-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> EDITING MODE
                </span>}
              </div>
            </div>
            
            {!isEditingDescription || isReadOnly ? (
              <div
                onClick={() => !isReadOnly && setIsEditingDescription(true)}
                className={`min-h-[400px] p-8 -m-8 rounded-3xl transition-all duration-300 ease-notion ${!isReadOnly ? 'hover:bg-gray-50 dark:hover:bg-bg-elevated/40 cursor-pointer' : ''}`}
              >
                {description ? (
                  <TiptapEditor
                    key={`view-${item.id}`}
                    content={description}
                    editable={false}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-center animate-fade-in">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-bg-hover rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-inner ring-1 ring-gray-100 dark:ring-border-subtle">✍️</div>
                    <p className="text-xl font-bold text-gray-300 dark:text-text-tertiary tracking-tight">작성된 상세 내용이 없습니다.</p>
                    <p className="text-sm text-gray-400 dark:text-text-tertiary mt-2">클릭하여 업무 가이드라인이나 상세 내용을 자유롭게 작성하세요.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4 animate-in fade-in duration-300 ease-notion">
                <TiptapEditor
                  key={`edit-${item.id}`}
                  content={description}
                  onChange={setDescription}
                  editable={true}
                  itemId={item.id}
                  onShowToast={onShowToast}
                  onBlur={handleDescriptionBlur}
                />

                <div className="flex justify-end gap-3">
                  <button
                    onMouseDown={() => { isCancellingDescriptionRef.current = true; }}
                    onClick={() => {
                      isCancellingDescriptionRef.current = false;
                      setDescription(item.description || '');
                      setIsEditingDescription(false);
                    }}
                    className="px-6 py-2.5 text-[13px] font-black text-gray-400 hover:text-gray-900 dark:hover:text-text-primary uppercase tracking-widest transition-colors cursor-pointer"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div className="flex flex-col gap-10 pb-40">
            <div className="flex items-center gap-3 border-b border-gray-100 dark:border-border-subtle pb-4">
              <MessageSquare size={18} className="text-gray-400" />
              <h3 className="text-[13px] font-black text-gray-400 dark:text-text-tertiary uppercase tracking-[0.2em]">팀 코멘트</h3>
              {(item.comments || []).length > 0 && (
                <span className="bg-gray-100 dark:bg-bg-hover px-2 py-0.5 rounded-md text-[11px] font-black text-gray-500 tabular-nums border border-gray-200 dark:border-border-subtle">
                  {(item.comments || []).length}
                </span>
              )}
            </div>
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
