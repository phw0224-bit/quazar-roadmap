/**
 * @fileoverview 칸반 앱 최상위 오케스트레이터. board/timeline/people 뷰 전환 + DnD 컨텍스트.
 *
 * 담당:
 * - @dnd-kit DnD 컨텍스트 (sections, projects, items 세 레벨 드래그)
 * - Toast/Confirm/Prompt 전역 피드백 상태 관리 + 콜백 전달
 * - ItemDetailPanel 열림/닫힘 + 리사이즈 (panelWidth 20~80%)
 * - URL 상태 ↔ 필터/뷰 동기화
 * - Ctrl+K 검색 단축키 리스너
 *
 * DnD 타입 판별: activeId prefix ('section-', phase vs item)
 * localStorage: expandedSections Set, isMainBoardCollapsed boolean
 */
import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useTheme } from 'next-themes';
import { CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react';
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
import { usePresence } from '../hooks/usePresence';
import { useNewItems } from '../hooks/useNewItems';
import { PresenceContext } from '../hooks/usePresenceContext';
import PresenceAvatars from './PresenceAvatars';
import NotificationsInbox from './NotificationsInbox';
import { useLayoutState } from '../hooks/useLayoutState.js';
import API from '../api/kanbanAPI';
import { supabase } from '../lib/supabase';
import {
  getGitHubStatus,
  startGitHubAppInstall,
  startGitHubConnect,
} from '../api/githubAPI';
import ProfileSettingsModal from './ProfileSettingsModal';
import ProjectColumn from './ProjectColumn';
import KanbanCard from './KanbanCard';
import BoardSection from './BoardSection';
import GeneralDocumentSection from './GeneralDocumentSection';
import RequestBoardSection from './RequestBoardSection';
import { TEAMS, GLOBAL_TAGS } from '../lib/constants';
import { buildEntityContext, ENTITY_TYPES } from '../lib/entityModel';
import FilterBar from './FilterBar';
import AppLayout from './AppLayout';
import { useFilterState, applyFilterSort } from '../hooks/useFilterState';
import { DEFAULT_PROFILE_CUSTOMIZATION, normalizeProfileCustomization } from '../lib/profileAppearance';
import {
  MAIN_BOARD_TYPE,
  TEAM_OVERVIEW_BOARD_TYPE,
  getBoardSectionLabel,
  getDefaultBoardType,
  normalizeBoardType,
  TEAM_BOARD_TYPES,
  resolveBoardTypeForBoardView,
} from '../lib/boardNavigation.js';
import { createDevRequestDescriptionScaffold } from '../lib/devRequestBoard.js';

import { Toast, ConfirmModal, InputModal } from './UI/Feedback';

const DISPLAY_BOARDS = ['main', ...TEAM_BOARD_TYPES];
const isLegacyRequestDoc = (doc) => doc?.entity_type === 'request' || (Array.isArray(doc?.tags) && doc.tags.includes('request'));
const ItemDetailPanel = lazy(() => import('./ItemDetailPanel'));
const PeopleBoard = lazy(() => import('./PeopleBoard'));
const TimelineView = lazy(() => import('./TimelineView'));
const SearchModal = lazy(() => import('./SearchModal'));
const PersonalMemoBoard = lazy(() => import('./PersonalMemoBoard'));
const RepositoriesDashboard = lazy(() => import('./RepositoriesDashboard'));

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

export default function KanbanBoard({ onShowReleaseNotes }) {
  const { isOpen, sidebarWidth, collapsedWidth } = useLayoutState();
  const {
    projects, sections, loading, addProject, addItem, updateItem, deleteItem,
    moveItem, updateProject, deleteProject, completeProject, moveProject, addComment, updateComment, deleteComment,
    addSection, updateSection, deleteSection, moveSection,
    addChildPage,
    moveSidebarItem,
    moveSidebarProject,
    // 신규: 일반 문서
    generalDocs, addGeneralDocument, updateGeneralDocument, deleteGeneralDocument, setBoardType, currentBoardType,
    requestDocs, addRequestDocument, updateRequestDocument, submitRequestDocument, deleteRequestDocument,
    // 신규: 팀 보드 설정
    team_boards, updateTeamBoard,
  } = useKanbanData();

  const { user, logout } = useAuth();
  const [urlState, setUrlState, replaceUrlState] = useUrlState();
  const activeView = urlState.view;
  const detailItemId = urlState.itemId;
  const selectedRepoFullName = urlState.repoFullName;
  const isReadOnly = !user;
  const [profileCustomization, setProfileCustomization] = useState(DEFAULT_PROFILE_CUSTOMIZATION);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalSeed, setProfileModalSeed] = useState(0);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [gitHubStatus, setGitHubStatus] = useState({ connected: false });
  const [isGitHubStatusLoading, setIsGitHubStatusLoading] = useState(false);
  const [isGitHubConnecting, setIsGitHubConnecting] = useState(false);
  const [isGitHubAppInstalling, setIsGitHubAppInstalling] = useState(false);
  const { onlineUsers, updateEditing } = usePresence({
    user,
    itemId: detailItemId,
    isReadOnly,
    customization: profileCustomization,
  });
  const isDetailFullscreen = urlState.fullscreen;
  const [peopleTeams, setPeopleTeams] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [peopleError, setPeopleError] = useState(null);
  const [personalMemos, setPersonalMemos] = useState([]);
  const [personalMemosLoading, setPersonalMemosLoading] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNewPanelMap, setShowNewPanelMap] = useState({}); // {boardName: boolean}
  const defaultBoardType = getDefaultBoardType(user);
  const selectedTeamBoardType = resolveBoardTypeForBoardView(urlState.boardType, defaultBoardType);
  const visibleBoardType = activeView === 'roadmap' ? MAIN_BOARD_TYPE : selectedTeamBoardType;
  const visibleBoardLabel = getBoardSectionLabel(visibleBoardType);
  const visibleBoardTypes = activeView === 'board' && visibleBoardType === TEAM_OVERVIEW_BOARD_TYPE
    ? TEAM_BOARD_TYPES
    : [visibleBoardType];

  // 모든 보드의 새 아이템 훅 호출 (Rules of Hooks 준수)
  const mainNewItems = useNewItems(projects, 'main', isReadOnly);
  const devTeamNewItems = useNewItems(projects, '개발팀', isReadOnly);
  const aiTeamNewItems = useNewItems(projects, 'AI팀', isReadOnly);
  const supportTeamNewItems = useNewItems(projects, '지원팀', isReadOnly);

  const newItemsMap = useMemo(() => ({
    main: mainNewItems,
    '개발팀': devTeamNewItems,
    'AI팀': aiTeamNewItems,
    '지원팀': supportTeamNewItems,
  }), [mainNewItems, devTeamNewItems, aiTeamNewItems, supportTeamNewItems]);

  useEffect(() => {
    if (loading) return;

    const nextBoardType = selectedTeamBoardType;

    if (normalizeBoardType(urlState.boardType) !== nextBoardType) {
      replaceUrlState({ boardType: nextBoardType });
    }
    setBoardType(nextBoardType);
  }, [activeView, loading, replaceUrlState, selectedTeamBoardType, setBoardType, urlState.boardType]);

  useEffect(() => setMounted(true), []);

  // Ctrl+K / Cmd+K 전체 검색 단축키
  useEffect(() => {
    if (!user?.id) {
      setProfileCustomization(DEFAULT_PROFILE_CUSTOMIZATION);
      return;
    }
    let mounted = true;
    const fetchProfileCustomization = async () => {
      try {
        const profileBundle = await API.getCurrentProfileBundle();
        if (!mounted) return;
        setProfileCustomization(normalizeProfileCustomization(profileBundle?.customization));
      } catch (error) {
        console.warn('프로필 꾸미기 데이터 로드 실패:', error.message);
        if (mounted) setProfileCustomization(DEFAULT_PROFILE_CUSTOMIZATION);
      }
    };
    fetchProfileCustomization();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setGitHubStatus({ connected: false });
      setIsGitHubStatusLoading(false);
      return;
    }

    let active = true;
    const loadGitHubStatus = async () => {
      setIsGitHubStatusLoading(true);
      try {
        const status = await getGitHubStatus();
        if (!active) return;
        setGitHubStatus(status || { connected: false });
      } catch (error) {
        if (!active) return;
        setGitHubStatus({ connected: false });
        console.warn('GitHub 연결 상태 로드 실패:', error.message);
      } finally {
        if (active) setIsGitHubStatusLoading(false);
      }
    };

    loadGitHubStatus();
    return () => {
      active = false;
    };
  }, [user?.id]);

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

  // 새 아이템 패널 외부 클릭 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-new-panel]')) {
        setShowNewPanelMap({});
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveProfileCustomization = async (nextCustomization) => {
    try {
      setIsSavingProfile(true);
      const saved = await API.updateCurrentProfileCustomization(nextCustomization);
      const normalized = normalizeProfileCustomization(saved);
      setProfileCustomization(normalized);
      setIsProfileModalOpen(false);
      showToast('프로필이 업데이트되었습니다.');
    } catch (error) {
      showToast(`프로필 저장 실패: ${error.message}`, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleOpenProfileModal = () => {
    setProfileModalSeed((prev) => prev + 1);
    setIsProfileModalOpen(true);
  };

  const handleSetBoardType = (boardType, options = {}) => {
    const normalized = normalizeBoardType(boardType);
    setBoardType(normalized);

    if (options.syncUrl === false) return;
    if (normalizeBoardType(urlState.boardType) === normalized) return;
    replaceUrlState({ boardType: normalized });
  };

  const handleConnectGitHub = async () => {
    try {
      setIsGitHubConnecting(true);
      await startGitHubConnect();
    } catch (error) {
      showToast(error.message || 'GitHub 연결을 시작하지 못했습니다.', 'error');
      setIsGitHubConnecting(false);
    }
  };

  const handleInstallGitHubApp = async () => {
    try {
      setIsGitHubAppInstalling(true);
      await startGitHubAppInstall();
    } catch (error) {
      showToast(error.message || 'GitHub App 설치를 시작하지 못했습니다.', 'error');
      setIsGitHubAppInstalling(false);
    }
  };

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

  // 개인 메모 로드
  useEffect(() => {
    if (!user?.id) {
      setPersonalMemos([]);
      setPersonalMemosLoading(false);
      return;
    }

    let isMounted = true;
    const fetchPersonalMemos = async () => {
      setPersonalMemosLoading(true);
      try {
        const memos = await API.getPersonalMemos?.(user.id) || [];
        if (isMounted) setPersonalMemos(memos);
      } catch (err) {
        console.warn('개인 메모 로드 실패:', err.message);
        if (isMounted) setPersonalMemos([]);
      } finally {
        if (isMounted) setPersonalMemosLoading(false);
      }
    };

    const memoChannel = supabase.channel(`personal-memos-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'personal_memos', filter: `owner_id=eq.${user.id}` },
        () => fetchPersonalMemos()
      )
      .subscribe();

    fetchPersonalMemos();
    return () => {
      isMounted = false;
      supabase.removeChannel(memoChannel);
    };
  }, [user?.id]);

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
  const [groupedCompletedBoards, setGroupedCompletedBoards] = useState(() => {
    try {
      const saved = localStorage.getItem('kanban-completed-grouped');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [expandedCompletedPhases, setExpandedCompletedPhases] = useState(new Set());

  // 일반 문서 섹션 열림/닫힘 (board별)
  const [expandedGeneralDocBoards, setExpandedGeneralDocBoards] = useState(() => {
    try {
      const saved = localStorage.getItem('kanban-general-docs-expanded');
      return saved ? new Set(JSON.parse(saved)) : new Set(DISPLAY_BOARDS);
    } catch {
      return new Set(DISPLAY_BOARDS);
    }
  });

  const [panelWidth, setPanelWidth] = useState(50); // percentage width
  const [isResizing, setIsResizing] = useState(false);
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
  const [selectFolder, setSelectFolder] = useState(null); // { itemId, itemTitle, folders, onSelect }

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const showConfirm = useCallback((title, message, onConfirm, type = 'danger') => {
    setConfirm({ title, message, onConfirm, type });
  }, []);

  const showPrompt = useCallback((title, placeholder, onConfirm) => {
    setPrompt({ title, placeholder, onConfirm });
  }, []);

  const pendingMutationKeysRef = useRef(new Set());
  const [pendingMutationKeys, setPendingMutationKeys] = useState(new Set());

  const runExclusiveMutation = useCallback(async (key, action, options = {}) => {
    if (pendingMutationKeysRef.current.has(key)) {
      showToast(options.pendingMessage || '이미 처리 중입니다. 잠시만 기다려주세요.', 'error');
      return null;
    }

    pendingMutationKeysRef.current.add(key);
    setPendingMutationKeys(new Set(pendingMutationKeysRef.current));

    try {
      const result = await action();
      if (options.successMessage) {
        showToast(typeof options.successMessage === 'function' ? options.successMessage(result) : options.successMessage);
      }
      return result;
    } catch (error) {
      showToast(`${options.errorPrefix || '처리 실패'}: ${error.message}`, 'error');
      return null;
    } finally {
      pendingMutationKeysRef.current.delete(key);
      setPendingMutationKeys(new Set(pendingMutationKeysRef.current));
    }
  }, [showToast]);

  const guardedAddSection = useCallback(async (boardType, title) => {
    const cleanTitle = `${title || ''}`.trim();
    if (!cleanTitle) return null;
    return runExclusiveMutation(
      `section:create:${boardType}:${cleanTitle.toLowerCase()}`,
      () => addSection(boardType, cleanTitle),
      { successMessage: `'${cleanTitle}' 섹션이 생성되었습니다.`, errorPrefix: '섹션 생성 실패' },
    );
  }, [addSection, runExclusiveMutation]);

  const guardedAddProject = useCallback(async (title, boardType = 'main', sectionId = null) => {
    const cleanTitle = `${title || ''}`.trim();
    if (!cleanTitle) return null;
    return runExclusiveMutation(
      `project:create:${boardType}:${sectionId || 'root'}:${cleanTitle.toLowerCase()}`,
      () => addProject(cleanTitle, boardType, sectionId),
      { successMessage: `'${cleanTitle}' 프로젝트가 생성되었습니다.`, errorPrefix: '프로젝트 생성 실패' },
    );
  }, [addProject, runExclusiveMutation]);

  const guardedAddItem = useCallback(async (projectId, title, content = '', createdBy = null) => {
    const cleanTitle = `${title || ''}`.trim();
    if (!cleanTitle) return null;
    return runExclusiveMutation(
      `item:create:${projectId}:${cleanTitle.toLowerCase()}`,
      () => addItem(projectId, cleanTitle, content, createdBy),
      { successMessage: `'${cleanTitle}' 업무가 추가되었습니다.`, errorPrefix: '업무 생성 실패' },
    );
  }, [addItem, runExclusiveMutation]);

  const guardedUpdateItem = useCallback(async (projectId, itemId, updates) => runExclusiveMutation(
    `item:update:${itemId}`,
    () => updateItem(projectId, itemId, updates),
    { errorPrefix: '아이템 저장 실패' },
  ), [runExclusiveMutation, updateItem]);

  const guardedDeleteItem = useCallback(async (projectId, itemId) => runExclusiveMutation(
    `item:delete:${itemId}`,
    () => deleteItem(projectId, itemId),
    { successMessage: '삭제되었습니다.', errorPrefix: '삭제 실패' },
  ), [deleteItem, runExclusiveMutation]);

  const guardedUpdateProject = useCallback(async (projectId, updates) => runExclusiveMutation(
    `project:update:${projectId}`,
    () => updateProject(projectId, updates),
    { errorPrefix: '프로젝트 저장 실패' },
  ), [runExclusiveMutation, updateProject]);

  const guardedDeleteProject = useCallback(async (projectId) => runExclusiveMutation(
    `project:delete:${projectId}`,
    () => deleteProject(projectId),
    { successMessage: '프로젝트가 삭제되었습니다.', errorPrefix: '프로젝트 삭제 실패' },
  ), [deleteProject, runExclusiveMutation]);

  const guardedCompleteProject = useCallback(async (projectId, isCompleted) => runExclusiveMutation(
    `project:complete:${projectId}`,
    () => completeProject(projectId, isCompleted),
    { errorPrefix: '프로젝트 상태 변경 실패' },
  ), [completeProject, runExclusiveMutation]);

  const guardedAddGeneralDocument = useCallback(async (boardType, title, type = 'document', parentFolderId = null, createdBy = null) => {
    const cleanTitle = `${title || ''}`.trim();
    if (!cleanTitle) return null;
    const entityLabel = type === 'folder' ? '폴더' : '문서';
    return runExclusiveMutation(
      `document:create:${boardType}:${parentFolderId || 'root'}:${type}:${cleanTitle.toLowerCase()}`,
      () => addGeneralDocument(boardType, cleanTitle, type, parentFolderId, createdBy),
      { successMessage: `'${cleanTitle}' ${entityLabel}가 생성되었습니다.`, errorPrefix: `${entityLabel} 생성 실패` },
    );
  }, [addGeneralDocument, runExclusiveMutation]);

  const guardedDeleteGeneralDocument = useCallback(async (itemId) => runExclusiveMutation(
    `document:delete:${itemId}`,
    () => deleteGeneralDocument(itemId),
    { successMessage: '삭제되었습니다.', errorPrefix: '삭제 실패' },
  ), [deleteGeneralDocument, runExclusiveMutation]);

  const guardedUpdateGeneralDocument = useCallback(async (itemId, updates) => runExclusiveMutation(
    `document:update:${itemId}`,
    () => updateGeneralDocument(itemId, updates),
    { errorPrefix: '문서 저장 실패' },
  ), [runExclusiveMutation, updateGeneralDocument]);

  const guardedAddRequestDocument = useCallback(async (boardType, title, createdBy = null, updates = {}) => {
    const cleanTitle = `${title || ''}`.trim();
    if (!cleanTitle) return null;
    return runExclusiveMutation(
      `request:create:${boardType}:${cleanTitle.toLowerCase()}`,
      () => addRequestDocument(boardType, cleanTitle, createdBy, updates),
      { errorPrefix: '요청 문서 생성 실패' },
    );
  }, [addRequestDocument, runExclusiveMutation]);

  const guardedDeleteRequestDocument = useCallback(async (requestId) => runExclusiveMutation(
    `request:delete:${requestId}`,
    () => deleteRequestDocument(requestId),
    { successMessage: '삭제되었습니다.', errorPrefix: '삭제 실패' },
  ), [deleteRequestDocument, runExclusiveMutation]);

  const guardedUpdateRequestDocument = useCallback(async (requestId, updates) => runExclusiveMutation(
    `request:update:${requestId}`,
    () => updateRequestDocument(requestId, updates),
    { errorPrefix: '요청 문서 저장 실패' },
  ), [runExclusiveMutation, updateRequestDocument]);

  const guardedSubmitRequestDocument = useCallback(async (requestId) => runExclusiveMutation(
    `request:submit:${requestId}`,
    () => submitRequestDocument(requestId),
    { errorPrefix: '요청 전송 실패' },
  ), [runExclusiveMutation, submitRequestDocument]);

  const handlePromptConfirm = useCallback(async (value) => {
    if (!prompt) return;
    try {
      await prompt.onConfirm(value);
      setPrompt(null);
    } catch (error) {
      showToast(error.message || '처리 중 오류가 발생했습니다.', 'error');
    }
  }, [prompt, showToast]);

  const handleConfirmAccept = useCallback(async () => {
    if (!confirm) return;
    try {
      await confirm.onConfirm(true);
      setConfirm(null);
    } catch (error) {
      showToast(error.message || '처리 중 오류가 발생했습니다.', 'error');
    }
  }, [confirm, showToast]);

  const sensors = useSensors(
    useSensor(PointerSensor, { distance: 8 }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 필터/정렬 적용된 projects 파생
  const filteredProjects = useMemo(() => {
    return projects.map(project => ({
      ...project,
      items: applyFilterSort(
        (project.items || []).filter(item => !item.page_type || item.page_type === 'task'),
        filters, sort
      ),
    }));
  }, [projects, filters, sort]);

  const projectItems = useMemo(
    () => projects.flatMap(project => project.items || []),
    [projects],
  );
  const relationCandidateItems = useMemo(() => {
    const teamProjectItems = projects
      .filter(project => (project.board_type || 'main') !== MAIN_BOARD_TYPE)
      .flatMap(project => (project.items || []).map(item => ({
        ...item,
        _boardType: project.board_type || '팀',
        _subGroup: project.title,
      })));
    const teamGeneralDocs = generalDocs
      .filter(doc => (doc.board_type || 'main') !== MAIN_BOARD_TYPE)
      .map(doc => ({
        ...doc,
        _boardType: doc.board_type || '팀',
        _subGroup: '일반 문서',
      }));
    const mappedRequestDocs = requestDocs.map(r => ({
      ...r,
      _isRequest: true,
      teams: [r.board_type || '개발팀'],
      related_items: r.related_items || [],
      _boardType: r.board_type || '개발팀',
      _subGroup: '요청',
    }));
    const memoItems = personalMemos.map(m => ({
      ...m,
      _boardType: '개인',
      _subGroup: '메모',
    }));
    return user
      ? [...teamProjectItems, ...teamGeneralDocs, ...memoItems, ...mappedRequestDocs]
      : [...teamProjectItems, ...teamGeneralDocs, ...mappedRequestDocs];
  }, [generalDocs, personalMemos, projects, requestDocs, user]);

  const allNonMainProjectItems = useMemo(
    () => projects
      .filter(p => (p.board_type || MAIN_BOARD_TYPE) !== MAIN_BOARD_TYPE)
      .flatMap(p => p.items || []),
    [projects],
  );

  const searchableAdditionalItems = useMemo(() => {
    const items = generalDocs.filter(doc => (doc.board_type || MAIN_BOARD_TYPE) !== MAIN_BOARD_TYPE);
    if (user) {
      items.push(...personalMemos);
    }
    return items;
  }, [generalDocs, personalMemos, user]);

  const findContainer = (id) => {
    if (projects.find((p) => p.id === id)) return id;
    const project = projects.find((p) => p.items.some((i) => i.id === id));
    return project ? project.id : null;
  };

  const handleDragStart = (event) => {
    if (!user) return;
    setActiveId(event.active.id);
  };

  /**
   * @description DnD 드롭 완료 시 타입(section/project/item) 판별 후 해당 이동 메서드 호출.
   * project 이동 시 다른 section 위에 드롭하면 updateProject로 section_id도 변경.
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

    // Project 이동 (가로 이동)
    if (active.data.current?.type === 'Project') {
      const overIsSection = sections.some(s => s.id === overId);

      if (overIsSection) {
        // 섹션 헤더/바디 위에 직접 드롭 → section_id 변경
        const activeProject = projects.find(p => p.id === activeId);
        if (activeProject?.section_id !== overId) {
          await updateProject(activeId, { section_id: overId });
        }
        return;
      }

      if (activeId !== overId) {
        const overProject = projects.find(p => p.id === overId);
        const activeProject = projects.find(p => p.id === activeId);

        if (overProject && overProject.section_id !== activeProject?.section_id) {
          await updateProject(activeId, { section_id: overProject.section_id });
          return;
        }

        const newIndex = projects.findIndex((p) => p.id === overId);
        if (newIndex !== -1) await moveProject(activeId, newIndex);
      }
      return;
    }

    // Item 이동 (세로/교차 이동)
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer) return;

    if (activeId !== overId || activeContainer !== overContainer) {
      const overProject = projects.find(p => p.id === overContainer);
      const overItems = overProject.items;
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
    localStorage.setItem('kanban-completed-grouped', JSON.stringify([...groupedCompletedBoards]));
  }, [groupedCompletedBoards]);

  useEffect(() => {
    localStorage.setItem('kanban-general-docs-expanded', JSON.stringify([...expandedGeneralDocBoards]));
  }, [expandedGeneralDocBoards]);

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
  
  const activeItem = projectItems.find(i => i.id === activeId);
  const activeProject = projects.find(p => p.id === activeId);
  const activeSection = sections.find(s => s.id === activeId);

  const getProjectDetailItem = (project) => ({
    id: project.id,
    title: project.title,
    description: project.description || '',
    status: 'none',
    page_type: 'project',
    assignees: project.assignees || [],
    teams: [],
    tags: [],
    related_items: [],
    creator_profile: null,
  });

  const getRequestDetailItem = (request) => ({
    ...request,
    id: request.id,
    title: request.title,
    description: request.description || '',
    status: request.status || '접수됨',
    priority: request.priority || '중간',
    page_type: null,
    entity_type: 'request',
    board_type: request.board_type || '개발팀',
    assignees: [],
    assignee_user_ids: [],
    teams: request.request_team ? [request.request_team] : [],
    related_items: [],
    comments: [],
    creator_profile: null,
  });

  let detailItem = detailItemId ? projectItems.find(i => i.id === detailItemId) : null;
  let detailProject = detailItem ? projects.find(p => p.items.some(i => i.id === detailItemId)) : null;

  if (!detailItem && detailItemId) {
    const generalDoc = generalDocs.find(doc => doc.id === detailItemId);
    if (generalDoc) {
      detailItem = generalDoc;
      detailProject = {
        id: 'general-docs',
        title: '일반 문서',
        board_type: generalDoc.board_type || 'main',
      };
    }
  }

  if (!detailItem && detailItemId) {
    const personalMemo = personalMemos.find(memo => memo.id === detailItemId);
    if (personalMemo) {
      detailItem = personalMemo;
      detailProject = {
        id: 'personal-memo',
        title: '개인 메모장',
        board_type: 'personal',
      };
    }
  }

  let detailRequestReverseLinks = null;
  if (!detailItem && detailItemId) {
    const requestDoc = requestDocs.find(doc => doc.id === detailItemId);
    if (requestDoc) {
      detailItem = getRequestDetailItem(requestDoc);
      detailProject = {
        id: 'request-docs',
        title: '요청',
        board_type: '개발팀',
      };
      detailRequestReverseLinks = projectItems.filter(
        item => Array.isArray(item.related_items) && item.related_items.includes(requestDoc.id)
      );
    }
  }

  if (!detailItem && detailItemId) {
    const project = projects.find(p => p.id === detailItemId);
    if (project) {
      detailItem = getProjectDetailItem(project);
      detailProject = project;
    }
  }

  const detailEntityContext = detailItem
    ? buildEntityContext({ item: detailItem, project: detailProject })
    : null;

  const handleOpenDetail = (entityOrId) => {
    const itemId = typeof entityOrId === 'object' && entityOrId !== null ? entityOrId.id : entityOrId;
    if (!itemId) return;
    setUrlState({ itemId, fullscreen: true });
  };

  const handleUpdateItem = async (projectId, itemId, updates) => {
    if (detailEntityContext?.type === ENTITY_TYPES.PROJECT) {
      await guardedUpdateProject(itemId, updates);
      return;
    }
    if (detailEntityContext?.type === ENTITY_TYPES.MEMO) {
      await updatePersonalMemo(itemId, updates);
      return;
    }
    if (detailEntityContext?.collection === 'general') {
      await guardedUpdateGeneralDocument(itemId, updates);
      return;
    }
    if (detailEntityContext?.type === ENTITY_TYPES.REQUEST) {
      const nextUpdates = { ...updates };
      if (Object.prototype.hasOwnProperty.call(nextUpdates, 'teams')) {
        const nextTeams = Array.isArray(nextUpdates.teams) ? nextUpdates.teams : [];
        nextUpdates.request_team = nextTeams[0] || null;
        delete nextUpdates.teams;
      }
      delete nextUpdates.assignees;
      delete nextUpdates.assignee_user_ids;
      delete nextUpdates.related_items;
      delete nextUpdates.tags;
      delete nextUpdates.start_date;
      delete nextUpdates.end_date;
      await guardedUpdateRequestDocument(itemId, nextUpdates);
      return;
    }
    await guardedUpdateItem(projectId, itemId, updates);
  };

  const handleDeleteItem = async (projectId, itemId) => {
    if (detailEntityContext?.type === ENTITY_TYPES.MEMO) {
      await deletePersonalMemo(itemId);
      return;
    }
    if (detailEntityContext?.collection === 'general') {
      await guardedDeleteGeneralDocument(itemId);
      return;
    }
    if (detailEntityContext?.type === ENTITY_TYPES.REQUEST) {
      await guardedDeleteRequestDocument(itemId);
      return;
    }
    await guardedDeleteItem(projectId, itemId);
  };

  const handleSubmitRequest = async (requestId) => {
    const submitted = await guardedSubmitRequestDocument(requestId);
    if (!submitted) return null;
    return submitted;
  };

  const handleUpdateProject = async (projectId, updates) => {
    try {
      await guardedUpdateProject(projectId, updates);
    } catch (err) {
      showToast('프로젝트 업데이트 실패: ' + err.message, 'error');
    }
  };

  const closeDetailPanel = () => {
    setUrlState({ itemId: null, fullscreen: false });
  };

  // 개인 메모 CRUD 함수들
  const addPersonalMemo = async (title, content = '') => {
    if (!user?.id) {
      showToast('로그인이 필요합니다.', 'error');
      return;
    }
    try {
      const newMemo = await API.createPersonalMemo(title, content);
      setPersonalMemos(prev => [...prev, newMemo]);
      showToast(`'${title}' 메모가 생성되었습니다.`, 'success');
    } catch (err) {
      showToast('메모 생성 실패: ' + err.message, 'error');
    }
  };

  const updatePersonalMemo = async (memoId, updates) => {
    if (!user?.id) {
      showToast('로그인이 필요합니다.', 'error');
      return;
    }
    try {
      const updatedMemo = await API.updatePersonalMemo(memoId, updates);
      setPersonalMemos(prev =>
        prev.map(m => m.id === memoId ? (updatedMemo || { ...m, ...updates }) : m)
      );
    } catch (err) {
      showToast('메모 업데이트 실패: ' + err.message, 'error');
    }
  };

  const deletePersonalMemo = async (memoId) => {
    if (!user?.id) {
      showToast('로그인이 필요합니다.', 'error');
      return;
    }
    try {
      await API.deletePersonalMemo(memoId);
      setPersonalMemos(prev => prev.filter(m => m.id !== memoId));
      showToast('메모가 삭제되었습니다.', 'success');
    } catch (err) {
      showToast('메모 삭제 실패: ' + err.message, 'error');
    }
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

  const handleOpenNotification = async (notification) => {
    const targetView = notification.payload?.board_type === 'main' ? 'roadmap' : 'board';
    const targetBoardType = normalizeBoardType(notification.payload?.board_type) || defaultBoardType;
    const entityTable = notification.entity_table;
    const entityId = notification.entity_id;

    setUrlState({
      view: targetView,
      boardType: targetView === 'board' ? targetBoardType : urlState.boardType || targetBoardType,
      itemId: entityTable?.includes('items') ? entityId : null,
      fullscreen: entityTable?.includes('items'),
    });

    if (!entityTable?.includes('projects')) return;

    window.setTimeout(() => {
      const target = document.getElementById(`project-${entityId}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 80);
  };

  const hasPendingMutation = pendingMutationKeys.size > 0;

  return (
    <PresenceContext.Provider value={{ onlineUsers, updateEditing, currentUserId: user?.id ?? null }}>
    <AppLayout
      sections={sections}
      projects={projects}
      activeView={activeView}
      activeItemId={detailItemId}
      onNavigate={(view) => setUrlState({ view, itemId: null, repoFullName: null })}
      onOpenItem={(itemId) => setUrlState({ itemId })}
      onAddChildPage={(projectId, parentItemId, title) => addChildPage(projectId, parentItemId, title, user?.id)}
      onShowPrompt={showPrompt}
      onShowReleaseNotes={onShowReleaseNotes}
      onShowConfirm={showConfirm}
      isReadOnly={isReadOnly}
      user={user}
      theme={resolvedTheme ?? theme}
      mounted={mounted}
      onToggleTheme={() => setTheme((resolvedTheme ?? theme) === 'dark' ? 'light' : 'dark')}
      onLogout={logout}
      onSetBoardType={handleSetBoardType}
      generalDocs={generalDocs}
      onShowToast={showToast}
      onMoveSidebarItem={moveSidebarItem}
      onMoveSidebarProject={moveSidebarProject}
      onOpenProfileSettings={handleOpenProfileModal}
      profileCustomization={profileCustomization}
      onOpenSearch={() => setShowSearch(true)}
      currentBoardType={currentBoardType}
    >
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="w-full h-full bg-white dark:bg-bg-base font-sans flex overflow-hidden transition-colors duration-200">
        
        {/* Main Content Area */}
          <div 
            className={`flex-1 flex flex-col min-w-0 ${isResizing ? 'select-none pointer-events-none' : 'transition-all duration-300 ease-notion'} ${detailItemId && !isDetailFullscreen ? 'overflow-hidden' : ''}`}
            style={{ marginRight: detailItemId && !isDetailFullscreen ? `${panelWidth}vw` : '0' }}
          >
          {/* Minimal Header */}
          <header className={`pl-5 py-2.5 flex justify-between items-center bg-white dark:bg-bg-base border-b border-gray-100 dark:border-border-subtle transition-all duration-300 ease-notion ${detailItemId && !isDetailFullscreen ? 'pr-4' : 'pr-5'}`}>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-gray-900 dark:text-text-primary tracking-tight truncate">
                {activeView === 'roadmap'
                  ? '전사 로드맵'
                  : activeView === 'board'
                    ? visibleBoardLabel
                    : activeView === 'timeline'
                      ? '타임라인'
                      : activeView === 'personal'
                        ? '개인 메모장'
                        : activeView === 'repositories'
                          ? '레포지토리'
                          : '인원 관리'}
              </h1>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              {hasPendingMutation && (
                <span className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-gray-500 dark:border-border-subtle dark:bg-bg-elevated dark:text-text-secondary">
                  <span className="h-2 w-2 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin dark:border-border-strong dark:border-t-white" />
                  처리 중
                </span>
              )}
              {(activeView === 'board' || activeView === 'roadmap') && (
                <FilterBar
                  inline
                  filters={filters}
                  sort={sort}
                  hasActiveFilters={hasActiveFilters}
                  onAddFilter={addFilter}
                  onRemoveFilter={removeFilter}
                  onClearFilters={resetFilters}
                  onSetSort={setSort}
                />
              )}
              <NotificationsInbox
                user={user}
                userId={user?.id}
                onOpenNotification={handleOpenNotification}
                onShowToast={showToast}
              />
              {!isReadOnly && <PresenceAvatars />}
            </div>
          </header>

          {/* Board Scroll Area */}
          {activeView === 'timeline' ? (
            <Suspense fallback={<ViewLoadingFallback label="타임라인 준비 중..." />}>
              <TimelineView
                projects={filteredProjects.filter(p => (p.board_type || 'main') !== 'main')}
                sections={sections.filter(s => (s.board_type || 'main') !== 'main')}
                onUpdateItem={guardedUpdateItem}
                onOpenDetail={handleOpenDetail}
                isReadOnly={isReadOnly}
                showToast={showToast}
              />
            </Suspense>
          ) : activeView === 'board' || activeView === 'roadmap' ? (
            <div
              className={`flex-1 overflow-x-auto overflow-y-auto pt-10 pb-10 pl-10 custom-scrollbar bg-white dark:bg-bg-base transition-all duration-300 ease-notion flex flex-col gap-20 ${detailItemId && !isDetailFullscreen ? 'pr-4' : 'pr-10'}`}
              onClick={(e) => {
                if (!detailItemId) return;
                if (e.target.closest('button, a, input, textarea, select, [contenteditable="true"], [role="button"], [data-interactive]')) return;
                closeDetailPanel();
              }}
            >

            {/* Separate Board Sections */}
            {visibleBoardTypes.map(boardName => {
              const boardProjects = filteredProjects.filter(p => (p.board_type || 'main') === boardName);
              const completedProjects = boardProjects.filter((project) => project.is_completed);
              const isCompletedGrouped = groupedCompletedBoards.has(boardName);
              const visibleProjects = isCompletedGrouped
                ? boardProjects.filter((project) => !project.is_completed)
                : boardProjects;
              const boardVisuals = {
                main: { label: '전사 로드맵', icon: '🗺️' },
                개발팀: { label: '개발팀 보드', icon: '⚙️' },
                AI팀: { label: 'AI팀 보드', icon: '🤖' },
                지원팀: { label: '지원팀 보드', icon: '📂' },
              };
              const boardVisual = boardVisuals[boardName] || { label: `${boardName} 보드`, icon: '📂' };
              const boardDisplayName = boardVisual.label;
              const boardIcon = boardVisual.icon;

              // 새 아이템 알림 (이미 호출된 훅에서 가져오기)
              const { newItems, markAsRead } = newItemsMap[boardName] || { newItems: [], markAsRead: () => {} };
              const showNewPanel = showNewPanelMap[boardName] || false;

              return (
                <section key={boardName} className="flex flex-col gap-8 border-t border-gray-100 dark:border-border-subtle pt-16 first:border-none first:pt-0 transition-all duration-300 ease-notion">
                  <div className="flex items-center justify-between px-4 group">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl filter drop-shadow-sm">{boardIcon}</div>
                      <div className="flex flex-col relative" data-new-panel>
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-black text-gray-900 dark:text-text-primary tracking-tight leading-tight">{boardDisplayName}</h2>
                          {newItems.length > 0 && (
                            <button
                              onClick={() => setShowNewPanelMap(prev => ({ ...prev, [boardName]: !prev[boardName] }))}
                              className="ml-2 px-2 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-md text-sm font-bold hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors cursor-pointer"
                            >
                              *NEW {newItems.length}
                            </button>
                          )}
                        </div>
                        {showNewPanel && newItems.length > 0 && (
                          <div className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-bg-elevated border border-gray-200 dark:border-border-strong rounded-lg shadow-lg p-2 min-w-96">
                            {newItems.map(item => (
                              <div
                                key={item.id}
                                className="px-3 py-2.5 rounded-md hover:bg-gray-50 dark:hover:bg-bg-hover transition-colors flex justify-between items-start gap-2 text-sm group"
                              >
                                <button
                                  onClick={() => {
                                    handleOpenDetail(item.id);
                                    setShowNewPanelMap(prev => ({ ...prev, [boardName]: false }));
                                  }}
                                  className="text-left flex-1 hover:underline"
                                >
                                  <span className="text-gray-900 dark:text-text-primary font-medium block truncate">{item.displayName}</span>
                                  <span className="text-gray-500 dark:text-text-tertiary text-xs">{item.timeAgoText}</span>
                                </button>
                                <button
                                  onClick={() => markAsRead(item.id)}
                                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                  title="읽음 표시"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-bg-elevated text-gray-500 dark:text-text-tertiary rounded-md text-[13px] font-bold tabular-nums border border-gray-100 dark:border-border-subtle shadow-sm uppercase tracking-wider">
                            {boardProjects.length} 프로젝트
                          </span>
                          <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-text-tertiary"></span>
                          <span className="text-[13px] font-bold text-gray-400 dark:text-text-tertiary uppercase tracking-widest">
                            {boardProjects.reduce((acc, p) => acc + p.items.length, 0)} Items
                          </span>
                        </div>
                      </div>
                    </div>
                    {user && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => showPrompt('새 섹션 추가', '섹션 이름을 입력하세요', (title) => guardedAddSection(boardName, title))}
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
                              async (title) => {
                                if (title) {
                                  await guardedAddProject(title, boardName);
                                }
                              }
                            );
                          }}
                          className="px-5 py-2.5 bg-gray-50 dark:bg-bg-elevated text-gray-500 dark:text-text-secondary rounded-xl text-sm font-bold hover:bg-gray-100 dark:hover:bg-bg-hover border border-dashed border-gray-300 dark:border-border-strong transition-all flex items-center gap-2 group/add cursor-pointer hover:shadow-md"
                          >
                            <span className="text-xl group-hover/add:text-brand-500 transition-colors">+</span>
                            새 프로젝트 추가
                          </button>
                        {completedProjects.length > 0 && (
                          <button
                            onClick={() => setGroupedCompletedBoards(prev => {
                              const next = new Set(prev);
                              next.has(boardName) ? next.delete(boardName) : next.add(boardName);
                              return next;
                            })}
                            className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                              isCompletedGrouped
                                ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/40 hover:bg-green-200 dark:hover:bg-green-900/30'
                                : 'bg-gray-50 dark:bg-bg-elevated text-gray-500 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-bg-hover border-gray-200 dark:border-border-strong hover:shadow-md'
                            }`}
                          >
                            <CheckCircle2 size={16} strokeWidth={2.2} />
                            <span>{isCompletedGrouped ? '완료 모아보기 해제' : '완료 프로젝트 모아보기'}</span>
                            <span className="px-2 py-0.5 rounded-full bg-white/70 dark:bg-black/20 text-xs font-black tabular-nums">
                              {completedProjects.length}
                            </span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            showPrompt(
                              '새 문서 추가',
                              '문서 제목을 입력하세요',
                              async (title) => {
                                if (title) {
                                  await guardedAddGeneralDocument(boardName, title, 'document', null, user?.id);
                                }
                              }
                            );
                          }}
                          className="px-5 py-2.5 bg-gray-50 dark:bg-bg-elevated text-gray-400 dark:text-text-tertiary rounded-xl text-sm font-bold hover:bg-gray-100 dark:hover:bg-bg-hover border border-dashed border-gray-200 dark:border-border-strong transition-all flex items-center gap-2 cursor-pointer hover:text-gray-600 dark:hover:text-text-secondary"
                        >
                          <span className="text-xl">📄</span>
                          새 문서 추가
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 보드 타이틀 바로 아래 설명 영역 */}
                  {(team_boards?.[boardName]?.description || !isReadOnly) && (
                    <BoardDescription
                      description={team_boards?.[boardName]?.description ?? ''}
                      isReadOnly={isReadOnly}
                      onSave={(updates) => updateTeamBoard(boardName, updates)}
                      onOpenDetail={handleOpenDetail}
                      generalDocs={generalDocs.filter(doc => (doc.board_type || 'main') === boardName && !isLegacyRequestDoc(doc))}
                      pinnedDocIds={team_boards?.[boardName]?.pinned_doc_ids ?? []}
                    />
                  )}

                  {(() => {
                    const boardSections = sections
                      .filter(s => s.board_type === boardName)
                      .sort((a, b) => a.order_index - b.order_index);
                    const boardGeneralDocs = generalDocs.filter(doc => (doc.board_type || 'main') === boardName && !isLegacyRequestDoc(doc));
                    const boardRequestDocs = boardName === '개발팀' ? requestDocs : [];
                    const isEmpty = boardProjects.length === 0 && boardSections.length === 0 && boardGeneralDocs.length === 0 && boardRequestDocs.length === 0;
                    const projectColumnProps = {
                      onAddItem: guardedAddItem, onUpdateItem: guardedUpdateItem, onDeleteItem: guardedDeleteItem,
                      onUpdateProject: guardedUpdateProject, onDeleteProject: guardedDeleteProject,
                      onCompleteProject: guardedCompleteProject,
                      onOpenDetail: handleOpenDetail,
                      onShowConfirm: showConfirm, onShowToast: showToast,
                      currentUserId: user?.id || null,
                      isReadOnly: isReadOnly,
                    };

                    return (
                      <div className="flex flex-col gap-8">
                          {boardName === '개발팀' && (
                            <RequestBoardSection
                              requests={requestDocs}
                              allProjectItems={allNonMainProjectItems}
                              isReadOnly={isReadOnly}
                              onOpenRequest={handleOpenDetail}
                              onAddRequest={() => {
                                showPrompt(
                                  '새 요청 문서 추가',
                                  '요청 제목을 입력하세요',
                                  async (requestForm) => {
                                    const requestTitle = `${requestForm?.title || ''}`.trim();
                                    if (!requestTitle) return;

                                    try {
                                      const requestDescription = `${requestForm?.description || ''}`.trim()
                                        || createDevRequestDescriptionScaffold();
                                      const newRequest = await guardedAddRequestDocument('개발팀', requestTitle, user?.id, {
                                        description: requestDescription,
                                        request_team: `${user?.user_metadata?.department || ''}`.trim() || null,
                                        priority: `${requestForm?.priority || '중간'}`.trim(),
                                      });
                                      if (newRequest) {
                                        handleOpenDetail(newRequest.id);
                                        showToast(`'${requestTitle}' 요청 문서를 만들었습니다. 본문 템플릿을 채운 뒤 전송하세요.`);
                                      }
                                    } catch (error) {
                                      showToast(`요청 문서 생성 실패: ${error.message}`, 'error');
                                    }
                                  }
                                );
                              }}
                            onDeleteRequest={(requestId) => {
                              const request = requestDocs.find((entry) => entry.id === requestId);
                              if (!request) return;

                              showConfirm(
                                '삭제',
                                `"${request.title}"을(를) 삭제하시겠습니까?`,
                                async (confirmed) => {
                                  if (confirmed) {
                                    try {
                                      await guardedDeleteRequestDocument(requestId);
                                    } catch (error) {
                                      showToast(`삭제 실패: ${error.message}`, 'error');
                                    }
                                  }
                                },
                                'delete'
                              );
                            }}
                          />
                        )}

                        {isEmpty ? (
                          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-100 dark:border-border-subtle rounded-3xl py-24 bg-gray-50/40 dark:bg-bg-elevated/40 transition-colors duration-200">
                            <div className="flex flex-col items-center text-center animate-fade-in">
                              <div className="w-16 h-16 bg-white dark:bg-bg-base rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-gray-100 dark:border-border-subtle mb-6">🏝️</div>
                              <p className="text-gray-400 dark:text-text-tertiary font-black text-xl mb-6 tracking-tight">이 보드에는 아직 프로젝트가 없습니다.</p>
                              {user && (
                                <button
                                  onClick={() => showPrompt(`${boardDisplayName} 첫 프로젝트 만들기`, '첫 번째 프로젝트의 이름을 입력하세요', (title) => guardedAddProject(title, boardName))}
                                  className="text-sm font-black text-brand-500 dark:text-brand-400 bg-white dark:bg-bg-elevated px-8 py-3.5 rounded-2xl shadow-lg border border-brand-100 dark:border-brand-800/30 hover:bg-brand-50 dark:hover:bg-bg-hover transition-all flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer uppercase tracking-widest"
                                >
                                  + 첫 번째 프로젝트 추가하기
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* 일반 문서 섹션 - 접고 펼칠 수 있음 (최상단) */}
                            {boardGeneralDocs.length > 0 && (
                              <div className="mt-8 rounded-[28px] border border-gray-200/80 bg-white/80 px-4 py-3 shadow-sm dark:border-white/8 dark:bg-[#101010]">
                                <div className="flex items-center justify-between gap-2">
                                  <button
                                    className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold text-gray-500 transition-colors hover:bg-gray-100/80 hover:text-gray-900 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white cursor-pointer"
                                    onClick={() => setExpandedGeneralDocBoards(prev => {
                                      const next = new Set(prev);
                                      next.has(boardName) ? next.delete(boardName) : next.add(boardName);
                                      return next;
                                    })}
                                  >
                                    <ChevronRight
                                      size={14}
                                      className={`transition-transform duration-200 ${expandedGeneralDocBoards.has(boardName) ? 'rotate-90' : ''}`}
                                    />
                                    <span>📄 일반 문서</span>
                                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold tabular-nums text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                                      {boardGeneralDocs.length}
                                    </span>
                                  </button>

                                  {/* 생성 버튼 그룹 */}
                                  {!isReadOnly && (
                                    <div className="flex gap-2">
                                      <button
                                        className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-brand-50 dark:bg-[#171717] dark:text-zinc-200 dark:hover:bg-brand-500/10"
                                        onClick={() => {
                                          showPrompt(
                                            '새 문서 추가',
                                            '문서 제목을 입력하세요',
                                            async (title) => {
                                              if (title) {
                                                await guardedAddGeneralDocument(boardName, title, 'document', null, user?.id);
                                              }
                                            }
                                          );
                                        }}
                                        title="새 문서 추가"
                                      >
                                        <span>➕</span>
                                        <span>문서</span>
                                      </button>
                                      <button
                                        className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-amber-50 dark:bg-[#171717] dark:text-zinc-200 dark:hover:bg-amber-500/10"
                                        onClick={() => {
                                          showPrompt(
                                            '새 폴더 추가',
                                            '폴더 이름을 입력하세요',
                                            async (title) => {
                                              if (title) {
                                                await guardedAddGeneralDocument(boardName, title, 'folder', null, user?.id);
                                              }
                                            }
                                          );
                                        }}
                                        title="새 폴더 추가"
                                      >
                                        <span>➕</span>
                                        <span>폴더</span>
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {expandedGeneralDocBoards.has(boardName) && (
                                  <div className="mt-3 rounded-2xl bg-gray-50/40 p-1.5 dark:bg-[#0d0d0d]">
                                    <GeneralDocumentSection
                                      documents={boardGeneralDocs}
                                      onOpenDetail={handleOpenDetail}
                                      onDeleteDocument={(itemId) => {
                                        const doc = boardGeneralDocs.find(d => d.id === itemId);
                                        if (doc) {
                                          showConfirm(
                                            '삭제',
                                            `"${doc.title}"을(를) 삭제하시겠습니까?`,
                                            async (confirmed) => {
                                              if (confirmed) {
                                                await guardedDeleteGeneralDocument(itemId);
                                              }
                                            },
                                            'delete'
                                          );
                                        }
                                      }}
                                      onMoveToFolder={(itemId) => {
                                        const doc = boardGeneralDocs.find(d => d.id === itemId);
                                        const folders = boardGeneralDocs.filter(d => d.page_type === 'folder');

                                        if (!doc) return;

                                        if (folders.length === 0) {
                                          showToast('이동할 폴더가 없습니다. 먼저 폴더를 만들어주세요.', 'warning');
                                          return;
                                        }

                                        setSelectFolder({
                                          itemId,
                                          itemTitle: doc.title,
                                          folders,
                                          onSelect: async (targetFolderId) => {
                                            const targetFolder = folders.find(f => f.id === targetFolderId);
                                            if (!targetFolder) return;

                                            try {
                                              await guardedUpdateGeneralDocument(itemId, { parent_item_id: targetFolder.id });
                                              showToast(`"${doc.title}"이(가) "${targetFolder.title}"으로 이동되었습니다.`, 'success');
                                            } catch (err) {
                                              showToast(`이동 실패: ${err.message}`, 'error');
                                            }
                                          }
                                        });
                                      }}
                                      onAddDocumentToFolder={(folderId) => {
                                        showPrompt(
                                          '새 문서 추가',
                                          '문서 제목을 입력하세요',
                                          async (title) => {
                                            if (title) {
                                              await guardedAddGeneralDocument(boardName, title, 'document', folderId, user?.id);
                                            }
                                          }
                                        );
                                      }}
                                      onTogglePinDocument={(docId, isPinned) => {
                                        const currentPinned = team_boards?.[boardName]?.pinned_doc_ids ?? [];
                                        const newPinned = isPinned
                                          ? [...currentPinned, docId]
                                          : currentPinned.filter(id => id !== docId);
                                        updateTeamBoard(boardName, {
                                          description: team_boards?.[boardName]?.description ?? '',
                                          pinned_doc_ids: newPinned
                                        });
                                        showToast(isPinned ? '보드 안내에 고정되었습니다.' : '고정이 해제되었습니다.', 'success');
                                      }}
                                      pinnedDocIds={team_boards?.[boardName]?.pinned_doc_ids ?? []}
                                      isReadOnly={isReadOnly}
                                    />
                                  </div>
                                )}
                              </div>
                            )}

                            {boardSections.length > 0 && (
                              <SortableContext items={boardSections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                {boardSections.map(section => (
                                  <BoardSection
                                    key={section.id}
                                    section={section}
                                    projects={visibleProjects.filter(p => p.section_id === section.id)}
                                    isCollapsed={!expandedSections.has(section.id)}
                                    onToggleCollapse={() => setExpandedSections(prev => {
                                      const next = new Set(prev);
                                      next.has(section.id) ? next.delete(section.id) : next.add(section.id);
                                      return next;
                                    })}
                                    onUpdateSection={updateSection}
                                    onDeleteSection={deleteSection}
                                    onAddProject={addProject}
                                    onShowPrompt={showPrompt}
                                    {...projectColumnProps}
                                  />
                                ))}
                              </SortableContext>
                            )}

                            {visibleProjects.filter(p => !p.section_id).length > 0 && (
                              <div className="flex gap-12 overflow-x-auto py-3 pb-6 custom-scrollbar min-h-[350px] px-2">
                                <SortableContext items={visibleProjects.filter(p => !p.section_id).map(p => p.id)} strategy={horizontalListSortingStrategy}>
                                  {visibleProjects.filter(p => !p.section_id).map((project, idx) => (
                                    <ProjectColumn key={project.id} project={project} projectIndex={idx + 1} {...projectColumnProps} />
                                  ))}
                                </SortableContext>
                              </div>
                            )}

                            {isCompletedGrouped && completedProjects.length > 0 && (
                              <div className="mt-2 rounded-[28px] border border-green-200/70 bg-green-50/40 px-4 py-4 shadow-sm dark:border-green-900/30 dark:bg-green-950/10">
                                <div className="flex items-center justify-between gap-2 px-2">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                                    <span className="text-sm font-black text-gray-900 dark:text-text-primary">완료된 프로젝트</span>
                                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold tabular-nums text-green-700 dark:bg-green-500/15 dark:text-green-200">
                                      {completedProjects.length}
                                    </span>
                                  </div>
                                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-green-600/80 dark:text-green-300/70">
                                    grouped
                                  </span>
                                </div>

                                <div className="flex flex-wrap gap-3 px-2 mt-3">
                                  {completedProjects.map(project => (
                                    <div key={project.id} className="flex flex-col gap-2">
                                      <button
                                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-bg-elevated border border-gray-200 dark:border-border-subtle rounded-xl hover:border-green-300 dark:hover:border-green-700 transition-colors cursor-pointer"
                                        onClick={() => setExpandedCompletedPhases(prev => {
                                          const next = new Set(prev);
                                          next.has(project.id) ? next.delete(project.id) : next.add(project.id);
                                          return next;
                                        })}
                                      >
                                        <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                                        <span className="text-sm font-bold text-gray-600 dark:text-text-secondary">{project.title}</span>
                                        <span className="text-xs text-gray-400 dark:text-text-tertiary tabular-nums">{project.items.length}개</span>
                                        <ChevronDown
                                          size={12}
                                          className={`text-gray-400 dark:text-text-tertiary transition-transform duration-200 ${expandedCompletedPhases.has(project.id) ? 'rotate-180' : ''}`}
                                        />
                                      </button>
                                      {expandedCompletedPhases.has(project.id) && (
                                        <ProjectColumn
                                          project={project}
                                          projectIndex={-1}
                                          {...projectColumnProps}
                                          isCompletedView={true}
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
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
          ) : activeView === 'repositories' ? (
            <Suspense fallback={<ViewLoadingFallback label="레포지토리 대시보드 준비 중..." />}>
              <RepositoriesDashboard
                selectedRepoFullName={selectedRepoFullName}
                onSelectRepo={(repoFullName) => setUrlState({ view: 'repositories', repoFullName, itemId: null })}
                gitHubStatus={gitHubStatus}
                onManageGitHubSettings={handleOpenProfileModal}
                allItems={[...projectItems, ...generalDocs]}
                onOpenRoadmapItem={handleOpenDetail}
                onShowToast={showToast}
              />
            </Suspense>
          ) : activeView === 'personal' ? (
            <Suspense fallback={<ViewLoadingFallback label="개인 메모장 준비 중..." />}>
              <PersonalMemoBoard
                memos={personalMemos}
                onAddMemo={addPersonalMemo}
                onUpdateMemo={updatePersonalMemo}
                onDeleteMemo={deletePersonalMemo}
                onOpenDetail={handleOpenDetail}
                onShowConfirm={showConfirm}
                onShowToast={showToast}
                onShowPrompt={showPrompt}
                isReadOnly={isReadOnly}
                loading={personalMemosLoading}
              />
            </Suspense>
          ) : (
            <Suspense fallback={<ViewLoadingFallback label="인원관리 화면 준비 중..." />}>
              <PeopleBoard
                teams={peopleTeams}
                loading={peopleLoading}
                error={peopleError}
                onOpenItem={handleOpenDetail}
                projectAssignees={projects.reduce((acc, p) => { acc[p.title] = p.assignees || []; return acc; }, {})}
                currentUserId={user?.id || null}
                onShowToast={showToast}
              />
            </Suspense>
          )}
          {user && (
            <ProfileSettingsModal
              key={profileModalSeed}
              isOpen={isProfileModalOpen}
              profileName={user?.user_metadata?.name || user?.email?.split('@')[0] || '익명'}
              initialValue={profileCustomization}
              gitHubStatus={gitHubStatus}
              gitHubLoading={isGitHubStatusLoading}
              gitHubConnecting={isGitHubConnecting}
              gitHubAppInstalling={isGitHubAppInstalling}
              saving={isSavingProfile}
              onClose={() => setIsProfileModalOpen(false)}
              onSave={handleSaveProfileCustomization}
              onConnectGitHub={handleConnectGitHub}
              onInstallGitHubApp={handleInstallGitHubApp}
            />
          )}
        </div>

        {/* Side Detail Panel (Fixed on the right when active) */}
        {detailItemId && detailItem && detailProject && (
          <div 
            className={`fixed top-0 right-0 h-full bg-white dark:bg-bg-base z-[100] overflow-hidden flex ${
              isResizing ? '' : 'transition-all duration-500 ease-notion'
            } ${
              isDetailFullscreen
                ? 'border-l border-gray-100 dark:border-border-subtle shadow-[-10px_0_40px_rgba(0,0,0,0.06)]'
                : 'shadow-[-10px_0_40px_rgba(0,0,0,0.06)] border-l border-gray-100 dark:border-border-subtle'
            }`}
            style={isDetailFullscreen
              ? {
                  left: `${isOpen ? sidebarWidth : collapsedWidth}px`,
                  width: `calc(100vw - ${isOpen ? sidebarWidth : collapsedWidth}px)`,
                }
              : { width: `${panelWidth}vw`, minWidth: '450px' }}
          >
            {/* Resize Handle (Using the border as the handle) */}
            {!isDetailFullscreen && (
              <div 
                className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-50 group transition-all duration-300"
                onMouseDown={startResizing}
              >
                <div className="absolute inset-y-0 left-0 w-[2px] bg-gray-100 dark:bg-border-subtle group-hover:bg-brand-400/50 group-active:bg-brand-500 transition-colors"></div>
              </div>
            )}
            
            <div className="flex-1 w-full h-full min-w-0 bg-white dark:bg-bg-base transition-colors duration-200">
              <Suspense fallback={<ViewLoadingFallback label="상세 정보를 불러오는 중..." fullHeight={false} />}>
                <ItemDetailPanel
                  item={detailItem}
                  project={detailProject}
                  entityContext={detailEntityContext}
                  allItems={[...projectItems, ...generalDocs, ...personalMemos, ...requestDocs]}
                  relationItems={relationCandidateItems}
                  reverseLinkedItems={detailRequestReverseLinks}
                  onClose={closeDetailPanel}
                  isFullscreen={isDetailFullscreen}
                  onToggleFullscreen={() => setUrlState({ fullscreen: !isDetailFullscreen })}
                  onBreadcrumbNavigate={handleBreadcrumbNavigate}
                  onUpdateItem={handleUpdateItem}
                  onUpdateProject={handleUpdateProject}
                  onDeleteItem={handleDeleteItem}
                  onSubmitRequest={handleSubmitRequest}
                  onDeleteProject={guardedDeleteProject}
                  onAddComment={addComment}
                  onUpdateComment={updateComment}
                  onDeleteComment={deleteComment}
                  onOpenDetail={handleOpenDetail}
                  onShowConfirm={showConfirm}
                  onShowToast={showToast}
                  onAddChildPage={(projectId, parentItemId, title) => addChildPage(projectId, parentItemId, title, user?.id)}
                  onShowPrompt={showPrompt}
                  onManageGitHubSettings={handleOpenProfileModal}
                  isReadOnly={isReadOnly}
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
          ) : activeProject ? (
            <ProjectColumn project={activeProject} projectIndex={projects.findIndex(p => p.id === activeProject.id) + 1} isDragging />
          ) : null}
        </DragOverlay>

        {/* 전체 검색 모달 */}
        {showSearch && (
          <Suspense fallback={<ViewLoadingFallback label="검색 창 준비 중..." />}>
            <SearchModal
              projects={projects.filter(p => (p.board_type || MAIN_BOARD_TYPE) !== MAIN_BOARD_TYPE)}
              additionalItems={searchableAdditionalItems}
              onOpenDetail={handleOpenDetail}
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
            onConfirm={handleConfirmAccept}
            onCancel={() => setConfirm(null)}
          />
        )}
        {prompt && (
          <InputModal
            title={prompt.title}
            placeholder={prompt.placeholder}
            onConfirm={handlePromptConfirm}
            onCancel={() => setPrompt(null)}
          />
        )}

        {/* 폴더 선택 모달 */}
        {selectFolder && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setSelectFolder(null)}>
            <div className="bg-white dark:bg-bg-elevated rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-gray-900 dark:text-text-primary mb-4">
                폴더 선택
              </h2>
              <p className="text-sm text-gray-600 dark:text-text-secondary mb-4">
                "{selectFolder.itemTitle}"을(를) 이동할 폴더를 선택하세요:
              </p>

              <div className="space-y-2 max-h-96 overflow-y-auto mb-6">
                {selectFolder.folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => {
                      selectFolder.onSelect(folder.id);
                      setSelectFolder(null);
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-bg-hover hover:bg-gray-100 dark:hover:bg-bg-elevated border border-gray-200 dark:border-border-subtle hover:border-brand-200 dark:hover:border-brand-600 transition-all flex items-center gap-2"
                  >
                    <span className="text-lg">📁</span>
                    <span className="font-medium text-gray-700 dark:text-text-primary">{folder.title}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setSelectFolder(null)}
                  className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-bg-hover text-gray-700 dark:text-text-primary font-medium hover:bg-gray-300 dark:hover:bg-border-subtle transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DndContext>
    </AppLayout>
    </PresenceContext.Provider>
  );
}

function BoardDescription({ description, isReadOnly, onSave, onOpenDetail, generalDocs, pinnedDocIds = [] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description);

  useEffect(() => {
    setDraft(description);
  }, [description]);

  if (!description && isReadOnly) return null;

  const docs = generalDocs.filter(d => d.page_type !== 'folder');
  const pinnedDocs = docs.filter(d => pinnedDocIds.includes(d.id));

  return (
    <div className="mt-2 mb-6 px-4">
      <div className="bg-white/50 dark:bg-bg-elevated/40 border border-gray-200 dark:border-border-subtle rounded-xl px-4 py-3.5 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            {editing ? (
              <>
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="팀 보드에 대한 설명을 작성하세요."
                  className="w-full p-2 bg-white dark:bg-bg-base border border-gray-300 dark:border-border-strong rounded-lg text-sm text-gray-900 dark:text-text-primary placeholder-gray-400 dark:placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2 mt-2 justify-end">
                  <button
                    onClick={() => {
                      onSave({ description: draft, pinned_doc_ids: pinnedDocIds });
                      setEditing(false);
                    }}
                    className="px-3 py-1.5 bg-blue-500 dark:bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => {
                      setDraft(description);
                      setEditing(false);
                    }}
                    className="px-3 py-1.5 bg-gray-200 dark:bg-bg-base text-gray-700 dark:text-text-primary rounded-lg text-xs font-bold hover:bg-gray-300 dark:hover:bg-bg-hover transition-colors"
                  >
                    취소
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-2 min-h-5">
                  <span className="text-sm text-gray-700 dark:text-text-primary leading-relaxed flex-1 whitespace-pre-wrap">
                    {description}
                  </span>
                  {!isReadOnly && (
                    <button
                      onClick={() => setEditing(true)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-bg-hover rounded transition-colors flex-shrink-0 mt-0.5"
                      title="편집"
                    >
                      <svg className="w-4 h-4 text-gray-500 dark:text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* 고정된 문서만 표시 */}
                {!editing && pinnedDocs.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {pinnedDocs.map(doc => (
                      <DocumentButton
                        key={doc.id}
                        doc={doc}
                        onOpenDetail={onOpenDetail}
                        onTogglePin={(docId, isPinned) => {
                          const newPinned = isPinned
                            ? [...pinnedDocIds, docId]
                            : pinnedDocIds.filter(id => id !== docId);
                          onSave({ description, pinned_doc_ids: newPinned });
                        }}
                        isReadOnly={isReadOnly}
                        isPinned={true}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentButton({ doc, onOpenDetail, onTogglePin, isReadOnly, isPinned = false }) {
  const [showMenu, setShowMenu] = useState(false);

  const bgClass = isPinned
    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/40 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:border-blue-400 dark:hover:border-blue-600'
    : 'bg-gray-100 dark:bg-bg-base border-gray-300 dark:border-border-strong text-gray-700 dark:text-text-primary hover:bg-gray-200 dark:hover:bg-bg-hover hover:border-gray-400 dark:hover:border-border-strong';

  return (
    <div className="relative">
      <button
        onClick={() => onOpenDetail(doc.id)}
        className={`text-xs px-2 py-1.5 border rounded-lg transition-colors font-medium flex items-center gap-1.5 max-w-xs group ${bgClass} pr-8`}
      >
        <span>{isPinned ? '📌' : '📄'}</span>
        <span className="truncate">{doc.title}</span>
      </button>
      {!isReadOnly && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/50 dark:hover:bg-bg-elevated rounded"
          title="메뉴"
          aria-label={`${doc.title} 메뉴`}
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </button>
      )}
      {showMenu && (
        <div className="absolute top-full right-0 mt-1 bg-white dark:bg-bg-elevated border border-gray-200 dark:border-border-subtle rounded-lg shadow-lg z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(doc.id, !isPinned);
              setShowMenu(false);
            }}
            className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-text-primary hover:bg-gray-100 dark:hover:bg-bg-hover rounded-lg transition-colors"
          >
            {isPinned ? '📍 고정 해제' : '📌 고정하기'}
          </button>
        </div>
      )}
    </div>
  );
}
