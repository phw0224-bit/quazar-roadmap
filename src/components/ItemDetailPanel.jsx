import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronsRight, Maximize2, Minimize2, ChevronRight, CheckCircle2,
  Clock, Users, Building2, Tag, Link2, FileText, Plus, X,
  MessageSquare, Search, ArrowUpRight, AlignCenter, AlignJustify,
  Sparkles, RefreshCw, Calendar, Flag
} from 'lucide-react';
import CommentSection from './CommentSection';
import TiptapEditor from './editor/Editor';
import { TEAMS, STATUS_MAP, PRIORITY_MAP } from '../lib/constants';
import { summarizeContent } from '../api/summarizeAPI';

function ItemDetailPanel({
  item, phase, allItems = [], onClose, onUpdateItem, isReadOnly,
  isFullscreen = false, onToggleFullscreen,
  onBreadcrumbNavigate,
  onAddComment, onUpdateComment, onDeleteComment, onOpenDetail,
  onShowConfirm, onShowToast,
  onAddChildPage,
  onShowPrompt,
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
  const [isWideView, setIsWideView] = useState(false);

  // AI 요약 관련 state
  const [aiSummary, setAiSummary] = useState(item?.ai_summary || null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // 하위 페이지: 현재 아이템의 직계 자식 page 타입 아이템
  const childPages = useMemo(() =>
    allItems.filter(i => i.parent_item_id === item?.id && i.page_type === 'page'),
    [allItems, item?.id]
  );

  // 본문 DOM 참조 (citation 클릭 시 해당 블록으로 스크롤)
  const descriptionRef = useRef(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setDescription(item?.description || '');
    setAssigneeInput((item?.assignees || []).join(', '));
    setTitleInput(item?.title || item?.content || '');
    setIsEditingRelations(false);
    setRelationSearchQuery('');
    setIsEditingTitle(false);
    // 아이템이 바뀌면 저장된 요약 불러오기
    setAiSummary(item?.ai_summary || null);
    setSummaryError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [item]);

  // description 블록에 id 부여 (citation 스크롤용)
  useEffect(() => {
    if (!descriptionRef.current) return;
    const blocks = descriptionRef.current.querySelectorAll('h1, h2, h3, h4, p, li');
    blocks.forEach((block, i) => {
      block.id = `ai-block-${i + 1}`;
    });
  }, [description]);

  const handleDescriptionBlur = async () => {
    if (description !== (item.description || '')) {
      await onUpdateItem(phase.id, item.id, { description });
    }
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

  // ─── AI 요약 ──────────────────────────────────────────────────────────────

  // 요약 결과의 [N] 텍스트를 클릭 가능한 인용 배지로 변환
  const renderWithCitations = (text) => {
    const parts = text.split(/(\[\d+\])/g);
    return parts.map((part, i) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const n = parseInt(match[1]);
        return (
          <button
            key={i}
            onClick={() => {
              const el = document.getElementById(`ai-block-${n}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            title={`본문 [${n}] 섹션으로 이동`}
            className="inline-flex items-center justify-center w-5 h-5 mx-0.5 text-[10px] font-black bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-full border border-violet-200 dark:border-violet-700 hover:bg-violet-200 dark:hover:bg-violet-800/50 cursor-pointer transition-colors align-middle"
          >
            {n}
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleSummarize = async () => {
    if (!description || isSummarizing) return;
    setIsSummarizing(true);
    setSummaryError(null);
    try {
      const result = await summarizeContent(description);
      setAiSummary(result);
      // 요약 결과를 item에 저장 (페이지 새로고침 후에도 유지)
      await onUpdateItem(phase.id, item.id, { ai_summary: result });
      onShowToast?.('AI 요약이 완료되었습니다.');
    } catch (err) {
      setSummaryError(err.message);
    } finally {
      setIsSummarizing(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────

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

            {/* 시작일 */}
            <div className="flex items-center min-h-[48px] group">
              <div className="w-48 flex items-center gap-3 text-gray-400 dark:text-text-tertiary shrink-0">
                <Calendar size={18} strokeWidth={2.5} />
                <span className="text-[13px] font-black uppercase tracking-widest">시작일</span>
              </div>
              <div className="flex-1 px-3 py-2 rounded-xl hover:bg-white dark:hover:bg-bg-hover hover:shadow-sm hover:ring-1 hover:ring-gray-100 dark:hover:ring-border-subtle transition-all">
                <input
                  type="date"
                  disabled={isReadOnly}
                  value={item.start_date || ''}
                  onChange={e => onUpdateItem(phase.id, item.id, { start_date: e.target.value || null })}
                  className="bg-transparent border-none p-0 text-sm font-black text-gray-800 dark:text-text-primary focus:ring-0 cursor-pointer w-full dark:color-scheme-dark disabled:cursor-default"
                />
              </div>
            </div>

            {/* 마감일 */}
            <div className="flex items-center min-h-[48px] group">
              <div className="w-48 flex items-center gap-3 text-gray-400 dark:text-text-tertiary shrink-0">
                <Calendar size={18} strokeWidth={2.5} />
                <span className="text-[13px] font-black uppercase tracking-widest">마감일</span>
              </div>
              <div className="flex-1 px-3 py-2 rounded-xl hover:bg-white dark:hover:bg-bg-hover hover:shadow-sm hover:ring-1 hover:ring-gray-100 dark:hover:ring-border-subtle transition-all">
                <input
                  type="date"
                  disabled={isReadOnly}
                  value={item.end_date || ''}
                  onChange={e => onUpdateItem(phase.id, item.id, { end_date: e.target.value || null })}
                  className="bg-transparent border-none p-0 text-sm font-black text-gray-800 dark:text-text-primary focus:ring-0 cursor-pointer w-full dark:color-scheme-dark disabled:cursor-default"
                />
              </div>
            </div>

            {/* 우선순위 */}
            <div className="flex items-center min-h-[48px] group">
              <div className="w-48 flex items-center gap-3 text-gray-400 dark:text-text-tertiary shrink-0">
                <Flag size={18} strokeWidth={2.5} />
                <span className="text-[13px] font-black uppercase tracking-widest">우선순위</span>
              </div>
              <div className="flex-1 px-3 py-2 rounded-xl hover:bg-white dark:hover:bg-bg-hover hover:shadow-sm hover:ring-1 hover:ring-gray-100 dark:hover:ring-border-subtle transition-all">
                <select
                  disabled={isReadOnly}
                  value={item.priority ?? 0}
                  onChange={e => onUpdateItem(phase.id, item.id, { priority: Number(e.target.value) })}
                  className="bg-transparent border-none p-0 text-sm font-black text-gray-800 dark:text-text-primary focus:ring-0 cursor-pointer appearance-none w-full dark:color-scheme-dark disabled:cursor-default"
                >
                  {Object.entries(PRIORITY_MAP).map(([val, { label, icon }]) => (
                    <option key={val} value={val}>{icon ? `${icon} ${label}` : label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-border-subtle pb-4">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-gray-400" />
                <h3 className="text-[13px] font-black text-gray-400 dark:text-text-tertiary uppercase tracking-[0.2em]">상세 설명 (Wiki)</h3>
              </div>

              {/* AI 요약 버튼 */}
              {description && !isReadOnly && (
                <button
                  onClick={handleSummarize}
                  disabled={isSummarizing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 rounded-xl transition-all cursor-pointer disabled:opacity-50 uppercase tracking-widest border border-violet-100 dark:border-violet-800/40"
                >
                  {isSummarizing ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Sparkles size={13} />
                  )}
                  {isSummarizing ? '요약 중...' : 'AI 요약'}
                </button>
              )}
            </div>

            {/* AI 요약 에러 메시지 */}
            {summaryError && (
              <div className="flex items-start gap-3 px-5 py-4 bg-red-50 dark:bg-red-900/20 rounded-2xl text-sm text-red-500 dark:text-red-400 font-bold border border-red-100 dark:border-red-900/30">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <div>
                  <p className="font-black text-[13px] mb-0.5">요약 실패</p>
                  <p className="font-medium text-[12px] opacity-80">{summaryError}</p>
                </div>
              </div>
            )}

            {/* AI 요약 카드 — 본문 위에 표시 */}
            {aiSummary && (
              <div className="rounded-3xl border border-violet-100 dark:border-violet-900/40 bg-gradient-to-br from-violet-50/60 to-white dark:from-violet-950/20 dark:to-bg-base overflow-hidden">
                {/* 카드 헤더 */}
                <div className="flex items-center justify-between px-7 py-5 border-b border-violet-100 dark:border-violet-900/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-100 dark:bg-violet-900/40 rounded-xl">
                      <Sparkles size={15} className="text-violet-500 dark:text-violet-400" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-black text-violet-700 dark:text-violet-300 uppercase tracking-[0.2em]">AI 요약</h3>
                      <p className="text-[11px] text-violet-400 dark:text-violet-500 mt-0.5">
                        {new Date(aiSummary.generatedAt).toLocaleString('ko-KR')} 생성
                      </p>
                    </div>
                  </div>
                  {!isReadOnly && (
                    <button
                      onClick={handleSummarize}
                      disabled={isSummarizing}
                      className="flex items-center gap-1.5 text-[11px] font-black text-violet-400 dark:text-violet-500 hover:text-violet-600 dark:hover:text-violet-300 uppercase tracking-widest cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw size={11} className={isSummarizing ? 'animate-spin' : ''} />
                      {isSummarizing ? '요약 중...' : '다시 요약'}
                    </button>
                  )}
                </div>
                {/* 요약 포인트 목록 */}
                <div className="px-7 py-6 flex flex-col gap-4">
                  {aiSummary.summary.map((point, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-500 dark:text-violet-400 text-[10px] font-black flex items-center justify-center border border-violet-200 dark:border-violet-800/40">
                        {i + 1}
                      </span>
                      <p className="text-sm font-medium text-gray-700 dark:text-text-secondary leading-relaxed">
                        {renderWithCitations(point)}
                      </p>
                    </div>
                  ))}
                  <p className="text-[11px] text-violet-300 dark:text-violet-600 mt-2 font-bold">
                    숫자 배지를 클릭하면 해당 본문 섹션으로 이동합니다.
                  </p>
                </div>
              </div>
            )}

            <div ref={descriptionRef}>
              <TiptapEditor
                key={`editor-${item.id}`}
                content={description}
                onChange={setDescription}
                editable={!isReadOnly}
                itemId={item.id}
                onShowToast={onShowToast}
                onBlur={handleDescriptionBlur}
              />
            </div>
          </div>

          {/* 하위 페이지 섹션 */}
          <div className="border-t border-[var(--color-border-subtle)] pt-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
                하위 페이지
              </span>
              {!isReadOnly && onAddChildPage && (
                <button
                  onPointerDown={stopProp}
                  onClick={(e) => {
                    stopProp(e);
                    onShowPrompt?.('하위 페이지 추가', '페이지 제목을 입력하세요', async (title) => {
                      if (!title?.trim()) return;
                      await onAddChildPage(phase?.id, item?.id, title.trim());
                    });
                  }}
                  className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]
                             px-2 py-0.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  + 추가
                </button>
              )}
            </div>

            {childPages.length === 0 ? (
              <p className="text-xs text-[var(--color-text-tertiary)] italic">하위 페이지가 없습니다.</p>
            ) : (
              <div className="space-y-1">
                {childPages.map(page => (
                  <div
                    key={page.id}
                    onPointerDown={stopProp}
                    onClick={(e) => { stopProp(e); onOpenDetail?.(page.id); }}
                    className="flex items-center gap-2 p-2 rounded cursor-pointer
                               hover:bg-[var(--color-bg-hover)] transition-colors group"
                  >
                    <span className="text-sm flex-shrink-0">📄</span>
                    <span className="text-sm text-[var(--color-text-primary)] truncate flex-1">
                      {page.title || '제목 없음'}
                    </span>
                  </div>
                ))}
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
