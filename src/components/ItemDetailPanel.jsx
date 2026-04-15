/**
 * @fileoverview 아이템 상세 편집 패널. 앱에서 가장 복잡한 컴포넌트.
 *
 * 담당:
 * - 제목/부제목/담당자/팀/태그/상태/우선순위/날짜 인라인 편집
 * - 옵시디언형 Markdown live/source/view 편집 (description Markdown 원본)
 * - AI 요약 생성 + [N] 인용 → 에디터 블록 스크롤
 * - 관계 아이템 검색/추가/제거
 * - 자식 페이지 목록 + 생성 (속성 상속 대응)
 * - 기존 페이지 연결 (Slash Command 연동)
 * - 프로젝트 가상 페이지 대응 (page_type='project')
 * - 댓글 목록 (CommentSection)
 * - 브레드크럼 네비게이션 (parent_item_id 체인 추적)
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronsRight, Maximize2, ChevronRight, Trash2,
  Clock, Users, Building2, Tag, Link2, Plus, X,
  MessageSquare, Search, ArrowUpRight, AlignCenter, AlignJustify,
  Calendar, Flag, LayoutList, List, Github, ExternalLink
} from 'lucide-react';
import CommentSection from './CommentSection';
import ItemDescriptionSection from './ItemDescriptionSection';
import DocumentOutline from './DocumentOutline';
import BacklinksPanel from './BacklinksPanel';
import { TEAMS, STATUS_MAP, PRIORITY_MAP } from '../lib/constants';
import { usePresenceContext } from '../hooks/usePresenceContext';
import ItemViewers from './ItemViewers';
import { ENTITY_TYPES, getEntityLabel } from '../lib/entityModel';
import {
  createGitHubIssue,
  getGitHubRepos,
  getGitHubStatus,
  getItemGitHubIssues,
} from '../api/githubAPI';

function ItemDetailPanel({
  item, project = null, phase = project, entityContext = null, allItems = [], onClose, onUpdateItem, onUpdateProject, onUpdatePhase = onUpdateProject, isReadOnly,
  isFullscreen = false, onToggleFullscreen,
  onBreadcrumbNavigate,
  onAddComment, onUpdateComment, onDeleteComment, onOpenDetail,
  onShowConfirm, onShowToast,
  onAddChildPage,
  onShowPrompt,
  onManageGitHubSettings,
  onDeleteItem,
  onDeleteProject, onDeletePhase = onDeleteProject,
}) {
  const stopProp = (e) => e.stopPropagation();
  const { updateEditing } = usePresenceContext();
  const [isEditingAssignees, setIsEditingAssignees] = useState(false);
  const [assigneeInput, setAssigneeInput] = useState((item?.assignees || []).join(', '));
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isEditingRelations, setIsEditingRelations] = useState(false);
  const [relationSearchQuery, setRelationSearchQuery] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [titleInput, setTitleInput] = useState(item?.title || item?.content || '');
  const [isWideView, setIsWideView] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [currentEditorOffset, setCurrentEditorOffset] = useState(0);
  const [githubStatus, setGitHubStatus] = useState({ connected: false });
  const [githubRepos, setGitHubRepos] = useState([]);
  const [githubIssues, setGitHubIssues] = useState([]);
  const [selectedGitHubRepo, setSelectedGitHubRepo] = useState('');
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);
  const [isGitHubSubmitting, setIsGitHubSubmitting] = useState(false);
  const [gitHubError, setGitHubError] = useState('');
  const [issuedTicket, setIssuedTicket] = useState({
    key: item?.ticket_key || '',
    number: item?.ticket_number ?? null,
  });
  const editorViewRef = useRef(null);
  const boardType = (phase?.board_type || 'main').toLowerCase();
  const boardLabel = boardType === 'main' ? '전체 보드' : `${phase?.board_type || '팀'} 보드`;
  const contextLabel = getEntityLabel(entityContext || {});
  const isProjectLike = entityContext?.type === ENTITY_TYPES.PROJECT || item.page_type === 'project';
  const isMemo = entityContext?.type === ENTITY_TYPES.MEMO;
  const sectionLabel = entityContext?.collection === 'general'
    ? `📚 ${contextLabel}`
    : entityContext?.type === ENTITY_TYPES.MEMO
      ? '📝 개인 메모장'
      : `🧭 ${phase?.title}`;
  const statusInfo = STATUS_MAP[item.status || 'none'];
  const assigneeCount = (item.assignees || []).length;
  const teamCount = (item.teams || []).length;

  useEffect(() => {
    setAssigneeInput((item?.assignees || []).join(', '));
    setTitleInput(item?.title || item?.content || '');
    setIsEditingRelations(false);
    setRelationSearchQuery('');
    setIsEditingTitle(false);
    setIsEditingDescription(false);
    setGitHubError('');
    setIssuedTicket({
      key: item?.ticket_key || '',
      number: item?.ticket_number ?? null,
    });
  }, [item]);

  useEffect(() => {
    let active = true;

    const loadGitHubState = async () => {
      if (!item?.id || isReadOnly || isMemo) {
        if (active) {
          setGitHubStatus({ connected: false });
          setGitHubRepos([]);
          setGitHubIssues([]);
          setSelectedGitHubRepo('');
        }
        return;
      }

      setIsGitHubLoading(true);
      setGitHubError('');
      try {
        const [status, issues] = await Promise.all([
          getGitHubStatus(),
          getItemGitHubIssues(item.id),
        ]);

        if (!active) return;

        setGitHubStatus(status || { connected: false });
        setGitHubIssues(issues || []);

        if (status?.connected) {
          const repos = await getGitHubRepos();
          if (!active) return;
          setGitHubRepos(repos);
          setSelectedGitHubRepo((current) => current || repos[0]?.full_name || '');
        } else {
          setGitHubRepos([]);
          setSelectedGitHubRepo('');
        }
      } catch (error) {
        if (!active) return;
        setGitHubError(error.message || 'GitHub 정보를 불러오지 못했습니다.');
      } finally {
        if (active) setIsGitHubLoading(false);
      }
    };

    loadGitHubState();
    return () => {
      active = false;
    };
  }, [item?.id, isReadOnly, isMemo]);


  useEffect(() => {
    if (isEditingTitle) {
      updateEditing('title');
    } else if (isEditingAssignees) {
      updateEditing('assignees');
    } else if (isEditingTags) {
      updateEditing('tags');
    } else if (isEditingDescription) {
      updateEditing('description');
    } else {
      updateEditing(null);
    }
  }, [isEditingTitle, isEditingAssignees, isEditingTags, isEditingDescription, updateEditing]);

  useEffect(() => () => {
    updateEditing(null);
  }, [updateEditing]);

  const handleHeadingClick = (offset) => {
    // CodeMirror editorView로 스크롤
    if (editorViewRef.current) {
      const view = editorViewRef.current;
      const pos = Math.min(offset, view.state.doc.length);
      const line = view.state.doc.lineAt(pos);
      view.dispatch({
        selection: { anchor: line.from, head: line.from },
        scrollIntoView: true,
      });
      view.focus();
    }
  };

  const handleEditorUpdate = (view) => {
    if (view) {
      editorViewRef.current = view;
      const offset = view.state.selection.main.head;
      setCurrentEditorOffset(offset);
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

  const handleCreateGitHubIssue = async () => {
    if (!selectedGitHubRepo) {
      onShowToast?.('레포를 먼저 선택해주세요.');
      return;
    }

    setIsGitHubSubmitting(true);
    setGitHubError('');
    try {
      const result = await createGitHubIssue(item.id, selectedGitHubRepo);
      if (result?.ticket?.ticket_key) {
        setIssuedTicket({
          key: result.ticket.ticket_key,
          number: result.ticket.ticket_number ?? null,
        });
      }
      if (result?.issue) {
        setGitHubIssues((current) => [result.issue, ...current]);
      }
      if (result?.itemStatus === 'in-progress' && (item?.status || 'none') === 'none') {
        await onUpdateItem(phase.id, item.id, { status: 'in-progress' });
      }
      onShowToast?.(
        result?.ticket?.ticket_key
          ? `${result.ticket.ticket_key} 티켓으로 GitHub 이슈가 생성되었고 상태가 진행 중으로 변경되었습니다.`
          : 'GitHub 이슈가 생성되었습니다.'
      );
    } catch (error) {
      setGitHubError(error.message || 'GitHub 이슈 생성에 실패했습니다.');
      onShowToast?.(error.message || 'GitHub 이슈 생성에 실패했습니다.');
    } finally {
      setIsGitHubSubmitting(false);
    }
  };

  // 브레드크럼 경로 계산 (Phase -> Parent1 -> Parent2 -> ... -> Current Item)
  const itemPath = useMemo(() => {
    const path = [];
    let current = item;
    // 부모 아이템들을 역순으로 수집
    while (current && current.parent_item_id) {
      const parent = allItems.find(i => i.id === current.parent_item_id);
      if (parent) {
        path.unshift(parent);
        current = parent;
      } else {
        break;
      }
    }
    return path;
  }, [item, allItems]);
  const ticketKey = issuedTicket.key || item?.ticket_key || '';
  const hasExistingGitHubIssue = githubIssues.length > 0;

  if (!item) return null;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-bg-base relative animate-slide-in">
      {/* Top Header */}
      <div className="bg-white/80 dark:bg-bg-base/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 dark:border-border-subtle">
        <ItemViewers itemId={item.id} />
        <div className="px-8 py-4 flex justify-between items-start gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="flex items-center gap-1.5">
              <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-bg-hover rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-text-primary transition-all duration-200 cursor-pointer">
              <X size={20} strokeWidth={2.5} />
             </button>
             <button
               onClick={onToggleFullscreen}
               className="p-2 hover:bg-gray-100 dark:hover:bg-bg-hover rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-text-primary transition-all duration-200 cursor-pointer"
               aria-label={isFullscreen ? '사이드바로 전환' : '전체화면으로 전환'}
               title={isFullscreen ? '사이드바로 전환' : '전체화면으로 전환'}
             >
              {isFullscreen ? <ChevronsRight size={20} strokeWidth={2.5} /> : <Maximize2 size={20} strokeWidth={2.5} />}
             </button>
            <button
              onClick={() => setIsWideView(v => !v)}
              className={`p-2 rounded-xl transition-all duration-200 cursor-pointer ${isWideView ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-bg-hover hover:text-gray-900 dark:hover:text-text-primary'}`}
              title={isWideView ? '기본 너비로 보기' : '넓게 보기'}
            >
              {isWideView ? <AlignCenter size={20} strokeWidth={2.5} /> : <AlignJustify size={20} strokeWidth={2.5} />}
            </button>
            <button
              onClick={() => setShowOutline(v => !v)}
              className={`p-2 rounded-xl transition-all duration-200 cursor-pointer ${showOutline ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-bg-hover hover:text-gray-900 dark:hover:text-text-primary'}`}
              title={showOutline ? '목차 숨기기' : '목차 표시'}
            >
              <List size={20} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setShowBacklinks(v => !v)}
              className={`p-2 rounded-xl transition-all duration-200 cursor-pointer ${showBacklinks ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-bg-hover hover:text-gray-900 dark:hover:text-text-primary'}`}
              title={showBacklinks ? '백링크 숨기기' : '백링크 표시'}
            >
              <Link2 size={20} strokeWidth={2.5} />
            </button>
            {!isReadOnly && (
              <button
                onClick={() => {
                  const isProject = item.page_type === 'project';
                  const confirmMsg = isProject
                    ? '정말로 이 프로젝트를 삭제하시겠습니까?'
                    : '정말로 이 아이템을 삭제하시겠습니까?';
                  const confirmTitle = isProject ? '프로젝트 삭제' : '아이템 삭제';

                  onShowConfirm(confirmTitle, confirmMsg, async () => {
                    if (isProject) {
                      await onDeletePhase?.(phase.id);
                    } else {
                      await onDeleteItem(phase.id, item.id);
                    }
                    onClose();
                  }, 'danger');
                }}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-gray-400 hover:text-red-500 transition-all duration-200 cursor-pointer"
                title="삭제"
              >
                <Trash2 size={20} strokeWidth={2.5} />
              </button>
            )}
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
                  disabled={!isProjectLike && entityContext?.collection !== 'project'}
                  className="bg-gray-100 dark:bg-bg-hover px-2.5 py-1 rounded-lg text-gray-500 dark:text-text-secondary shrink-0 hover:text-gray-900 dark:hover:text-text-primary cursor-pointer transition-all border border-transparent hover:border-gray-200 dark:hover:border-border-strong"
                >
                  {sectionLabel}
                </button>
                
                {/* 계층형 부모 아이템 경로 표시 */}
                {itemPath.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 shrink-0">
                    <ChevronRight size={12} strokeWidth={3} className="text-gray-300 dark:text-text-tertiary" />
                    <button
                      onClick={() => onOpenDetail?.(p.id)}
                      className="bg-gray-100 dark:bg-bg-hover px-2.5 py-1 rounded-lg text-gray-500 dark:text-text-secondary shrink-0 hover:text-gray-900 dark:hover:text-text-primary cursor-pointer transition-all border border-transparent hover:border-gray-200 dark:hover:border-border-strong"
                    >
                      📄 {p.title || p.content}
                    </button>
                  </div>
                ))}

                <ChevronRight size={12} strokeWidth={3} className="text-gray-300 dark:text-text-tertiary" />
                <span className="text-gray-900 dark:text-text-primary truncate font-black">{item.title || item.content}</span>
              </nav>

              {!isMemo && (
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
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* TOC 패널 (좌측) */}
        {showOutline && item.description && (
          <div className="w-64 border-r border-gray-200 dark:border-border-subtle bg-white dark:bg-bg-base flex-shrink-0 overflow-y-auto">
            <DocumentOutline
              markdown={item.description || ''}
              onHeadingClick={handleHeadingClick}
              currentOffset={currentEditorOffset}
            />
          </div>
        )}

        {/* 백링크 패널 (좌측, TOC와 함께 표시 가능) */}
        {showBacklinks && (
          <div className="w-64 border-r border-gray-200 dark:border-border-subtle bg-white dark:bg-bg-base flex-shrink-0 overflow-y-auto">
            <BacklinksPanel
              itemId={item.id}
              allItems={allItems}
              onOpenDetail={onOpenDetail}
            />
          </div>
        )}

        {/* 메인 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-bg-base transition-colors duration-200">
        <div className={`${isWideView ? 'px-24' : 'max-w-4xl mx-auto px-12'} py-16 flex flex-col gap-16 transition-all duration-300`}>
          
          {/* Title */}
          <div className="flex flex-col gap-4">
            <span className="text-[11px] font-black text-blue-500 uppercase tracking-[0.3em] ml-1">
              {isMemo ? '노트' : 'Work Item Title'}
            </span>
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

          {/* Notion Properties Style - 메모일 때는 숨김 */}
          {!isMemo && (
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
                  value={(item.page_type === 'project' ? phase?.start_date : item.start_date) || ''}
                  onChange={e => {
                    const newValue = e.target.value || null;
                    if (item.page_type === 'project') {
                      onUpdatePhase?.(phase.id, { start_date: newValue });
                    } else {
                      onUpdateItem(phase.id, item.id, { start_date: newValue });
                    }
                  }}
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
                  value={(item.page_type === 'project' ? phase?.end_date : item.end_date) || ''}
                  onChange={e => {
                    const newValue = e.target.value || null;
                    if (item.page_type === 'project') {
                      onUpdatePhase?.(phase.id, { end_date: newValue });
                    } else {
                      onUpdateItem(phase.id, item.id, { end_date: newValue });
                    }
                  }}
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
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white dark:hover:bg-bg-hover hover:shadow-sm hover:ring-1 hover:ring-gray-100 dark:hover:ring-border-subtle transition-all">
                {PRIORITY_MAP[item.priority ?? 0]?.borderColor && (
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PRIORITY_MAP[item.priority ?? 0].borderColor }}
                  />
                )}
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

            <div className="flex items-start min-h-[48px] group">
              <div className="w-48 flex items-center gap-3 text-gray-400 dark:text-text-tertiary shrink-0 pt-2.5">
                <Github size={18} strokeWidth={2.5} />
                <span className="text-[13px] font-black uppercase tracking-widest">GitHub</span>
              </div>
              <div className="flex-1 px-3 py-3 rounded-xl bg-white dark:bg-bg-hover border border-gray-100 dark:border-border-subtle flex flex-col gap-3">
                {isGitHubLoading ? (
                  <span className="text-[13px] font-bold text-gray-400 dark:text-text-tertiary">GitHub 정보를 불러오는 중...</span>
                ) : (
                  <>
                    {githubStatus?.connected ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-bold text-gray-700 dark:text-text-secondary">
                              Connected as @{githubStatus.githubLogin}
                            </span>
                            {ticketKey && (
                              <span className="px-2.5 py-1 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[11px] font-black uppercase tracking-widest">
                                {ticketKey}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={onManageGitHubSettings}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest border border-gray-200 dark:border-border-subtle text-gray-600 dark:text-text-secondary hover:border-gray-400 dark:hover:border-border-strong cursor-pointer"
                          >
                            프로필에서 관리
                          </button>
                        </div>

                        <span className="text-[12px] font-bold text-gray-500 dark:text-text-tertiary">
                          이슈 생성 시 티켓이 없으면 자동으로 발급한 뒤 [{ticketKey || 'QZR-*'}] 형식으로 GitHub 이슈를 생성합니다.
                        </span>
                        {hasExistingGitHubIssue && (
                          <span className="text-[12px] font-bold text-amber-600 dark:text-amber-400">
                            이 아이템에는 이미 GitHub 이슈가 연결되어 있어서 추가 생성할 수 없습니다.
                          </span>
                        )}

                        <div className="flex gap-2 flex-wrap">
                          <select
                            value={selectedGitHubRepo}
                            onChange={(e) => setSelectedGitHubRepo(e.target.value)}
                            className="min-w-[240px] flex-1 bg-gray-50 dark:bg-bg-base border border-gray-200 dark:border-border-subtle rounded-xl px-3 py-2 text-sm font-bold text-gray-800 dark:text-text-primary dark:color-scheme-dark"
                          >
                            {githubRepos.length === 0 ? (
                              <option value="">접근 가능한 레포가 없습니다</option>
                            ) : (
                              githubRepos.map((repo) => (
                                <option key={repo.id} value={repo.full_name}>
                                  {repo.full_name}
                                </option>
                              ))
                            )}
                          </select>
                          <button
                            onClick={handleCreateGitHubIssue}
                            disabled={!selectedGitHubRepo || isGitHubSubmitting || hasExistingGitHubIssue}
                            className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[12px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {isGitHubSubmitting ? '티켓 발급 후 생성 중...' : '이슈 생성'}
                          </button>
                        </div>

                        {githubIssues.length > 0 && (
                          <div className="flex flex-col gap-2">
                            {githubIssues.map((issue) => (
                              <a
                                key={issue.id || `${issue.repo_full_name}-${issue.issue_number}`}
                                href={issue.issue_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 dark:border-border-subtle px-3 py-2 text-sm text-gray-700 dark:text-text-secondary hover:border-blue-300 dark:hover:border-blue-700"
                              >
                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                  <span className="font-bold">
                                    {issue.repo_full_name}#{issue.issue_number}
                                  </span>
                                  {(issue.ticket_key || ticketKey) && (
                                    <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-bg-base text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-text-secondary">
                                      {issue.ticket_key || ticketKey}
                                    </span>
                                  )}
                                </div>
                                <span className="flex items-center gap-1 text-gray-400 dark:text-text-tertiary">
                                  <ExternalLink size={14} />
                                </span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-[13px] font-bold text-gray-400 dark:text-text-tertiary">
                          GitHub 계정을 연결해야 이슈를 생성할 수 있습니다.
                        </span>
                          <button
                            onClick={onManageGitHubSettings}
                            className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[12px] font-black uppercase tracking-widest cursor-pointer"
                          >
                            프로필에서 연결
                          </button>
                      </div>
                    )}

                    {gitHubError && (
                      <div className="text-[12px] font-bold text-red-500 dark:text-red-400">
                        {gitHubError}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          )}

          {/* Description Section */}
          <ItemDescriptionSection
            item={item}
                projectId={phase.id}
            allItems={allItems}
            isReadOnly={isReadOnly}
            entityContext={entityContext}
            onEditingChange={setIsEditingDescription}
            onOpenDetail={onOpenDetail}
            onShowToast={onShowToast}
            onUpdateItem={onUpdateItem}
            onAddChildPage={onAddChildPage}
            onShowPrompt={onShowPrompt}
            editorViewRef={editorViewRef}
            onEditorUpdate={handleEditorUpdate}
          />

          {/* Project Items List (Only for project page_type) */}
          {item.page_type === 'project' && phase?.items && phase.items.length > 0 && (
            <div className="flex flex-col gap-6 pt-8 border-t border-gray-100 dark:border-border-subtle">
               <div className="flex items-center gap-3 border-b border-gray-100 dark:border-border-subtle pb-4">
                 <LayoutList size={18} className="text-gray-400" />
                 <h3 className="text-[13px] font-black text-gray-400 dark:text-text-tertiary uppercase tracking-[0.2em]">소속 업무 목록</h3>
                 <span className="bg-gray-100 dark:bg-bg-hover px-2 py-0.5 rounded-md text-[11px] font-black text-gray-500 tabular-nums border border-gray-200 dark:border-border-subtle">
                   {phase.items.length}
                 </span>
               </div>
               <div className="flex flex-col gap-2">
                 {phase.items.map(childItem => {
                   const cPriority = PRIORITY_MAP[childItem.priority || 0];
                   return (
                     <div
                       key={childItem.id}
                       onClick={() => onOpenDetail?.(childItem.id)}
                       className="group flex items-center justify-between p-3 rounded-2xl border border-gray-100 dark:border-border-subtle hover:border-blue-200 dark:hover:border-blue-800/50 hover:shadow-md bg-white dark:bg-bg-elevated cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                     >
                       <div className="flex items-center gap-3 min-w-0">
                         <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${childItem.status === 'done' ? 'bg-emerald-500' : childItem.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                         <span className="text-sm font-bold text-gray-800 dark:text-text-primary truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                           {childItem.title || childItem.content}
                         </span>
                       </div>
                       <div className="flex items-center gap-3 shrink-0">
                         {cPriority.icon && (
                           <span className="text-xs" title={`우선순위: ${cPriority.label}`}>{cPriority.icon}</span>
                         )}
                         {(childItem.assignees || []).length > 0 ? (
                           <div className="flex -space-x-2 mr-2">
                             {childItem.assignees.slice(0, 3).map((a, i) => (
                               <div key={i} className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-bg-elevated flex items-center justify-center text-[9px] font-bold text-gray-600 dark:text-text-secondary z-10" title={a}>
                                 {a.charAt(0).toUpperCase()}
                               </div>
                             ))}
                             {childItem.assignees.length > 3 && (
                               <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-white dark:border-bg-elevated flex items-center justify-center text-[9px] font-bold text-gray-500 dark:text-text-tertiary z-0">
                                 +{childItem.assignees.length - 3}
                               </div>
                             )}
                           </div>
                         ) : (
                           <span className="text-[11px] font-bold text-gray-400 dark:text-text-tertiary mr-2">미배정</span>
                         )}
                         <ChevronRight size={14} className="text-gray-300 dark:text-text-tertiary group-hover:text-blue-500 transition-colors" />
                       </div>
                     </div>
                   );
                 })}
               </div>
            </div>
          )}


          {/* Comments Section - 메모일 때는 숨김 */}
          {!isMemo && (
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
                projectId={phase.id} itemId={item.id} comments={item.comments || []}
                onAddComment={onAddComment} onUpdateComment={onUpdateComment} onDeleteComment={onDeleteComment}
                onShowConfirm={onShowConfirm} onShowToast={onShowToast}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  );
}

export default ItemDetailPanel;
