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
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ChevronsRight, Maximize2, ChevronRight, Trash2,
  Clock, Users, Building2, Tag, Link2, Plus, X,
  MessageSquare, Search, ArrowUpRight, AlignCenter, AlignJustify,
  Calendar, Flag, LayoutList, List, Github, ExternalLink, Send, CheckCircle2,
  Share2, Copy, ClipboardList, Pencil
} from 'lucide-react';
import CommentSection from './CommentSection';
import ItemDescriptionSection from './ItemDescriptionSection';
import DocumentOutline from './DocumentOutline';
import BacklinksPanel from './BacklinksPanel';
import AssigneePicker from './AssigneePicker';
import { TEAMS, STATUS_MAP, PRIORITY_MAP } from '../lib/constants';
import { TAG_CATALOG } from '../lib/tagCatalog';
import { getTemplateScaffold } from '../lib/itemTemplates';
import { DEV_REQUEST_STATUSES } from '../lib/devRequestBoard';
import { usePresenceContext } from '../hooks/usePresenceContext';
import ItemViewers from './ItemViewers';
import { ENTITY_TYPES, getEntityLabel } from '../lib/entityModel';
import { supabase } from '../lib/supabase';
import {
  createGitHubIssue,
  createGitHubItemBranch,
  createGitHubItemPullRequest,
  getGitHubRepos,
  getGitHubItemBranch,
  getGitHubItemPullRequests,
  getGitHubStatus,
  getItemGitHubIssues,
  prepareGitHubItemPullRequest,
} from '../api/githubAPI';

function normalizeDocSearchText(value) {
  return `${value || ''}`.trim().toLowerCase();
}

function buildMentionSnippet(description = '', query = '') {
  const plain = `${description || ''}`
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/[#>*`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plain) return '';
  const normalizedQuery = normalizeDocSearchText(query);
  if (!normalizedQuery) return plain.slice(0, 140);

  const index = plain.toLowerCase().indexOf(normalizedQuery);
  if (index < 0) return plain.slice(0, 140);

  const start = Math.max(0, index - 36);
  const end = Math.min(plain.length, index + normalizedQuery.length + 72);
  return `${start > 0 ? '…' : ''}${plain.slice(start, end)}${end < plain.length ? '…' : ''}`;
}

function ItemDetailPanel({
  item, project = null, phase = project, entityContext = null, allItems = [], onClose, onUpdateItem, onUpdateProject, onUpdatePhase = onUpdateProject, isReadOnly,
  relationItems = allItems,
  reverseLinkedItems = null,
  isFullscreen = false, onToggleFullscreen,
  onBreadcrumbNavigate,
  onAddComment, onUpdateComment, onDeleteComment, onOpenDetail,
  onShowConfirm, onShowToast,
  onAddChildPage,
  onAddProjectItem,
  onShowPrompt,
  onManageGitHubSettings,
  onSubmitRequest,
  onDeleteItem,
  onDeleteProject, onDeletePhase = onDeleteProject,
}) {
  const stopProp = (e) => e.stopPropagation();
  const { updateEditing } = usePresenceContext();
  const [isEditingAssignees, setIsEditingAssignees] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isEditingRelations, setIsEditingRelations] = useState(false);
  const [relationSearchQuery, setRelationSearchQuery] = useState('');
  const [expandedBoardTypes, setExpandedBoardTypes] = useState(new Set());
  const [expandedSubGroups, setExpandedSubGroups] = useState(new Set());
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isDescriptionEditMode, setIsDescriptionEditMode] = useState(false);
  const [titleInput, setTitleInput] = useState(item?.title || item?.content || '');
  const [isWideView, setIsWideView] = useState(false);
  const [isDescriptionSplitView, setIsDescriptionSplitView] = useState(false);
  const [isDocRailOpen, setIsDocRailOpen] = useState(true);
  const [docRailTab, setDocRailTab] = useState('outline');
  const [currentEditorOffset, setCurrentEditorOffset] = useState(0);
  const [githubStatus, setGitHubStatus] = useState({ connected: false });
  const [githubRepos, setGitHubRepos] = useState([]);
  const [githubIssues, setGitHubIssues] = useState([]);
  const [gitHubPullRequests, setGitHubPullRequests] = useState([]);
  const [githubLinkedBranch, setGitHubLinkedBranch] = useState(null);
  const [githubLinkedBranchSource, setGitHubLinkedBranchSource] = useState(null);
  const [selectedGitHubRepo, setSelectedGitHubRepo] = useState('');
  const [showGitHubIssueCreator, setShowGitHubIssueCreator] = useState(false);
  const [showGitHubPullRequestCreator, setShowGitHubPullRequestCreator] = useState(false);
  const [gitHubSyncStatus, setGitHubSyncStatus] = useState('idle');
  const [gitHubReloadToken, setGitHubReloadToken] = useState(0);
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);
  const [isGitHubRepoLoading, setIsGitHubRepoLoading] = useState(false);
  const [isGitHubBranchLoading, setIsGitHubBranchLoading] = useState(false);
  const [isGitHubSubmitting, setIsGitHubSubmitting] = useState(false);
  const [isGitHubBranchSubmitting, setIsGitHubBranchSubmitting] = useState(false);
  const [isGitHubPullRequestLoading, setIsGitHubPullRequestLoading] = useState(false);
  const [isGitHubPullRequestSubmitting, setIsGitHubPullRequestSubmitting] = useState(false);
  const [gitHubError, setGitHubError] = useState('');
  const [gitHubBranchError, setGitHubBranchError] = useState('');
  const [gitHubPullRequestError, setGitHubPullRequestError] = useState('');
  const [gitHubPullRequestDraft, setGitHubPullRequestDraft] = useState(null);
  const [showShareLinkModal, setShowShareLinkModal] = useState(false);
  const [itemShareLink, setItemShareLink] = useState('');
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
  const isRequest = entityContext?.type === ENTITY_TYPES.REQUEST;
  const itemProjectId = item?.project_id ?? phase?.id ?? null;
  const phaseId = phase?.id ?? null;
  const canCreateProjectChildPage = entityContext?.collection === 'project' && Boolean(itemProjectId);
  const sectionLabel = entityContext?.collection === 'general'
    ? `📚 ${contextLabel}`
    : entityContext?.collection === 'request'
      ? `📝 ${contextLabel}`
    : entityContext?.type === ENTITY_TYPES.MEMO
      ? '📝 개인 메모장'
      : `🧭 ${phase?.title}`;
  const statusInfo = STATUS_MAP[item.status || 'none'];
  const statusDotColor = item.status === 'done'
    ? 'bg-emerald-500'
    : item.status === 'in-progress'
    ? 'bg-blue-500'
    : 'bg-gray-400';
  const requestStatusLabel = item.status || '접수됨';
  const requestStatusTone = requestStatusLabel === '완료'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
    : requestStatusLabel === '진행중'
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'
    : requestStatusLabel === '검토중'
    ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200'
    : 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200';
  const requestStatusDotColor = requestStatusLabel === '완료'
    ? 'bg-emerald-500'
    : requestStatusLabel === '진행중'
    ? 'bg-amber-500'
    : requestStatusLabel === '검토중'
    ? 'bg-violet-500'
    : 'bg-sky-500';
  const assigneeCount = isRequest ? 0 : (item.assignees || []).length;
  const teamCount = isRequest ? (item.request_team ? 1 : 0) : (item.teams || []).length;
  const useExpandedCanvas = isWideView || isDescriptionSplitView;
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const descriptionSectionRef = useRef(null);
  const headerIconButtonClass = 'p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:text-text-tertiary dark:hover:text-text-primary hover:bg-gray-100 dark:hover:bg-bg-hover transition-colors cursor-pointer';
  const headerToggleButtonClass = 'p-1.5 rounded-lg transition-colors cursor-pointer';
  const missingRequestFields = [
    [item.title || item.content, '제목'],
    [item.description, '본문'],
    [item.priority, '우선순위'],
  ].filter(([value]) => !`${value || ''}`.trim()).map(([, label]) => label);
  const mergeGitHubPullRequests = (incoming, current = []) => {
    const merged = [...incoming, ...current];
    return [...new Map(
      merged.map((pullRequest) => [pullRequest.id || `${pullRequest.repo_full_name}-${pullRequest.pull_number}`, pullRequest])
    ).values()];
  };
  const isRequestNotified = Boolean(item.notified_at);
  const isRequestSubmittedWithoutNotification = Boolean(item.submitted_at) && !item.notified_at;
  const hasDescription = Boolean(`${item?.description || ''}`.trim());
  const queryCandidates = [item?.title, item?.content]
    .map((value) => `${value || ''}`.trim())
    .filter((value, index, array) => value && array.indexOf(value) === index);
  const mentionCandidates = queryCandidates.length === 0
    ? []
    : allItems
      .filter((candidate) => candidate.id !== item?.id)
      .map((candidate) => {
        const description = `${candidate.description || ''}`;
        if (!description.trim()) return null;

        const matchedQuery = queryCandidates.find((query) => {
          const linkedWithId = description.includes(`|${item?.id}]]`);
          const linkedByTitle = description.includes(`[[${query}]]`);
          if (linkedWithId || linkedByTitle) return false;
          return description.toLowerCase().includes(query.toLowerCase());
        });

        if (!matchedQuery) return null;

        return {
          id: candidate.id,
          title: candidate.title || candidate.content || '제목 없음',
          pageType: candidate.page_type === 'page' ? '문서' : '업무',
          snippet: buildMentionSnippet(description, matchedQuery),
        };
      })
      .filter(Boolean)
      .slice(0, 12);

  useEffect(() => {
    setTitleInput(item?.title || item?.content || '');
    setIsEditingRelations(false);
    setRelationSearchQuery('');
    setIsEditingTitle(false);
    setIsEditingDescription(false);
    setIsDescriptionEditMode(false);
    setShowGitHubIssueCreator(false);
    setShowGitHubPullRequestCreator(false);
    setGitHubError('');
    setGitHubBranchError('');
    setGitHubPullRequestError('');
    setGitHubSyncStatus('idle');
    const cachedBranchName = item?.ticket_key ? item?.github_linked_branch_name : null;
    const cachedBranchUrl = item?.ticket_key ? item?.github_linked_branch_url : null;
    const cachedBranchSource = item?.ticket_key ? (item?.github_branch_source || null) : null;
    if (cachedBranchName) {
      setGitHubLinkedBranch({ branchName: cachedBranchName, branchUrl: cachedBranchUrl || null });
      setGitHubLinkedBranchSource(cachedBranchSource);
    } else {
      setGitHubLinkedBranch(null);
      setGitHubLinkedBranchSource(null);
    }
    setIsGitHubBranchSubmitting(false);
    setIsGitHubPullRequestSubmitting(false);
    setGitHubPullRequestDraft(null);
    setGitHubPullRequests([]);
    setIssuedTicket({
      key: item?.ticket_key || '',
      number: item?.ticket_number ?? null,
    });
    setDocRailTab('outline');
    setIsDescriptionSplitView(false);
  }, [item]);

  const handleRetryGitHubSync = useCallback(() => {
    setGitHubError('');
    setGitHubSyncStatus('loading');
    setGitHubReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;

    const loadGitHubState = async () => {
      if (!item?.id || isReadOnly || isMemo) {
        if (active) {
          setGitHubStatus({ connected: false });
          setGitHubRepos([]);
          setGitHubIssues([]);
          setGitHubPullRequests([]);
          setGitHubLinkedBranch(null);
          setGitHubLinkedBranchSource(null);
          setSelectedGitHubRepo('');
          setShowGitHubIssueCreator(false);
          setShowGitHubPullRequestCreator(false);
          setGitHubSyncStatus('idle');
        }
        return;
      }

      setIsGitHubLoading(true);
      setGitHubError('');
      const hasGitHubTicket = Boolean(item?.ticket_key);
      if (hasGitHubTicket) {
        setGitHubSyncStatus('loading');
      } else {
        setGitHubSyncStatus('empty');
        setGitHubIssues([]);
        setGitHubPullRequests([]);
        setGitHubLinkedBranch(null);
        setGitHubLinkedBranchSource(null);
      }
      try {
        const statusPromise = getGitHubStatus();
        if (!hasGitHubTicket) {
          const status = await statusPromise;
          if (!active) return;
          setGitHubStatus(status || { connected: false });
          return;
        }
        const [status, issues, pullRequests] = await Promise.all([
          statusPromise,
          getItemGitHubIssues(item.id),
          getGitHubItemPullRequests(item.id),
        ]);

        if (!active) return;

        setGitHubStatus(status || { connected: false });
        setGitHubIssues(issues || []);
        setGitHubPullRequests(pullRequests || []);
        setGitHubSyncStatus((issues || []).length > 0 ? 'loaded' : 'empty');

        if (!status?.connected) {
          setGitHubRepos([]);
          setGitHubPullRequests([]);
          setGitHubLinkedBranch(null);
          setGitHubLinkedBranchSource(null);
          setSelectedGitHubRepo('');
        }
      } catch (error) {
        if (!active) return;
        setGitHubError(error.message || 'GitHub 정보를 불러오지 못했습니다.');
        if (hasGitHubTicket) {
          setGitHubSyncStatus('error');
        }
      } finally {
        if (active) setIsGitHubLoading(false);
      }
    };

    loadGitHubState();
    return () => {
      active = false;
    };
  }, [item?.id, isReadOnly, isMemo, gitHubReloadToken]);

  useEffect(() => {
    let active = true;

    const loadGitHubBranch = async () => {
      if (!item?.id || isReadOnly || isMemo || !githubStatus?.connected || githubIssues.length === 0) {
        if (active) {
          setGitHubLinkedBranch(null);
          setGitHubLinkedBranchSource(null);
          setIsGitHubBranchLoading(false);
        }
        return;
      }

      setIsGitHubBranchLoading(true);
      setGitHubBranchError('');
      try {
        const branchResult = await getGitHubItemBranch(item.id);
        if (!active) return;
        setGitHubLinkedBranch(branchResult?.branch || null);
        setGitHubLinkedBranchSource(branchResult?.branchSource || null);
      } catch (error) {
        if (!active) return;
        setGitHubBranchError(error.message || 'GitHub 브랜치 정보를 불러오지 못했습니다.');
      } finally {
        if (active) setIsGitHubBranchLoading(false);
      }
    };

    loadGitHubBranch();
    return () => {
      active = false;
    };
  }, [item?.id, item?.ticket_key, githubStatus?.connected, githubIssues.length, isReadOnly, isMemo]);

  useEffect(() => {
    let active = true;

    const loadGitHubReposIfNeeded = async () => {
      if (!showGitHubIssueCreator || !githubStatus?.connected || githubIssues.length > 0) {
        return;
      }

      setIsGitHubRepoLoading(true);
      try {
        const repos = await getGitHubRepos();
        if (!active) return;
        setGitHubRepos(repos);
        setSelectedGitHubRepo((current) => current || repos[0]?.full_name || '');
      } catch (error) {
        if (!active) return;
        setGitHubError(error.message || 'GitHub 레포 목록을 불러오지 못했습니다.');
      } finally {
        if (active) setIsGitHubRepoLoading(false);
      }
    };

    loadGitHubReposIfNeeded();
    return () => {
      active = false;
    };
  }, [showGitHubIssueCreator, githubStatus?.connected, githubIssues.length]);

  useEffect(() => {
    if (!item?.id || isReadOnly || isMemo) return undefined;

    const channel = supabase.channel(`item-github-issues-${item.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'item_github_issues',
          filter: `item_id=eq.${item.id}`,
        },
        async () => {
          try {
            const [nextIssues, nextPullRequests] = await Promise.all([
              getItemGitHubIssues(item.id),
              getGitHubItemPullRequests(item.id),
            ]);
            setGitHubIssues(nextIssues || []);
            setGitHubPullRequests(nextPullRequests || []);
          } catch (error) {
            setGitHubError(error.message || '연결된 GitHub 이슈를 다시 불러오지 못했습니다.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [item?.id, isReadOnly, isMemo]);

  useEffect(() => {
    if (!item?.id || isReadOnly || isMemo) return undefined;

    const channel = supabase.channel(`item-github-pull-requests-${item.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'item_github_pull_requests',
          filter: `item_id=eq.${item.id}`,
        },
        async () => {
          try {
            const nextPullRequests = await getGitHubItemPullRequests(item.id);
            setGitHubPullRequests(nextPullRequests || []);
          } catch (error) {
            setGitHubPullRequestError(error.message || '연결된 GitHub PR을 다시 불러오지 못했습니다.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

  const buildItemShareUrl = () => {
    if (typeof window === 'undefined' || !item?.id) return '';

    const url = new URL(window.location.href);
    url.searchParams.set('item', item.id);
    url.searchParams.set('fullscreen', '1');

    if (!url.searchParams.get('boardType') && phase?.board_type && phase.board_type !== 'personal') {
      url.searchParams.set('boardType', phase.board_type);
    }

    return url.toString();
  };

  const copyTextToClipboard = async (text) => {
    if (!text) return false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // 일부 PWA/WebView에서는 clipboard API 권한이 없어 아래 fallback으로 시도한다.
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  };

  const handleCopyShareLink = async (link = itemShareLink) => {
    const copied = await copyTextToClipboard(link);
    if (copied) {
      onShowToast?.('공유 링크가 복사되었습니다.');
    }
    return copied;
  };

  const handleShareItem = async () => {
    const link = buildItemShareUrl();
    setItemShareLink(link);

    if (navigator.share) {
      try {
        await navigator.share({
          title: item.title || item.content || '아이템 공유',
          url: link,
        });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }

    const copied = await handleCopyShareLink(link);
    if (!copied) {
      setShowShareLinkModal(true);
      onShowToast?.('자동 복사가 막혀 링크를 표시했습니다.');
    }
  };

  const handleHeadingClick = (offset) => {
    if (descriptionSectionRef.current?.scrollToHeading?.(offset)) {
      setCurrentEditorOffset((current) => (current === offset ? current : offset));
      return;
    }

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
      setCurrentEditorOffset((current) => (current === offset ? current : offset));
    }
  };

  const handleDocRailTabClick = useCallback((nextTab) => {
    setDocRailTab(nextTab);
    setIsDocRailOpen(true);
  }, []);

  const handleSaveTitle = async () => {
    const nextTitle = titleInput.trim();
    const currentTitle = item.title || item.content || '';

    if (nextTitle === currentTitle) {
      setIsEditingTitle(false);
      return true;
    }

    try {
      await onUpdateItem(itemProjectId, item.id, { title: nextTitle });
      onShowToast?.('제목이 업데이트되었습니다.');
      setIsEditingTitle(false);
      return true;
    } catch (error) {
      onShowToast?.(`제목 업데이트 실패: ${error.message}`, 'error');
      return false;
    }
  };

  const handleToggleDescriptionEditMode = useCallback(async () => {
    if (isReadOnly) return;

    if (isDescriptionEditMode) {
      const titleSaved = await handleSaveTitle();
      const descriptionSaved = await descriptionSectionRef.current?.flushPendingSave?.();

      if (titleSaved === false || descriptionSaved === false) {
        return;
      }
    }

    setIsDescriptionEditMode((current) => !current);
  }, [handleSaveTitle, isDescriptionEditMode, isReadOnly]);

  const handleClose = async () => {
    if (isReadOnly) {
      onClose();
      return;
    }

    const titleSaved = await handleSaveTitle();
    const descriptionSaved = await descriptionSectionRef.current?.flushPendingSave?.();

    if (titleSaved === false || descriptionSaved === false) {
      return;
    }

    onClose();
  };

  const handleSaveAssignees = async (updatedAssignees, updatedUserIds) => {
    const currentNames = item.assignees || [];
    const currentIds = item.assignee_user_ids || [];

    if (
      JSON.stringify(updatedAssignees) === JSON.stringify(currentNames)
      && JSON.stringify(updatedUserIds) === JSON.stringify(currentIds)
    ) {
      setIsEditingAssignees(false);
      return;
    }

    await onUpdateItem(itemProjectId, item.id, {
      assignees: updatedAssignees,
      assignee_user_ids: updatedUserIds,
    });
    setIsEditingAssignees(false);
    onShowToast?.('담당자가 업데이트되었습니다.');
  };

  const handleAddTag = async () => {
    const tagName = newTagInput.trim();
    if (!tagName) {
      setIsEditingTags(false);
      return;
    }
    const currentTags = item.tags || [];
    if (!currentTags.includes(tagName)) {
      await onUpdateItem(itemProjectId, item.id, { tags: [...currentTags, tagName] });
      onShowToast?.(`태그 #${tagName} 추가됨`);
    }
    setNewTagInput('');
    setIsEditingTags(false);
  };

  const handleSelectPresetTag = async (tagName) => {
    const currentTags = item.tags || [];
    if (currentTags.includes(tagName)) {
      return;
    }

    const preset = TAG_CATALOG.find((tag) => tag.name === tagName);
    const nextUpdates = { tags: [...currentTags, tagName] };
    const currentDescription = String(item.description || '').trim();
    const templateScaffold = preset?.templateType ? getTemplateScaffold(preset.templateType) : '';

    if (!currentDescription && templateScaffold) {
      nextUpdates.description = templateScaffold;
    }

    await onUpdateItem(itemProjectId, item.id, nextUpdates);

    if (nextUpdates.description) {
      onShowToast?.(`태그 #${tagName} 추가됨. 기본 구조를 넣고 각 항목 안내는 placeholder로 표시합니다.`);
      return;
    }

    onShowToast?.(
      templateScaffold
        ? `태그 #${tagName} 추가됨. 기존 설명이 있어 placeholder 가이드는 표시되지 않습니다.`
        : `태그 #${tagName} 추가됨`
    );
  };

  const handleRemoveTag = async (tag) => {
    const updated = (item.tags || []).filter(t => t !== tag);
    await onUpdateItem(itemProjectId, item.id, { tags: updated });
    onShowToast?.(`태그 #${tag} 삭제됨`);
  };

  const handleToggleTeam = async (team) => {
    if (isRequest) {
      const isAdding = item.request_team !== team;
      await onUpdateItem(itemProjectId, item.id, { request_team: isAdding ? team : null });
      onShowToast?.(`${team} ${isAdding ? '지정' : '해제'}됨`);
      return;
    }

    const currentTeams = item.teams || [];
    const isAdding = !currentTeams.includes(team);
    const updated = currentTeams.includes(team)
      ? currentTeams.filter(t => t !== team)
      : [...currentTeams, team];
    await onUpdateItem(itemProjectId, item.id, { teams: updated });
    onShowToast?.(`${team} ${isAdding ? '추가' : '제외'}됨`);
  };

  const handleAddRelation = async (relatedItemId) => {
    const currentRelations = item.related_items || [];
    if (!currentRelations.includes(relatedItemId)) {
      try {
        await onUpdateItem(itemProjectId, item.id, { related_items: [...currentRelations, relatedItemId] });
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
      await onUpdateItem(itemProjectId, item.id, { related_items: updated });
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
      setShowGitHubIssueCreator(false);
      if (result?.itemStatus === 'in-progress' && (item?.status || 'none') === 'none') {
        await onUpdateItem(itemProjectId, item.id, { status: 'in-progress' });
      }
      const baseMessage = result?.ticket?.ticket_key
        ? `${result.ticket.ticket_key} 티켓으로 GitHub 이슈가 생성되었고 상태가 진행 중으로 변경되었습니다.`
        : 'GitHub 이슈가 생성되었습니다.';
      const labelSyncFailed = result?.labelSync?.success === false;
      const labelMessage = labelSyncFailed
        ? ` 라벨 적용 실패: ${result.labelSync.message || '원인을 확인하지 못했습니다.'}`
        : '';

      if (labelSyncFailed) {
        setGitHubError(`이슈는 생성됐지만 라벨 적용은 실패했습니다. ${result.labelSync.message || ''}`.trim());
      }

      onShowToast?.(`${baseMessage}${labelMessage}`);
    } catch (error) {
      setGitHubError(error.message || 'GitHub 이슈 생성에 실패했습니다.');
      onShowToast?.(error.message || 'GitHub 이슈 생성에 실패했습니다.');
    } finally {
      setIsGitHubSubmitting(false);
    }
  };

  const handleCreateGitHubBranch = async () => {
    if (!item?.id || !hasExistingGitHubIssue) {
      onShowToast?.('브랜치를 생성할 GitHub 이슈 정보를 찾지 못했습니다.');
      return;
    }

    setIsGitHubBranchSubmitting(true);
    setGitHubBranchError('');

    try {
      const result = await createGitHubItemBranch(item.id);
      const linkedBranch = result?.linkedBranch || (
        result?.branch?.branchName || result?.branchName
          ? {
              linkedBranchId: result.linkedBranchId || item.id,
              branchName: result?.branch?.branchName || result.branchName,
              branchUrl: result?.branch?.branchUrl || result.branchUrl || null,
            }
          : null
      );

      if (linkedBranch) {
        setGitHubLinkedBranch(linkedBranch);
        setGitHubLinkedBranchSource(result?.branchSource || 'linked');
      }

      onShowToast?.(
        result?.created === false
          ? `${linkedBranch?.branchName || '브랜치'}가 이미 연결되어 있습니다.`
          : `${linkedBranch?.branchName || '브랜치'}가 생성되었습니다.`
      );
    } catch (error) {
      setGitHubBranchError(error.message || 'GitHub 브랜치 생성에 실패했습니다.');
      onShowToast?.(error.message || 'GitHub 브랜치 생성에 실패했습니다.');
    } finally {
      setIsGitHubBranchSubmitting(false);
    }
  };

  const handleOpenGitHubPullRequestCreator = async () => {
    if (!item?.id || !githubLinkedBranch?.branchName || !hasExistingGitHubIssue) {
      onShowToast?.('먼저 GitHub 이슈와 브랜치를 준비해주세요.');
      return;
    }

    setIsGitHubPullRequestLoading(true);
    setGitHubPullRequestError('');
    try {
      const result = await prepareGitHubItemPullRequest(item.id);
      const existingPullRequest = result?.existingPullRequest || null;
      if (existingPullRequest) {
        setGitHubPullRequests((current) => mergeGitHubPullRequests([existingPullRequest], current));
        onShowToast?.('같은 브랜치의 기존 PR이 이미 연결되어 있습니다.');
        return;
      }

      setGitHubPullRequestDraft({
        repoFullName: result?.repoFullName || githubIssues[0]?.repo_full_name || '',
        issueNumber: result?.issue?.issueNumber || githubIssues[0]?.issue_number || null,
        issueUrl: result?.issue?.issueUrl || githubIssues[0]?.issue_url || '',
        branchName: result?.branch?.branchName || githubLinkedBranch?.branchName || '',
        branchUrl: result?.branch?.branchUrl || githubLinkedBranch?.branchUrl || '',
        base: result?.baseBranch || 'main',
        title: result?.defaultTitle || '',
        body: result?.defaultBody || '',
        draft: result?.draft !== false,
      });
      setShowGitHubPullRequestCreator(true);
    } catch (error) {
      setGitHubPullRequestError(error.message || 'GitHub PR 초안을 준비하지 못했습니다.');
      onShowToast?.(error.message || 'GitHub PR 초안을 준비하지 못했습니다.');
    } finally {
      setIsGitHubPullRequestLoading(false);
    }
  };

  const handleCreateGitHubPullRequest = async () => {
    if (!item?.id || !gitHubPullRequestDraft) {
      onShowToast?.('PR 초안 정보를 찾지 못했습니다.');
      return;
    }

    const issueNumber = Number(gitHubPullRequestDraft.issueNumber || githubIssues[0]?.issue_number);
    if (!gitHubPullRequestDraft.title?.trim()) {
      setGitHubPullRequestError('PR 제목을 입력해주세요.');
      return;
    }

    let nextBody = String(gitHubPullRequestDraft.body || '').trimEnd();
    const closingPattern = Number.isFinite(issueNumber)
      ? new RegExp(`\\b(?:close|closes|closed|fix|fixes|fixed)\\s+#${issueNumber}\\b`, 'i')
      : null;
    if (Number.isFinite(issueNumber) && closingPattern && !closingPattern.test(nextBody)) {
      nextBody = `${nextBody}\n\ncloses #${issueNumber}`.trim();
      onShowToast?.('이슈 연결을 위해 closes 라인을 다시 추가했습니다.');
    }

    setIsGitHubPullRequestSubmitting(true);
    setGitHubPullRequestError('');
    try {
      const result = await createGitHubItemPullRequest(item.id, {
        base: gitHubPullRequestDraft.base,
        title: gitHubPullRequestDraft.title.trim(),
        body: nextBody,
        draft: Boolean(gitHubPullRequestDraft.draft),
      });
      if (result?.pullRequest) {
        setGitHubPullRequests((current) => mergeGitHubPullRequests([result.pullRequest], current));
      }
      setGitHubPullRequestDraft((current) => current ? { ...current, body: nextBody } : current);
      setShowGitHubPullRequestCreator(false);
      onShowToast?.('GitHub PR이 생성되었습니다.');
    } catch (error) {
      if (error.message?.includes('이미 열린 PR')) {
        try {
          const nextPullRequests = await getGitHubItemPullRequests(item.id);
          setGitHubPullRequests(nextPullRequests || []);
        } catch (refreshError) {
          console.error('GitHub PR refresh error:', refreshError);
        }
      }
      setGitHubPullRequestError(error.message || 'GitHub PR 생성에 실패했습니다.');
      onShowToast?.(error.message || 'GitHub PR 생성에 실패했습니다.');
    } finally {
      setIsGitHubPullRequestSubmitting(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (missingRequestFields.length > 0) {
      onShowToast?.(`요청 제출 전에 ${missingRequestFields.join(', ')}을(를) 입력해주세요.`, 'error');
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const submitted = await onSubmitRequest?.(item.id);
      if (submitted?.notified_at) {
        onShowToast?.('개발팀 요청 알림을 전송했습니다.', 'success');
      } else {
        onShowToast?.('요청은 제출됐지만 Google Chat 웹훅이 설정되지 않아 알림은 건너뛰었습니다.');
      }
    } catch (error) {
      onShowToast?.(error.message || '개발팀 요청 제출에 실패했습니다.', 'error');
    } finally {
      setIsSubmittingRequest(false);
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
  const isGitHubSyncLoading = gitHubSyncStatus === 'loading';
  const isGitHubSyncError = gitHubSyncStatus === 'error';
  const isGitHubSyncEmpty = gitHubSyncStatus === 'empty';
  const isGitHubSyncLoaded = gitHubSyncStatus === 'loaded';
  const hasGitHubTicket = Boolean(item?.ticket_key);
  const shouldShowGitHubLoadingIndicator = isGitHubSyncLoading && hasGitHubTicket;
  const shouldAllowIssueActionsWhileLoading = !hasGitHubTicket;
  const shouldShowGitHubActions = !isReadOnly && !isMemo;
  const shouldRenderGitHubSection = !isMemo && (
    hasGitHubTicket
    || isGitHubSubmitting
    || isGitHubSyncError
  );
  const activeGitHubPullRequest = gitHubPullRequests.find((pullRequest) => (
    pullRequest.pull_state_snapshot === 'open' || pullRequest.is_draft
  )) || null;
  const hasActiveGitHubPullRequest = Boolean(activeGitHubPullRequest);
  const needsGitHubAppInstall = Boolean(
    githubStatus?.connected
      && githubStatus?.app?.configured
      && !githubStatus?.app?.installed
  );
  const relationSearchItems = useMemo(
    () => relationItems
      .filter(candidate => candidate.id !== item?.id && !(item?.related_items || []).includes(candidate.id))
      .filter(candidate => {
        if (!relationSearchQuery) return true;
        return (candidate.title || candidate.content || '').toLowerCase().includes(relationSearchQuery.toLowerCase());
      }),
    [item?.id, item?.related_items, relationItems, relationSearchQuery],
  );
  const groupedRelationItems = useMemo(() => {
    const groups = {};
    relationSearchItems.forEach(item => {
      const board = item._boardType || '기타';
      const sub = item._subGroup || '기타';
      if (!groups[board]) groups[board] = {};
      if (!groups[board][sub]) groups[board][sub] = [];
      groups[board][sub].push(item);
    });
    return groups;
  }, [relationSearchItems]);
  const effectiveExpandedBoardTypes = useMemo(() => {
    if (relationSearchQuery) return new Set(Object.keys(groupedRelationItems));
    return expandedBoardTypes;
  }, [relationSearchQuery, groupedRelationItems, expandedBoardTypes]);
  const effectiveExpandedSubGroups = useMemo(() => {
    if (relationSearchQuery) {
      const all = new Set();
      Object.entries(groupedRelationItems).forEach(([board, subs]) => {
        Object.keys(subs).forEach(sub => all.add(`${board}::${sub}`));
      });
      return all;
    }
    return expandedSubGroups;
  }, [relationSearchQuery, groupedRelationItems, expandedSubGroups]);
  const shareLinkModal = showShareLinkModal && (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
      onMouseDown={() => setShowShareLinkModal(false)}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-border-subtle dark:bg-bg-elevated"
        onMouseDown={stopProp}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-gray-400 dark:text-text-tertiary">
              <Share2 size={16} strokeWidth={2.5} />
              공유
            </div>
            <h2 className="mt-2 text-xl font-black text-gray-950 dark:text-text-primary">아이템 링크</h2>
            <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-text-secondary">
              자동 복사가 안 될 때는 아래 링크를 길게 누르거나 선택해서 복사하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowShareLinkModal(false)}
            className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-text-tertiary dark:hover:bg-bg-hover dark:hover:text-text-primary"
            aria-label="공유 링크 닫기"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <input
            readOnly
            value={itemShareLink}
            onFocus={(event) => event.target.select()}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-border-subtle dark:bg-bg-base dark:text-text-primary"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowShareLinkModal(false)}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-600 transition-colors hover:bg-gray-50 dark:border-border-subtle dark:text-text-secondary dark:hover:bg-bg-hover"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={() => handleCopyShareLink(itemShareLink)}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900"
            >
              <Copy size={15} strokeWidth={2.5} />
              복사
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!item) return null;

  if (isRequest) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-bg-base relative animate-slide-in">
        <div className="bg-white/80 dark:bg-bg-base/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 dark:border-border-subtle">
          <div className="px-6 py-2.5 flex items-center gap-3">
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={handleClose} className={headerIconButtonClass}>
                <X size={17} strokeWidth={2.4} />
              </button>
              <button
                onClick={onToggleFullscreen}
                className={headerIconButtonClass}
                aria-label={isFullscreen ? '사이드바로 전환' : '전체화면으로 전환'}
                title={isFullscreen ? '사이드바로 전환' : '전체화면으로 전환'}
              >
                {isFullscreen ? <ChevronsRight size={17} strokeWidth={2.4} /> : <Maximize2 size={17} strokeWidth={2.4} />}
              </button>
              <button
                type="button"
                onClick={handleShareItem}
                className={headerIconButtonClass}
                aria-label="공유 링크 복사"
                title="공유 링크 복사"
              >
                <Share2 size={17} strokeWidth={2.4} />
              </button>
              {!isReadOnly && (
                <button
                  onClick={() => {
                    onShowConfirm('요청 문서 삭제', '정말로 이 요청 문서를 삭제하시겠습니까?', async () => {
                      await onDeleteItem(itemProjectId, item.id);
                      onClose();
                    }, 'danger');
                  }}
                  className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                  title="삭제"
                >
                  <Trash2 size={17} strokeWidth={2.4} />
                </button>
              )}
            </div>

            <div className="min-w-0 flex-1 overflow-hidden">
              <nav className="flex items-center gap-1.5 text-xs font-semibold min-w-0 overflow-hidden whitespace-nowrap">
                <button
                  onClick={() => onBreadcrumbNavigate?.('board', { boardType })}
                  className="bg-gray-100 dark:bg-bg-hover px-2 py-0.5 rounded-md text-gray-500 dark:text-text-secondary shrink-0 hover:text-gray-900 dark:hover:text-text-primary cursor-pointer transition-colors border border-transparent hover:border-gray-200 dark:hover:border-border-strong"
                >
                  📂 {boardLabel}
                </button>
                <ChevronRight size={11} strokeWidth={2.6} className="text-gray-300 dark:text-text-tertiary shrink-0" />
                <button
                  onClick={() => onBreadcrumbNavigate?.('board', { boardType })}
                  className="bg-gray-100 dark:bg-bg-hover px-2 py-0.5 rounded-md text-gray-500 dark:text-text-secondary shrink-0 hover:text-gray-900 dark:hover:text-text-primary cursor-pointer transition-colors border border-transparent hover:border-gray-200 dark:hover:border-border-strong"
                >
                  {sectionLabel}
                </button>
                <ChevronRight size={11} strokeWidth={2.6} className="text-gray-300 dark:text-text-tertiary shrink-0" />
                <span className="text-gray-900 dark:text-text-primary truncate font-semibold min-w-0">{item.title || item.content}</span>
              </nav>
            </div>

            <div className="hidden md:flex items-center gap-1.5 shrink-0">
              <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-white/20 dark:border-black/10 transition-colors ${requestStatusTone}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${requestStatusDotColor}`}></span>
                {requestStatusLabel}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-50 dark:bg-bg-hover text-gray-500 dark:text-text-secondary border border-gray-200 dark:border-border-subtle tabular-nums">
                요청한 팀 {teamCount}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex flex-col gap-8">
              <div className="flex items-start gap-4">
                <input
                  autoFocus
                  className="text-display text-gray-900 dark:text-text-primary bg-gray-50 dark:bg-bg-hover rounded-2xl p-2 -ml-2 w-full border-none focus:ring-4 focus:ring-brand-500/10"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      await handleSaveTitle();
                    }
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                />
              </div>

              {!isReadOnly && (
                <div className="rounded-3xl border border-amber-200/70 bg-amber-50/70 px-5 py-4 dark:border-amber-900/35 dark:bg-amber-950/15">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-amber-950 dark:text-amber-100">
                        {isRequestNotified
                          ? '요청 알림 전송 완료'
                          : isRequestSubmittedWithoutNotification
                            ? '요청 제출됨 · 알림 미전송'
                            : '작성 완료 후 개발팀에 요청을 보냅니다'}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-amber-800/75 dark:text-amber-200/75">
                        {missingRequestFields.length > 0
                          ? `필수 입력: ${missingRequestFields.join(', ')}`
                          : '제목, 본문, 우선순위가 저장된 뒤 전송할 수 있습니다.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isRequestNotified || isSubmittingRequest || missingRequestFields.length > 0}
                      onClick={handleSubmitRequest}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-black text-amber-800 shadow-sm transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/45"
                    >
                      {isRequestNotified ? <CheckCircle2 size={16} /> : <Send size={16} />}
                      <span>
                        {isRequestNotified
                          ? '요청 전송됨'
                          : isRequestSubmittedWithoutNotification
                            ? '알림 다시 시도'
                            : isSubmittingRequest
                              ? '전송 중...'
                              : '개발팀에 요청 보내기'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-gray-50/50 dark:bg-bg-elevated/30 rounded-3xl p-6 border border-gray-100 dark:border-border-subtle flex flex-col gap-4">
                <div className="flex items-center min-h-[48px] group">
                  <div className="w-48 flex items-center gap-3 text-gray-400 dark:text-text-tertiary shrink-0">
                    <Clock size={18} strokeWidth={2.5} />
                    <span className="text-[13px] font-black uppercase tracking-widest">현재 상태</span>
                  </div>
                  <div className="flex-1 px-3 py-2 rounded-xl hover:shadow-sm hover:ring-1 hover:ring-gray-100 dark:hover:ring-border-subtle transition-all relative">
                    <select
                      disabled={isReadOnly}
                      className="bg-transparent dark:bg-transparent border-none outline-none p-0 text-sm font-black text-gray-800 dark:text-text-primary focus:ring-0 cursor-pointer appearance-none w-full relative z-10"
                      value={item.status || '접수됨'}
                      onChange={(e) => onUpdateItem(itemProjectId, item.id, { status: e.target.value })}
                    >
                      {DEV_REQUEST_STATUSES?.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-start min-h-[48px] group">
                  <div className="w-48 flex items-center gap-3 text-gray-400 dark:text-text-tertiary shrink-0 pt-2.5">
                    <Building2 size={18} strokeWidth={2.5} />
                    <span className="text-[13px] font-black uppercase tracking-widest">요청한 팀</span>
                  </div>
                  <div className="flex-1 px-3 py-2 rounded-xl hover:bg-white dark:hover:bg-bg-hover transition-all flex flex-wrap gap-2 min-h-[40px] items-center">
                    {TEAMS.map((team) => (
                      <button
                        key={team.name}
                        disabled={isReadOnly}
                        onClick={() => handleToggleTeam(team.name)}
                        className={`px-3.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all border ${(item.request_team === team.name) ? 'bg-gray-900 border-gray-900 text-white dark:bg-white dark:border-white dark:text-gray-900 shadow-md scale-105' : 'bg-white dark:bg-bg-base border-gray-200 dark:border-border-subtle text-gray-400 dark:text-text-tertiary hover:border-gray-400 dark:hover:border-border-strong cursor-pointer'} disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        {team.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center min-h-[48px] group">
                  <div className="w-48 flex items-center gap-3 text-gray-400 dark:text-text-tertiary shrink-0">
                    <Flag size={18} strokeWidth={2.5} />
                    <span className="text-[13px] font-black uppercase tracking-widest">우선순위</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white dark:hover:bg-bg-hover hover:shadow-sm hover:ring-1 hover:ring-gray-100 dark:hover:ring-border-subtle transition-all">
                    <select
                      disabled={isReadOnly}
                      value={item.priority || '중간'}
                      onChange={(e) => onUpdateItem(itemProjectId, item.id, { priority: e.target.value })}
                      className="bg-transparent border-none p-0 text-sm font-black text-gray-800 dark:text-text-primary focus:ring-0 cursor-pointer appearance-none w-full dark:color-scheme-dark disabled:cursor-default"
                    >
                      {['높음', '중간', '낮음'].map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <ItemDescriptionSection
                ref={descriptionSectionRef}
                item={item}
                projectId={itemProjectId}
                allItems={allItems}
                isReadOnly={isReadOnly}
                editingEnabled={isDescriptionEditMode}
                entityContext={entityContext}
                onModeChange={(mode) => setIsDescriptionSplitView(isDescriptionEditMode && mode === 'split')}
                onEditingChange={setIsEditingDescription}
                onOpenDetail={onOpenDetail}
                onShowToast={onShowToast}
                onUpdateItem={onUpdateItem}
                onAddChildPage={null}
                onShowPrompt={onShowPrompt}
                editorViewRef={editorViewRef}
                onEditorUpdate={handleEditorUpdate}
              />
            </div>
          </div>
        </div>
        {shareLinkModal}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-bg-base relative animate-slide-in">
      {/* Top Header */}
      <div className="bg-white/80 dark:bg-bg-base/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 dark:border-border-subtle">
        <ItemViewers itemId={item.id} />
        <div className="px-6 py-2.5 flex items-center gap-3">
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={handleClose} className={headerIconButtonClass}>
              <X size={17} strokeWidth={2.4} />
            </button>
            <button
              onClick={onToggleFullscreen}
              className={headerIconButtonClass}
              aria-label={isFullscreen ? '사이드바로 전환' : '전체화면으로 전환'}
              title={isFullscreen ? '사이드바로 전환' : '전체화면으로 전환'}
            >
              {isFullscreen ? <ChevronsRight size={17} strokeWidth={2.4} /> : <Maximize2 size={17} strokeWidth={2.4} />}
            </button>
            <button
              type="button"
              onClick={handleShareItem}
              className={headerIconButtonClass}
              aria-label="공유 링크 복사"
              title="공유 링크 복사"
            >
              <Share2 size={17} strokeWidth={2.4} />
            </button>
            {!isReadOnly && (
              <button
                type="button"
                onClick={handleToggleDescriptionEditMode}
                className={`${headerToggleButtonClass} ${isDescriptionEditMode ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-300' : 'text-gray-400 dark:text-text-tertiary hover:bg-gray-100 dark:hover:bg-bg-hover hover:text-gray-900 dark:hover:text-text-primary'}`}
                title={isDescriptionEditMode ? '수정 완료' : '본문 수정'}
              >
                {isDescriptionEditMode ? <CheckCircle2 size={17} strokeWidth={2.4} /> : <Pencil size={17} strokeWidth={2.4} />}
              </button>
            )}
            <button
              onClick={() => setIsWideView(v => !v)}
              className={`${headerToggleButtonClass} ${isWideView ? 'bg-brand-50 dark:bg-brand-800/20 text-brand-500 dark:text-brand-400' : 'text-gray-400 dark:text-text-tertiary hover:bg-gray-100 dark:hover:bg-bg-hover hover:text-gray-900 dark:hover:text-text-primary'}`}
              title={isWideView ? '기본 너비로 보기' : '넓게 보기'}
            >
              {isWideView ? <AlignCenter size={17} strokeWidth={2.4} /> : <AlignJustify size={17} strokeWidth={2.4} />}
            </button>
            {!isDescriptionEditMode && (
              <>
                <button
                  onClick={() => {
                    if (isDocRailOpen && docRailTab === 'outline') {
                      setIsDocRailOpen(false);
                      return;
                    }
                    handleDocRailTabClick('outline');
                  }}
                  className={`${headerToggleButtonClass} ${isDocRailOpen && docRailTab === 'outline' ? 'bg-brand-50 dark:bg-brand-800/20 text-brand-500 dark:text-brand-400' : 'text-gray-400 dark:text-text-tertiary hover:bg-gray-100 dark:hover:bg-bg-hover hover:text-gray-900 dark:hover:text-text-primary'}`}
                  title={isDocRailOpen && docRailTab === 'outline' ? '문서 레일 숨기기' : '목차 표시'}
                >
                  <List size={17} strokeWidth={2.4} />
                </button>
                <button
                  onClick={() => {
                    if (isDocRailOpen && docRailTab === 'backlinks') {
                      setIsDocRailOpen(false);
                      return;
                    }
                    handleDocRailTabClick('backlinks');
                  }}
                  className={`${headerToggleButtonClass} ${isDocRailOpen && docRailTab === 'backlinks' ? 'bg-brand-50 dark:bg-brand-800/20 text-brand-500 dark:text-brand-400' : 'text-gray-400 dark:text-text-tertiary hover:bg-gray-100 dark:hover:bg-bg-hover hover:text-gray-900 dark:hover:text-text-primary'}`}
                  title={isDocRailOpen && docRailTab === 'backlinks' ? '문서 레일 숨기기' : '백링크 표시'}
                >
                  <Link2 size={17} strokeWidth={2.4} />
                </button>
                <button
                  onClick={() => {
                    if (isDocRailOpen && docRailTab === 'mentions') {
                      setIsDocRailOpen(false);
                      return;
                    }
                    handleDocRailTabClick('mentions');
                  }}
                  className={`${headerToggleButtonClass} ${isDocRailOpen && docRailTab === 'mentions' ? 'bg-brand-50 dark:bg-brand-800/20 text-brand-500 dark:text-brand-400' : 'text-gray-400 dark:text-text-tertiary hover:bg-gray-100 dark:hover:bg-bg-hover hover:text-gray-900 dark:hover:text-text-primary'}`}
                  title={isDocRailOpen && docRailTab === 'mentions' ? '문서 레일 숨기기' : '언급 보기'}
                >
                  <ClipboardList size={17} strokeWidth={2.4} />
                </button>
              </>
            )}
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
                      await onDeletePhase?.(phaseId);
                    } else {
                      await onDeleteItem(itemProjectId, item.id);
                    }
                    onClose();
                  }, 'danger');
                }}
                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                title="삭제"
              >
                <Trash2 size={17} strokeWidth={2.4} />
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1 overflow-hidden">
            <nav className="flex items-center gap-1.5 text-xs font-semibold min-w-0 overflow-hidden whitespace-nowrap">
              <button
                onClick={() => onBreadcrumbNavigate?.('board', { boardType })}
                className="bg-gray-100 dark:bg-bg-hover px-2 py-0.5 rounded-md text-gray-500 dark:text-text-secondary shrink-0 hover:text-gray-900 dark:hover:text-text-primary cursor-pointer transition-colors border border-transparent hover:border-gray-200 dark:hover:border-border-strong"
              >
                📂 {boardLabel}
              </button>
              <ChevronRight size={11} strokeWidth={2.6} className="text-gray-300 dark:text-text-tertiary shrink-0" />
              <button
                onClick={() => onBreadcrumbNavigate?.('project', { projectId: phase?.id, boardType })}
                disabled={!isProjectLike && entityContext?.collection !== 'project'}
                className="bg-gray-100 dark:bg-bg-hover px-2 py-0.5 rounded-md text-gray-500 dark:text-text-secondary shrink-0 hover:text-gray-900 dark:hover:text-text-primary cursor-pointer transition-colors border border-transparent hover:border-gray-200 dark:hover:border-border-strong"
              >
                {sectionLabel}
              </button>
              {itemPath.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 shrink-0">
                  <ChevronRight size={11} strokeWidth={2.6} className="text-gray-300 dark:text-text-tertiary" />
                  <button
                    onClick={() => onOpenDetail?.(p.id)}
                    className="bg-gray-100 dark:bg-bg-hover px-2 py-0.5 rounded-md text-gray-500 dark:text-text-secondary hover:text-gray-900 dark:hover:text-text-primary cursor-pointer transition-colors border border-transparent hover:border-gray-200 dark:hover:border-border-strong"
                  >
                    📄 {p.title || p.content}
                  </button>
                </div>
              ))}
              <ChevronRight size={11} strokeWidth={2.6} className="text-gray-300 dark:text-text-tertiary shrink-0" />
              <span className="text-gray-900 dark:text-text-primary truncate font-semibold min-w-0">{item.title || item.content}</span>
            </nav>
          </div>

          {!isMemo && (
            <div className="hidden md:flex items-center gap-1.5 shrink-0">
              <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-white/20 dark:border-black/10 transition-colors ${statusInfo.color}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotColor}`}></span>
                {statusInfo.label}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-50 dark:bg-bg-hover text-gray-500 dark:text-text-secondary border border-gray-200 dark:border-border-subtle tabular-nums">
                담당자 {assigneeCount}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-50 dark:bg-bg-hover text-gray-500 dark:text-text-secondary border border-gray-200 dark:border-border-subtle tabular-nums">
                팀 {teamCount}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* 메인 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-bg-base transition-colors duration-200">
        <div className={`${useExpandedCanvas ? 'w-full px-3 md:px-4 xl:px-5 2xl:px-6' : 'max-w-4xl mx-auto px-12'} py-16 flex flex-col gap-16 transition-all duration-300`}>
          
          {/* Title */}
          <div className="flex flex-col gap-4">
            <span className="text-[11px] font-black text-text-tertiary uppercase tracking-[0.3em] ml-1">
              {isMemo ? '노트' : 'Work Item Title'}
            </span>
            {!isEditingTitle ? (
              <h1 
                onClick={() => !isReadOnly && isDescriptionEditMode && setIsEditingTitle(true)}
                className={`text-display text-gray-900 dark:text-text-primary outline-none transition-all duration-200 ${!isReadOnly && isDescriptionEditMode ? 'hover:bg-gray-50 dark:hover:bg-bg-hover cursor-pointer rounded-2xl p-2 -ml-2' : ''}`}
              >
                {item.title || item.content}
              </h1>
            ) : (
              <input 
                autoFocus
                className="text-display text-gray-900 dark:text-text-primary bg-gray-50 dark:bg-bg-hover rounded-2xl p-2 -ml-2 w-full border-none focus:ring-4 focus:ring-brand-500/10"
                value={titleInput}
                onChange={e => setTitleInput(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    await handleSaveTitle();
                  }
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
              />
            )}
            {shouldShowGitHubActions && (
              <div className="flex flex-wrap items-center gap-2">
                {shouldShowGitHubLoadingIndicator && (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-gray-500 shadow-sm dark:border-border-subtle dark:bg-bg-elevated dark:text-text-secondary">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 dark:border-border-subtle dark:border-t-blue-400" />
                    GitHub 연동 정보를 불러오는 중...
                  </div>
                )}
                {isGitHubSyncError && (
                  <>
                    <div className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black text-red-600 shadow-sm dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                      GitHub 연동 정보를 불러오지 못했습니다.
                    </div>
                    <button
                      type="button"
                      onClick={handleRetryGitHubSync}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-black text-red-600 shadow-sm transition-colors hover:border-red-300 hover:bg-red-50 dark:border-red-500/40 dark:bg-bg-elevated dark:text-red-300 dark:hover:bg-red-500/10"
                    >
                      다시 시도
                    </button>
                  </>
                )}
                {(isGitHubSyncLoaded || isGitHubSyncEmpty || shouldAllowIssueActionsWhileLoading) && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setGitHubError('');
                        setShowGitHubIssueCreator(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-gray-600 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 dark:border-border-subtle dark:bg-bg-elevated dark:text-text-secondary dark:hover:border-border-strong dark:hover:bg-bg-hover dark:hover:text-text-primary"
                    >
                      <Github size={14} strokeWidth={2.5} />
                      {hasExistingGitHubIssue ? 'GitHub 이슈 보기' : 'GitHub 이슈 생성하기'}
                    </button>
                    {hasExistingGitHubIssue && (
                      <button
                        type="button"
                        onClick={handleOpenGitHubPullRequestCreator}
                        disabled={isGitHubPullRequestLoading || !githubLinkedBranch?.branchName}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-gray-600 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-subtle dark:bg-bg-elevated dark:text-text-secondary dark:hover:border-border-strong dark:hover:bg-bg-hover dark:hover:text-text-primary"
                      >
                        <Github size={14} strokeWidth={2.5} />
                        {isGitHubPullRequestLoading
                          ? 'PR 초안 준비 중...'
                          : hasActiveGitHubPullRequest
                            ? 'GitHub PR 보기'
                            : 'GitHub PR 생성하기'}
                      </button>
                    )}
                  </>
                )}
              </div>
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
              <div className="flex-1 px-3 py-2 rounded-xl hover:shadow-sm hover:ring-1 hover:ring-gray-100 dark:hover:ring-border-subtle transition-all relative">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${item.status === 'done' ? 'bg-emerald-500' : item.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                  <select
                    disabled={isReadOnly}
                    className="bg-transparent dark:bg-transparent border-none outline-none p-0 text-sm font-black text-gray-800 dark:text-text-primary focus:ring-0 cursor-pointer appearance-none w-full relative z-10"
                    value={item.status || 'none'}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      onUpdateItem(itemProjectId, item.id, { status: newStatus });
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
            {!isRequest && (
              <div className="flex items-center min-h-[48px] group">
                <div className="w-48 flex items-center gap-3 text-gray-400 dark:text-text-tertiary shrink-0">
                  <Users size={18} strokeWidth={2.5} />
                  <span className="text-[13px] font-black uppercase tracking-widest">담당 인원</span>
                </div>
              <div 
                className={`flex-1 px-3 py-2 rounded-xl transition-all min-h-[40px] flex items-center ${!isReadOnly ? 'hover:bg-white dark:hover:bg-bg-hover hover:shadow-sm hover:ring-1 hover:ring-gray-100 dark:hover:ring-border-subtle cursor-pointer' : ''} ${isEditingAssignees ? 'bg-white dark:bg-bg-hover ring-2 ring-brand-500/15 border-brand-400/30 shadow-md' : ''}`}
                onClick={() => !isReadOnly && setIsEditingAssignees(true)}
              >
                {!isEditingAssignees ? (
                 <div className="flex flex-wrap gap-2 w-full">
                    {(item.assignees || []).length > 0 ? (
                       item.assignees.map(a => <span key={a} className="bg-gray-100 dark:bg-bg-base text-gray-800 dark:text-text-primary px-3 py-1 rounded-lg text-[13px] font-black border border-gray-200 dark:border-border-subtle shadow-sm">@{a}</span>)
                     ) : <span className="text-[13px] font-bold text-gray-300 dark:text-text-tertiary italic">비어 있음</span>}
                   </div>
                 ) : (
                   <div className="w-full" onClick={stopProp} onPointerDown={stopProp}>
                     <AssigneePicker
                       value={item.assignees || []}
                       selectedUserIds={item.assignee_user_ids || []}
                       onChange={handleSaveAssignees}
                       onCancel={() => setIsEditingAssignees(false)}
                       onInvalidAssignee={onShowToast}
                       isReadOnly={isReadOnly}
                       placeholder="등록된 담당자 이름 입력"
                       className="w-full"
                     />
                   </div>
                  )}
                </div>
              </div>
            )}

            {/* Teams */}
              <div className="flex items-start min-h-[48px] group">
                <div className="w-48 flex items-center gap-3 text-gray-400 dark:text-text-tertiary shrink-0 pt-2.5">
                  <Building2 size={18} strokeWidth={2.5} />
                  <span className="text-[13px] font-black uppercase tracking-widest">{isRequest ? '요청한 팀' : '관련 팀'}</span>
                </div>
                <div className="flex-1 px-3 py-2 rounded-xl hover:bg-white dark:hover:bg-bg-hover transition-all flex flex-wrap gap-2 min-h-[40px] items-center">
                  {TEAMS.map(team => (
                    <button
                      key={team.name}
                      disabled={isReadOnly}
                      onClick={() => handleToggleTeam(team.name)}
                      className={`px-3.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all border ${(isRequest ? item.request_team === team.name : item.teams?.includes(team.name)) ? 'bg-gray-900 border-gray-900 text-white dark:bg-white dark:border-white dark:text-gray-900 shadow-md scale-105' : 'bg-white dark:bg-bg-base border-gray-200 dark:border-border-subtle text-gray-400 dark:text-text-tertiary hover:border-gray-400 dark:hover:border-border-strong cursor-pointer'} disabled:opacity-40 disabled:cursor-not-allowed`}
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
                className={`flex-1 px-3 py-2 rounded-xl transition-all min-h-[40px] flex flex-wrap gap-2 items-center ${!isReadOnly ? 'hover:bg-white dark:hover:bg-bg-hover hover:shadow-sm hover:ring-1 hover:ring-gray-100 dark:hover:ring-border-subtle cursor-pointer' : ''} ${isEditingTags ? 'bg-white dark:bg-bg-hover ring-2 ring-brand-500/15 border-brand-400/30 shadow-md' : ''}`}
                onClick={() => !isReadOnly && setIsEditingTags(true)}
              >
                {(item.tags || []).map(tag => (
                  <span
                    key={tag}
                    className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-text-secondary border border-slate-200 dark:border-border-subtle px-3 py-1 rounded-lg font-mono text-[11px] font-black uppercase shadow-sm group/tag"
                    title={TAG_CATALOG.find((candidate) => candidate.name === tag)?.description || tag}
                  >
                    #{tag}
                    {!isReadOnly && <button onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }} className="hover:text-red-600 cursor-pointer opacity-0 group-hover/tag:opacity-100 transition-opacity"><X size={10} strokeWidth={4} /></button>}
                  </span>
                ))}
                {!isReadOnly && (
                  isEditingTags ? (
                    <div className="w-full flex flex-col gap-3" onClick={stopProp}>
                      <div className="flex flex-wrap gap-2">
                        {TAG_CATALOG.map((tag) => {
                          const isSelected = (item.tags || []).includes(tag.name);
                          return (
                            <button
                              key={tag.name}
                              type="button"
                              disabled={isSelected}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => handleSelectPresetTag(tag.name)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-black tracking-wide border transition-all ${
                                isSelected
                                  ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                                  : 'bg-white dark:bg-bg-base text-gray-700 dark:text-text-secondary border-gray-200 dark:border-border-subtle hover:border-brand-300 hover:text-brand-600 dark:hover:text-brand-400'
                              } disabled:cursor-default`}
                              title={tag.description}
                            >
                              #{tag.name}
                            </button>
                          );
                        })}
                      </div>
                      <input
                        autoFocus
                        placeholder="직접 태그 입력..."
                        className="bg-transparent border-none p-0 font-mono text-[13px] font-black text-gray-900 dark:text-text-primary focus:ring-0 w-full"
                        value={newTagInput}
                        onChange={e => setNewTagInput(e.target.value)}
                        onBlur={handleAddTag}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddTag();
                          if (e.key === 'Escape') setIsEditingTags(false);
                        }}
                      />
                    </div>
                  ) : (
                    <span className="text-[11px] font-black text-brand-500 dark:text-brand-400 uppercase tracking-widest">+ 태그 추가</span>
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
                className={`flex-1 px-3 py-2 rounded-xl transition-all min-h-[40px] flex flex-col gap-2 justify-center ${!isReadOnly ? 'hover:bg-white dark:hover:bg-bg-hover hover:shadow-sm hover:ring-1 hover:ring-gray-100 dark:hover:ring-border-subtle' : ''} ${isEditingRelations ? 'bg-white dark:bg-bg-hover ring-2 ring-brand-500/15 border-brand-400/30 shadow-md' : ''}`}
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
                        className="flex items-center gap-2 bg-brand-50 dark:bg-brand-800/20 text-brand-700 dark:text-brand-300 border border-brand-100 dark:border-brand-700/40 px-3 py-1.5 rounded-xl text-[13px] font-black shadow-sm group/rel cursor-pointer hover:bg-brand-100 dark:hover:bg-brand-800/30 transition-all hover:scale-105 active:scale-95"
                      >
                        {relatedItem._isRequest
                          ? <ClipboardList size={12} strokeWidth={2.5} />
                          : <ArrowUpRight size={12} strokeWidth={3} />
                        }
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
                    <span className="text-[11px] font-black text-brand-500 dark:text-brand-400 uppercase tracking-widest cursor-pointer">+ 업무 연결</span>
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
                        className="w-full bg-white dark:bg-bg-base border border-gray-200 dark:border-border-subtle pl-10 pr-4 py-2.5 rounded-xl text-sm font-bold text-gray-900 dark:text-text-primary focus:ring-4 focus:ring-brand-500/10 outline-none shadow-sm transition-all"
                        value={relationSearchQuery}
                        onChange={e => setRelationSearchQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') setIsEditingRelations(false); }}
                      />
                    </div>
                    <div className="absolute top-full left-0 w-full max-h-72 overflow-y-auto bg-white dark:bg-bg-elevated border border-gray-200 dark:border-border-subtle rounded-2xl shadow-2xl z-[100] mt-2 p-1.5 custom-scrollbar animate-in zoom-in-95 duration-200">
                      {Object.entries(groupedRelationItems).map(([boardType, subGroups]) => {
                        const isBoardExpanded = effectiveExpandedBoardTypes.has(boardType);
                        const totalCount = Object.values(subGroups).reduce((s, arr) => s + arr.length, 0);
                        return (
                          <div key={boardType}>
                            <button
                              type="button"
                              onClick={() => setExpandedBoardTypes(prev => {
                                const next = new Set(prev);
                                if (next.has(boardType)) next.delete(boardType); else next.add(boardType);
                                return next;
                              })}
                              className="w-full flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] text-gray-500 dark:text-text-tertiary hover:bg-gray-50 dark:hover:bg-bg-hover transition-colors"
                            >
                              <ChevronRight size={11} strokeWidth={3} className={`transition-transform duration-150 ${isBoardExpanded ? 'rotate-90' : ''}`} />
                              <span>{boardType}</span>
                              <span className="ml-auto text-[10px] font-bold text-gray-300 dark:text-text-tertiary">{totalCount}</span>
                            </button>
                            {isBoardExpanded && Object.entries(subGroups).map(([subGroup, items]) => {
                              const subKey = `${boardType}::${subGroup}`;
                              const isSubExpanded = effectiveExpandedSubGroups.has(subKey);
                              return (
                                <div key={subKey} className="ml-2">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedSubGroups(prev => {
                                      const next = new Set(prev);
                                      if (next.has(subKey)) next.delete(subKey); else next.add(subKey);
                                      return next;
                                    })}
                                    className="w-full flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-gray-400 dark:text-text-tertiary hover:bg-gray-50 dark:hover:bg-bg-hover transition-colors"
                                  >
                                    <ChevronRight size={10} strokeWidth={2.5} className={`transition-transform duration-150 ${isSubExpanded ? 'rotate-90' : ''}`} />
                                    <span>{subGroup}</span>
                                    <span className="ml-auto text-[10px] text-gray-300 dark:text-text-tertiary">{items.length}</span>
                                  </button>
                                  {isSubExpanded && items.map(searchItem => (
                                    <div
                                      key={searchItem.id}
                                      onClick={() => handleAddRelation(searchItem.id)}
                                      className="ml-4 px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-text-secondary hover:bg-brand-50 dark:hover:bg-brand-800/20 hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer transition-colors flex items-center justify-between group/searchitem"
                                    >
                                      <span className="truncate">{searchItem.title || searchItem.content}</span>
                                      <Plus size={13} className="shrink-0 opacity-0 group-hover/searchitem:opacity-100 transition-opacity ml-2" />
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                      {relationSearchItems.length === 0 && (
                        <div className="p-8 text-center text-[13px] font-bold text-gray-400 dark:text-text-tertiary italic">검색 결과가 없습니다.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 연결된 업무 (요청문서에서 역방향 링크) */}
            {reverseLinkedItems !== null && (
              <div className="flex items-start min-h-[48px]">
                <div className="w-48 flex items-center gap-3 text-gray-400 dark:text-text-tertiary shrink-0 pt-2.5">
                  <ClipboardList size={18} strokeWidth={2.5} />
                  <span className="text-[13px] font-black uppercase tracking-widest">연결된 업무</span>
                </div>
                <div className="flex-1 px-3 py-2 rounded-xl min-h-[40px] flex flex-col gap-2 justify-center">
                  {reverseLinkedItems.length === 0 ? (
                    <span className="text-[13px] font-bold text-gray-300 dark:text-text-tertiary italic ml-1">연결된 업무 없음</span>
                  ) : (
                    <div className="flex flex-wrap gap-2 items-center">
                      {reverseLinkedItems.map(linked => (
                        <span
                          key={linked.id}
                          onClick={() => onOpenDetail?.(linked.id)}
                          className="flex items-center gap-2 bg-brand-50 dark:bg-brand-800/20 text-brand-700 dark:text-brand-300 border border-brand-100 dark:border-brand-700/40 px-3 py-1.5 rounded-xl text-[13px] font-black shadow-sm cursor-pointer hover:bg-brand-100 dark:hover:bg-brand-800/30 transition-all hover:scale-105 active:scale-95"
                        >
                          <ArrowUpRight size={12} strokeWidth={3} />
                          {linked.title || linked.content}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

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
                      onUpdatePhase?.(phaseId, { start_date: newValue });
                    } else {
                      onUpdateItem(itemProjectId, item.id, { start_date: newValue });
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
                      onUpdatePhase?.(phaseId, { end_date: newValue });
                    } else {
                      onUpdateItem(itemProjectId, item.id, { end_date: newValue });
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
                  onChange={e => onUpdateItem(itemProjectId, item.id, { priority: Number(e.target.value) })}
                  className="bg-transparent border-none p-0 text-sm font-black text-gray-800 dark:text-text-primary focus:ring-0 cursor-pointer appearance-none w-full dark:color-scheme-dark disabled:cursor-default"
                >
                  {Object.entries(PRIORITY_MAP).map(([val, { label, icon }]) => (
                    <option key={val} value={val}>{icon ? `${icon} ${label}` : label}</option>
                  ))}
                </select>
              </div>
            </div>

            {shouldRenderGitHubSection && (
              <div className="flex items-start min-h-[48px] group">
                <div className="w-48 flex items-center gap-3 text-gray-400 dark:text-text-tertiary shrink-0 pt-2.5">
                  <Github size={18} strokeWidth={2.5} />
                  <span className="text-[13px] font-black uppercase tracking-widest">GitHub</span>
                </div>
                <div className="flex-1 flex flex-col gap-2 px-3 py-2 rounded-xl bg-white dark:bg-bg-hover border border-gray-100 dark:border-border-subtle">
                  {shouldShowGitHubLoadingIndicator && (
                    <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-500 dark:border-border-subtle dark:bg-bg-base dark:text-text-secondary">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 dark:border-border-subtle dark:border-t-blue-400" />
                      GitHub 연동 정보를 불러오는 중입니다...
                    </div>
                  )}
                  {isGitHubSyncError && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                      <span>{gitHubError || 'GitHub 연동 정보를 불러오지 못했습니다.'}</span>
                      <button
                        type="button"
                        onClick={handleRetryGitHubSync}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-black text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/40 dark:bg-bg-elevated dark:text-red-300 dark:hover:bg-red-500/10"
                      >
                        다시 시도
                      </button>
                    </div>
                  )}
                  {(isGitHubSyncLoaded || isGitHubSyncEmpty) && (
                    <>
                      {(hasExistingGitHubIssue || isGitHubSubmitting) ? (
                        <>
                          {githubIssues.map((issue) => {
                            const linkedBranch = githubLinkedBranch;
                            const isCreatingBranch = isGitHubBranchSubmitting;

                            return (
                              <div
                                key={issue.id || `${issue.repo_full_name}-${issue.issue_number}`}
                                className="rounded-xl border border-gray-100 px-3 py-3 dark:border-border-subtle"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <a
                                    href={issue.issue_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex min-w-0 items-center gap-2 flex-wrap text-sm text-gray-700 dark:text-text-secondary hover:text-brand-600 dark:hover:text-brand-400"
                                  >
                                    <span className="font-bold truncate">
                                      {issue.repo_full_name}#{issue.issue_number}
                                    </span>
                                    {(issue.ticket_key || ticketKey) && (
                                      <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-bg-base text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-text-secondary">
                                        {issue.ticket_key || ticketKey}
                                      </span>
                                    )}
                                  </a>
                                  <ExternalLink size={14} className="shrink-0 text-gray-400 dark:text-text-tertiary" />
                                </div>

                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-bg-base">
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-text-tertiary">
                                      Linked Branch
                                    </p>
                                    {linkedBranch ? (
                                      <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <span className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-black text-gray-700 dark:border-border-subtle dark:bg-bg-hover dark:text-text-primary">
                                          {linkedBranch.branchName}
                                        </span>
                                        {githubLinkedBranchSource === 'discovered' && (
                                          <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                                            자동 탐색
                                          </span>
                                        )}
                                        {githubLinkedBranchSource === 'linked-fallback' && (
                                          <span className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
                                            linked branch
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            const copied = await copyTextToClipboard(linkedBranch.branchName);
                                            if (copied) {
                                              onShowToast?.('브랜치명이 복사되었습니다.');
                                            }
                                          }}
                                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-black text-gray-600 transition-colors hover:bg-white dark:border-border-subtle dark:text-text-secondary dark:hover:bg-bg-hover"
                                        >
                                          <Copy size={12} strokeWidth={2.6} />
                                          복사
                                        </button>
                                      </div>
                                    ) : isGitHubBranchLoading ? (
                                      <div className="mt-1 flex items-center gap-2">
                                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 dark:border-border-subtle dark:border-t-blue-400" />
                                        <p className="text-xs font-bold text-gray-500 dark:text-text-secondary">브랜치 확인 중...</p>
                                      </div>
                                    ) : (
                                      <p className="mt-1 text-xs font-bold text-gray-500 dark:text-text-secondary">
                                        아직 연결된 브랜치가 없습니다.
                                      </p>
                                    )}
                                    {linkedBranch && githubLinkedBranchSource === 'discovered' && (
                                      <p className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                                        ticket 기준으로 레포 브랜치를 자동 탐색해 표시했습니다. GitHub 이슈의 Development 영역에는 아직 직접 연결되지 않았을 수 있습니다.
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {linkedBranch?.branchUrl && (
                                      <a
                                        href={linkedBranch.branchUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-black text-gray-600 transition-colors hover:bg-white dark:border-border-subtle dark:text-text-secondary dark:hover:bg-bg-hover"
                                      >
                                        <ExternalLink size={12} strokeWidth={2.6} />
                                        브랜치 보기
                                      </a>
                                    )}
                                    {!isReadOnly && !linkedBranch && (
                                      <button
                                        type="button"
                                        onClick={handleCreateGitHubBranch}
                                        disabled={isCreatingBranch}
                                        className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-[11px] font-black text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900"
                                      >
                                        {isCreatingBranch ? '생성 중...' : '브랜치 생성'}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 dark:bg-bg-base">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-text-tertiary">
                                        Pull Request
                                      </p>
                                      {gitHubPullRequests.length > 0 ? (
                                        <div className="mt-1 flex flex-col gap-2">
                                          {gitHubPullRequests.map((pullRequest) => {
                                            const stateTone = pullRequest.pull_state_snapshot === 'merged'
                                              ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300'
                                              : pullRequest.pull_state_snapshot === 'open'
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                                                : 'border-gray-200 bg-white text-gray-600 dark:border-border-subtle dark:bg-bg-hover dark:text-text-secondary';
                                            return (
                                              <div key={pullRequest.id || `${pullRequest.repo_full_name}-${pullRequest.pull_number}`} className="flex flex-wrap items-center gap-2">
                                                <a
                                                  href={pullRequest.pull_url}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="inline-flex min-w-0 items-center gap-2 text-xs font-black text-gray-700 hover:text-brand-600 dark:text-text-secondary dark:hover:text-brand-400"
                                                >
                                                  <span className="truncate">
                                                    {pullRequest.repo_full_name}#{pullRequest.pull_number}
                                                  </span>
                                                  <ExternalLink size={12} className="shrink-0" />
                                                </a>
                                                <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${stateTone}`}>
                                                  {pullRequest.is_draft ? 'draft' : pullRequest.pull_state_snapshot}
                                                </span>
                                                {(pullRequest.base_ref || pullRequest.head_ref) && (
                                                  <span className="text-[11px] font-bold text-gray-500 dark:text-text-secondary">
                                                    {pullRequest.head_ref || '?'} → {pullRequest.base_ref || '?'}
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : isGitHubPullRequestLoading ? (
                                        <div className="mt-1 flex items-center gap-2">
                                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 dark:border-border-subtle dark:border-t-blue-400" />
                                          <p className="text-xs font-bold text-gray-500 dark:text-text-secondary">PR 확인 중...</p>
                                        </div>
                                      ) : (
                                        <p className="mt-1 text-xs font-bold text-gray-500 dark:text-text-secondary">
                                          아직 연결된 PR이 없습니다.
                                        </p>
                                      )}
                                    </div>

                                    {!isReadOnly && linkedBranch && !hasActiveGitHubPullRequest && (
                                      <button
                                        type="button"
                                        onClick={handleOpenGitHubPullRequestCreator}
                                        disabled={isGitHubPullRequestLoading}
                                        className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-[11px] font-black text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900"
                                      >
                                        {isGitHubPullRequestLoading ? '준비 중...' : 'PR 생성'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {gitHubBranchError && (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                              {gitHubBranchError}
                            </div>
                          )}
                          {gitHubPullRequestError && !showGitHubPullRequestCreator && (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                              {gitHubPullRequestError}
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-[13px] font-bold text-gray-500 dark:text-text-secondary">
                          연결된 GitHub 이슈가 없습니다.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

          </div>
          )}

          {/* Description Section */}
          <ItemDescriptionSection
            ref={descriptionSectionRef}
            item={item}
            projectId={itemProjectId}
            allItems={allItems}
            isReadOnly={isReadOnly}
            editingEnabled={isDescriptionEditMode}
            entityContext={entityContext}
            onModeChange={(mode) => setIsDescriptionSplitView(isDescriptionEditMode && mode === 'split')}
            onEditingChange={setIsEditingDescription}
            onOpenDetail={onOpenDetail}
            onShowToast={onShowToast}
            onUpdateItem={onUpdateItem}
            onAddChildPage={canCreateProjectChildPage ? onAddChildPage : null}
            onAddProjectItem={isProjectLike ? onAddProjectItem : null}
            onShowPrompt={onShowPrompt}
            editorViewRef={editorViewRef}
            onEditorUpdate={handleEditorUpdate}
          />

          {/* Project Items List (Only for project page_type) */}
          {!isDescriptionEditMode && item.page_type === 'project' && phase?.items && phase.items.length > 0 && (
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
                       className="group flex items-center justify-between p-3 rounded-2xl border border-gray-100 dark:border-border-subtle hover:border-brand-200 dark:hover:border-brand-700/50 hover:shadow-md bg-white dark:bg-bg-elevated cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                     >
                       <div className="flex items-center gap-3 min-w-0">
                         <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${childItem.status === 'done' ? 'bg-emerald-500' : childItem.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                         <span className="text-sm font-bold text-gray-800 dark:text-text-primary truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
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
                         <ChevronRight size={14} className="text-gray-300 dark:text-text-tertiary group-hover:text-brand-500 transition-colors" />
                       </div>
                     </div>
                   );
                 })}
               </div>
            </div>
          )}


          {/* Comments Section - 메모일 때는 숨김 */}
          {!isMemo && !isDescriptionEditMode && (
            <div className="flex flex-col gap-10 pb-40">
              <div className="flex items-center gap-3 border-b border-gray-100 dark:border-border-subtle pb-4">
                <MessageSquare size={18} className="text-gray-400" />
                <h3 className="text-[13px] font-black text-gray-400 dark:text-text-tertiary uppercase tracking-[0.2em]">댓글</h3>
                {(item.comments || []).length > 0 && (
                  <span className="bg-gray-100 dark:bg-bg-hover px-2 py-0.5 rounded-md text-[11px] font-black text-gray-500 tabular-nums border border-gray-200 dark:border-border-subtle">
                    {(item.comments || []).length}
                  </span>
                )}
              </div>
              <CommentSection
                projectId={itemProjectId} itemId={item.id} comments={item.comments || []}
                onAddComment={onAddComment} onUpdateComment={onUpdateComment} onDeleteComment={onDeleteComment}
                onShowConfirm={onShowConfirm} onShowToast={onShowToast}
              />
            </div>
          )}
        </div>
      </div>
      {isDocRailOpen && !isDescriptionEditMode && (
        <aside className="hidden w-80 flex-shrink-0 border-l border-gray-200 bg-gray-50/70 dark:border-border-subtle dark:bg-bg-elevated/40 xl:flex xl:flex-col">
          <div className="border-b border-gray-200 px-3 py-3 dark:border-border-subtle">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400 dark:text-text-tertiary">
                  Document Rail
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-700 dark:text-text-secondary">
                  문서 탐색 보조 패널
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDocRailOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white hover:text-gray-900 dark:text-text-tertiary dark:hover:bg-bg-hover dark:hover:text-text-primary"
                title="문서 레일 닫기"
              >
                <X size={15} />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl border border-gray-200 bg-white p-1 dark:border-border-subtle dark:bg-bg-base">
              {[
                { id: 'outline', label: '목차', icon: List },
                { id: 'backlinks', label: '백링크', icon: Link2 },
                { id: 'mentions', label: '언급', icon: ClipboardList },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = docRailTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDocRailTab(tab.id)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-black uppercase tracking-[0.14em] transition-colors ${
                      isActive
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'text-gray-500 hover:bg-gray-50 dark:text-text-secondary dark:hover:bg-bg-hover'
                    }`}
                  >
                    <Icon size={12} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {docRailTab === 'outline' && (
              hasDescription ? (
                <DocumentOutline
                  markdown={item.description || ''}
                  onHeadingClick={handleHeadingClick}
                  currentOffset={currentEditorOffset}
                />
              ) : (
                <div className="p-4 text-center text-sm text-gray-400 dark:text-text-tertiary">
                  본문이 없어 목차를 만들 수 없습니다.
                </div>
              )
            )}
            {docRailTab === 'backlinks' && (
              <BacklinksPanel
                itemId={item.id}
                allItems={allItems}
                onOpenDetail={onOpenDetail}
              />
            )}
            {docRailTab === 'mentions' && (
              <div className="p-3">
                <div className="mb-3 px-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-text-tertiary">
                    링크되지 않은 언급
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-gray-400 dark:text-text-tertiary">
                    현재 문서 제목이 본문에 등장하지만 아직 위키링크로 연결되지 않은 항목입니다.
                  </p>
                </div>
                {mentionCandidates.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-white/70 px-4 py-5 text-center text-sm text-gray-400 dark:border-border-subtle dark:bg-bg-base dark:text-text-tertiary">
                    새로 연결할 만한 언급이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mentionCandidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => onOpenDetail?.(candidate.id)}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/40 dark:border-border-subtle dark:bg-bg-base dark:hover:border-brand-700/50 dark:hover:bg-brand-900/10"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-gray-800 dark:text-text-primary">
                            {candidate.title}
                          </span>
                          <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500 dark:bg-bg-hover dark:text-text-tertiary">
                            {candidate.pageType}
                          </span>
                        </div>
                        {candidate.snippet && (
                          <p className="mt-2 line-clamp-3 text-xs leading-5 text-gray-400 dark:text-text-tertiary">
                            {candidate.snippet}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      )}
      </div>
      {shareLinkModal}
      {showGitHubIssueCreator && !isMemo && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
          onMouseDown={() => {
            if (!isGitHubSubmitting) {
              setShowGitHubIssueCreator(false);
              setGitHubError('');
            }
          }}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-border-subtle dark:bg-bg-elevated"
            onMouseDown={stopProp}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-gray-400 dark:text-text-tertiary">
                  <Github size={16} strokeWidth={2.5} />
                  GitHub
                </div>
                <h2 className="mt-2 text-xl font-black text-gray-950 dark:text-text-primary">이슈 생성하기</h2>
                <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-text-secondary">
                  레포지토리를 선택하면 이 아이템 기준으로 GitHub 이슈를 만듭니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isGitHubSubmitting) {
                    setShowGitHubIssueCreator(false);
                    setGitHubError('');
                  }
                }}
                disabled={isGitHubSubmitting}
                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-text-tertiary dark:hover:bg-bg-hover dark:hover:text-text-primary"
                aria-label="GitHub 이슈 생성 닫기"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-4">
              {isGitHubLoading ? (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-500 dark:border-border-subtle dark:bg-bg-base dark:text-text-secondary">
                  GitHub 정보를 불러오는 중...
                </div>
              ) : githubStatus?.connected ? (
                <>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-border-subtle dark:bg-bg-base">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-gray-800 dark:text-text-primary">
                        Connected as @{githubStatus.githubLogin}
                      </p>
                      <p className="mt-1 text-xs font-bold text-gray-500 dark:text-text-secondary">
                        {ticketKey ? `현재 티켓: ${ticketKey}` : '티켓이 없으면 이슈 생성 시 자동 발급됩니다.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onManageGitHubSettings}
                      className="shrink-0 rounded-xl border border-gray-200 px-3 py-2 text-[11px] font-black text-gray-600 transition-colors hover:border-gray-400 dark:border-border-subtle dark:text-text-secondary dark:hover:border-border-strong"
                    >
                      프로필 관리
                    </button>
                  </div>

                  {needsGitHubAppInstall && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                      GitHub App이 아직 설치되지 않아 이슈를 생성할 수 없습니다. 프로필에서 App 설치를 먼저 진행해주세요.
                    </div>
                  )}

                  {hasExistingGitHubIssue && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                      이 아이템에는 이미 GitHub 이슈가 연결되어 있어서 추가 생성할 수 없습니다.
                    </div>
                  )}

                  {githubIssues.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-text-tertiary">연결된 이슈</p>
                      {githubIssues.map((issue) => (
                        <a
                          key={issue.id || `${issue.repo_full_name}-${issue.issue_number}`}
                          href={issue.issue_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 px-4 py-3 text-sm text-gray-700 transition-colors hover:border-brand-200 dark:border-border-subtle dark:text-text-secondary dark:hover:border-brand-600"
                        >
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="truncate font-black">
                              {issue.repo_full_name}#{issue.issue_number}
                            </span>
                            {(issue.ticket_key || ticketKey) && (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:bg-bg-base dark:text-text-secondary">
                                {issue.ticket_key || ticketKey}
                              </span>
                            )}
                          </div>
                          <ExternalLink size={14} className="shrink-0 text-gray-400 dark:text-text-tertiary" />
                        </a>
                      ))}
                    </div>
                  )}

                  {!hasExistingGitHubIssue && !needsGitHubAppInstall && (
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-text-tertiary">
                        생성할 레포지토리
                      </label>
                      <select
                        value={selectedGitHubRepo}
                        onChange={(e) => setSelectedGitHubRepo(e.target.value)}
                        disabled={isGitHubRepoLoading}
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-black text-gray-800 dark:border-border-subtle dark:bg-bg-base dark:text-text-primary dark:color-scheme-dark"
                      >
                        {isGitHubRepoLoading ? (
                          <option value="">레포지토리 불러오는 중...</option>
                        ) : githubRepos.length === 0 ? (
                          <option value="">접근 가능한 레포가 없습니다</option>
                        ) : (
                          githubRepos.map((repo) => (
                            <option key={repo.id} value={repo.full_name}>
                              {repo.full_name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}

                  {gitHubError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                      {gitHubError}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowGitHubIssueCreator(false);
                        setGitHubError('');
                      }}
                      disabled={isGitHubSubmitting}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-subtle dark:text-text-secondary dark:hover:bg-bg-hover"
                    >
                      닫기
                    </button>
                    {!hasExistingGitHubIssue && !needsGitHubAppInstall && (
                      <button
                        type="button"
                        onClick={handleCreateGitHubIssue}
                        disabled={!selectedGitHubRepo || isGitHubSubmitting}
                        className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900"
                      >
                        {isGitHubSubmitting ? '티켓 발급 후 생성 중...' : '이슈 생성'}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-500 dark:border-border-subtle dark:bg-bg-base dark:text-text-secondary">
                    GitHub 계정을 연결해야 이슈를 생성할 수 있습니다.
                  </div>
                  {gitHubError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                      {gitHubError}
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowGitHubIssueCreator(false);
                        setGitHubError('');
                      }}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-600 transition-colors hover:bg-gray-50 dark:border-border-subtle dark:text-text-secondary dark:hover:bg-bg-hover"
                    >
                      닫기
                    </button>
                    <button
                      type="button"
                      onClick={onManageGitHubSettings}
                      className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900"
                    >
                      프로필에서 연결
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {showGitHubPullRequestCreator && !isMemo && gitHubPullRequestDraft && (
        <div
          className="fixed inset-0 z-[121] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
          onMouseDown={() => {
            if (!isGitHubPullRequestSubmitting) {
              setShowGitHubPullRequestCreator(false);
              setGitHubPullRequestError('');
            }
          }}
        >
          <div
            className="w-full max-w-3xl rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-border-subtle dark:bg-bg-elevated"
            onMouseDown={stopProp}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-gray-400 dark:text-text-tertiary">
                  <Github size={16} strokeWidth={2.5} />
                  GitHub
                </div>
                <h2 className="mt-2 text-xl font-black text-gray-950 dark:text-text-primary">PR 생성하기</h2>
                <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-text-secondary">
                  템플릿 초안을 확인하고 제목/본문/draft 여부를 수정한 뒤 PR을 생성합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isGitHubPullRequestSubmitting) {
                    setShowGitHubPullRequestCreator(false);
                    setGitHubPullRequestError('');
                  }
                }}
                disabled={isGitHubPullRequestSubmitting}
                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-text-tertiary dark:hover:bg-bg-hover dark:hover:text-text-primary"
                aria-label="GitHub PR 생성 닫기"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-border-subtle dark:bg-bg-base">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-text-tertiary">Repository</p>
                <p className="mt-1 text-sm font-black text-gray-800 dark:text-text-primary">{gitHubPullRequestDraft.repoFullName}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-border-subtle dark:bg-bg-base">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-text-tertiary">Issue</p>
                <a
                  href={gitHubPullRequestDraft.issueUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm font-black text-gray-800 hover:text-brand-600 dark:text-text-primary dark:hover:text-brand-400"
                >
                  #{gitHubPullRequestDraft.issueNumber}
                  <ExternalLink size={12} />
                </a>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-border-subtle dark:bg-bg-base">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-text-tertiary">Head branch</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-black text-gray-800 dark:text-text-primary">{gitHubPullRequestDraft.branchName}</span>
                  {gitHubPullRequestDraft.branchUrl && (
                    <a
                      href={gitHubPullRequestDraft.branchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-black text-gray-500 hover:text-brand-600 dark:text-text-secondary dark:hover:text-brand-400"
                    >
                      브랜치 보기
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
              <label className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-border-subtle dark:bg-bg-base">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-text-tertiary">Base branch</span>
                <input
                  type="text"
                  value={gitHubPullRequestDraft.base}
                  onChange={(e) => setGitHubPullRequestDraft((current) => ({ ...current, base: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-black text-gray-800 outline-none focus:border-brand-400 dark:border-border-subtle dark:bg-bg-hover dark:text-text-primary"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-text-tertiary">PR 제목</span>
                <input
                  type="text"
                  value={gitHubPullRequestDraft.title}
                  onChange={(e) => setGitHubPullRequestDraft((current) => ({ ...current, title: e.target.value }))}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-black text-gray-800 outline-none focus:border-brand-400 dark:border-border-subtle dark:bg-bg-base dark:text-text-primary"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-text-tertiary">PR 본문</span>
                <textarea
                  value={gitHubPullRequestDraft.body}
                  onChange={(e) => setGitHubPullRequestDraft((current) => ({ ...current, body: e.target.value }))}
                  rows={18}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-brand-400 dark:border-border-subtle dark:bg-bg-base dark:text-text-primary"
                />
              </label>

              <label className="inline-flex items-center gap-3 text-sm font-black text-gray-700 dark:text-text-secondary">
                <input
                  type="checkbox"
                  checked={Boolean(gitHubPullRequestDraft.draft)}
                  onChange={(e) => setGitHubPullRequestDraft((current) => ({ ...current, draft: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400 dark:border-border-subtle dark:bg-bg-base"
                />
                Draft PR로 생성
              </label>
            </div>

            {gitHubPullRequestError && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {gitHubPullRequestError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowGitHubPullRequestCreator(false);
                  setGitHubPullRequestError('');
                }}
                disabled={isGitHubPullRequestSubmitting}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-subtle dark:text-text-secondary dark:hover:bg-bg-hover"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleCreateGitHubPullRequest}
                disabled={isGitHubPullRequestSubmitting || !gitHubPullRequestDraft.title.trim() || !gitHubPullRequestDraft.base.trim()}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900"
              >
                {isGitHubPullRequestSubmitting ? 'PR 생성 중...' : (gitHubPullRequestDraft.draft ? 'Draft PR 생성' : 'PR 생성')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ItemDetailPanel;
