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
import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
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
import { PresenceContext } from '../hooks/usePresenceContext';
import PresenceAvatars from './PresenceAvatars';
import { useLayoutState } from '../hooks/useLayoutState.js';
import API from '../api/kanbanAPI';
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
import { TEAMS, GLOBAL_TAGS } from '../lib/constants';
import { buildEntityContext, ENTITY_TYPES } from '../lib/entityModel';
import FilterBar from './FilterBar';
import AppLayout from './AppLayout';
import { useFilterState, applyFilterSort } from '../hooks/useFilterState';
import { DEFAULT_PROFILE_CUSTOMIZATION, normalizeProfileCustomization } from '../lib/profileAppearance';

import { Toast, ConfirmModal, InputModal } from './UI/Feedback';

const TEAM_BOARDS = ['개발팀', 'AI팀', '지원팀'];
const DISPLAY_BOARDS = ['main', ...TEAM_BOARDS];
const ItemDetailPanel = lazy(() => import('./ItemDetailPanel'));
const PeopleBoard = lazy(() => import('./PeopleBoard'));
const TimelineView = lazy(() => import('./TimelineView'));
const SearchModal = lazy(() => import('./SearchModal'));
const PersonalMemoBoard = lazy(() => import('./PersonalMemoBoard'));

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
    generalDocs, addGeneralDocument, updateGeneralDocument, deleteGeneralDocument, setBoardType,
  } = useKanbanData();

  const { user, logout } = useAuth();
  const [urlState, setUrlState, replaceUrlState] = useUrlState();
  const activeView = urlState.view;
  const detailItemId = urlState.itemId;
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

    fetchPersonalMemos();
    return () => { isMounted = false; };
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
  const [expandedCompletedBoards, setExpandedCompletedBoards] = useState(() => {
    try {
      const saved = localStorage.getItem('kanban-completed-expanded');
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

  const showToast = (message, type = 'success') => setToast({ message, type });
  const showConfirm = (title, message, onConfirm, type = 'danger') => setConfirm({ title, message, onConfirm, type });
  const showPrompt = (title, placeholder, onConfirm) => setPrompt({ title, placeholder, onConfirm });

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

  const searchableAdditionalItems = useMemo(() => {
    const items = [...generalDocs];
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
    localStorage.setItem('kanban-completed-expanded', JSON.stringify([...expandedCompletedBoards]));
  }, [expandedCompletedBoards]);

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
      await updateProject(itemId, updates);
      return;
    }
    if (detailEntityContext?.type === ENTITY_TYPES.MEMO) {
      await updatePersonalMemo(itemId, updates);
      return;
    }
    if (detailEntityContext?.collection === 'general') {
      await updateGeneralDocument(itemId, updates);
      return;
    }
    await updateItem(projectId, itemId, updates);
  };

  const handleDeleteItem = async (projectId, itemId) => {
    if (detailEntityContext?.type === ENTITY_TYPES.MEMO) {
      await deletePersonalMemo(itemId);
      return;
    }
    if (detailEntityContext?.collection === 'general') {
      await deleteGeneralDocument(itemId);
      return;
    }
    await deleteItem(projectId, itemId);
  };

  const handleUpdateProject = async (projectId, updates) => {
    try {
      await updateProject(projectId, updates);
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
      const newMemo = await API.createPersonalMemo(title, content, user.id);
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
      await API.updatePersonalMemo(memoId, updates, user.id);
      setPersonalMemos(prev =>
        prev.map(m => m.id === memoId ? { ...m, ...updates } : m)
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
      await API.deletePersonalMemo(memoId, user.id);
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

  return (
    <PresenceContext.Provider value={{ onlineUsers, updateEditing, currentUserId: user?.id ?? null }}>
    <AppLayout
      sections={sections}
      projects={projects}
      activeView={activeView}
      activeItemId={detailItemId}
      onNavigate={(view) => setUrlState({ view, itemId: null })}
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
      onSetBoardType={setBoardType}
      generalDocs={generalDocs}
      onShowToast={showToast}
      onMoveSidebarItem={moveSidebarItem}
      onMoveSidebarProject={moveSidebarProject}
      onOpenProfileSettings={handleOpenProfileModal}
      profileCustomization={profileCustomization}
      onOpenSearch={() => setShowSearch(true)}
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
                {activeView === 'roadmap' ? '전사 로드맵' : activeView === 'board' ? '팀 보드' : activeView === 'timeline' ? '타임라인' : activeView === 'personal' ? '개인 메모장' : '인원 관리'}
              </h1>
            </div>
            <div className="flex items-center gap-2 min-w-0">
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
              {!isReadOnly && <PresenceAvatars />}
            </div>
          </header>

          {/* Board Scroll Area */}
          {activeView === 'timeline' ? (
            <Suspense fallback={<ViewLoadingFallback label="타임라인 준비 중..." />}>
              <TimelineView
                projects={filteredProjects.filter(p => (p.board_type || 'main') !== 'main')}
                sections={sections.filter(s => (s.board_type || 'main') !== 'main')}
                onUpdateItem={updateItem}
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
            {(activeView === 'roadmap' ? ['main'] : TEAM_BOARDS).map(boardName => {
              const boardProjects = filteredProjects.filter(p => (p.board_type || 'main') === boardName.toLowerCase() && !p.is_completed);
              const completedProjects = filteredProjects.filter(p => (p.board_type || 'main') === boardName.toLowerCase() && p.is_completed);
              const boardDisplayName = boardName === 'main' ? '전사 로드맵' : `${boardName} 보드`;
              const boardIcon = boardName === 'main' ? '🗺️' : boardName === '개발팀' ? '⚙️' : '📂';

              return (
                <section key={boardName} className="flex flex-col gap-8 border-t border-gray-100 dark:border-border-subtle pt-16 first:border-none first:pt-0 transition-all duration-300 ease-notion">
                  <div className="flex items-center justify-between px-4 group">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl filter drop-shadow-sm">{boardIcon}</div>
                      <div className="flex flex-col">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-text-primary tracking-tight leading-tight">{boardDisplayName}</h2>
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
                          onClick={() => showPrompt('새 섹션 추가', '섹션 이름을 입력하세요', (title) => { if (title) { addSection(boardName.toLowerCase(), title); showToast(`'${title}' 섹션이 생성되었습니다.`); setPrompt(null); } })}
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
                              (title) => {
                                if (title) {
                                  addProject(title, boardName.toLowerCase());
                                  showToast(`'${title}' 프로젝트가 생성되었습니다.`);
                                  setPrompt(null);
                                }
                              }
                            );
                          }}
                          className="px-5 py-2.5 bg-gray-50 dark:bg-bg-elevated text-gray-500 dark:text-text-secondary rounded-xl text-sm font-bold hover:bg-gray-100 dark:hover:bg-bg-hover border border-dashed border-gray-300 dark:border-border-strong transition-all flex items-center gap-2 group/add cursor-pointer hover:shadow-md"
                        >
                          <span className="text-xl group-hover/add:text-brand-500 transition-colors">+</span>
                          새 프로젝트 추가
                        </button>
                        <button
                          onClick={() => {
                            showPrompt(
                              '새 문서 추가',
                              '문서 제목을 입력하세요',
                              (title) => {
                                if (title) {
                                  addGeneralDocument(boardName.toLowerCase(), title.trim(), undefined, undefined, user?.id);
                                  showToast(`'${title}' 문서가 생성되었습니다.`);
                                  setPrompt(null);
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

                  {(() => {
                    const standaloneProjects = boardProjects.filter(p => !p.section_id);
                    const boardSections = sections
                      .filter(s => s.board_type === boardName.toLowerCase())
                      .sort((a, b) => a.order_index - b.order_index);
                    const boardGeneralDocs = generalDocs.filter(doc => (doc.board_type || 'main') === boardName.toLowerCase());
                    const isEmpty = boardProjects.length === 0 && boardSections.length === 0 && boardGeneralDocs.length === 0;
                    const projectColumnProps = {
                      onAddItem: addItem, onUpdateItem: updateItem, onDeleteItem: deleteItem,
                      onUpdateProject: updateProject, onDeleteProject: deleteProject,
                      onCompleteProject: completeProject,
                      onOpenDetail: handleOpenDetail,
                      onShowConfirm: showConfirm, onShowToast: showToast,
                      currentUserId: user?.id || null,
                      isReadOnly: isReadOnly,
                    };

                    return (
                      <div className="flex flex-col gap-8">
                        {isEmpty ? (
                          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-100 dark:border-border-subtle rounded-3xl py-24 bg-gray-50/40 dark:bg-bg-elevated/40 transition-colors duration-200">
                            <div className="flex flex-col items-center text-center animate-fade-in">
                              <div className="w-16 h-16 bg-white dark:bg-bg-base rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-gray-100 dark:border-border-subtle mb-6">🏝️</div>
                              <p className="text-gray-400 dark:text-text-tertiary font-black text-xl mb-6 tracking-tight">이 보드에는 아직 프로젝트가 없습니다.</p>
                              {user && (
                                <button
                                  onClick={() => showPrompt(`${boardDisplayName} 첫 프로젝트 만들기`, '첫 번째 프로젝트의 이름을 입력하세요', (title) => { if (title) { addProject(title, boardName.toLowerCase()); showToast(`'${title}' 프로젝트가 생성되었습니다.`); setPrompt(null); } })}
                                  className="text-sm font-black text-brand-500 dark:text-brand-400 bg-white dark:bg-bg-elevated px-8 py-3.5 rounded-2xl shadow-lg border border-brand-100 dark:border-brand-800/30 hover:bg-brand-50 dark:hover:bg-bg-hover transition-all flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer uppercase tracking-widest"
                                >
                                  + 첫 번째 프로젝트 추가하기
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            {boardSections.length > 0 && (
                              <SortableContext items={boardSections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                {boardSections.map(section => (
                                  <BoardSection
                                    key={section.id}
                                    section={section}
                                    projects={boardProjects.filter(p => p.section_id === section.id)}
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

                            {/* 일반 문서 섹션 - 접고 펼칠 수 있음 */}
                            {boardGeneralDocs.length > 0 && (
                              <div className="mt-8">
                                <div className="flex items-center justify-between gap-2">
                                  <button
                                    className="flex items-center gap-2 px-2 py-2 text-sm font-bold text-gray-500 dark:text-text-secondary hover:text-gray-900 dark:hover:text-text-primary transition-colors cursor-pointer"
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
                                    <span className="px-2 py-0.5 bg-brand-100 dark:bg-brand-800/30 text-brand-600 dark:text-brand-400 rounded-full text-xs font-bold tabular-nums">
                                      {boardGeneralDocs.length}
                                    </span>
                                  </button>

                                  {/* 생성 버튼 그룹 */}
                                  {!isReadOnly && (
                                    <div className="flex gap-2">
                                      <button
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 dark:text-text-primary hover:bg-brand-50 dark:hover:bg-brand-800/10 rounded transition-colors"
                                        onClick={() => {
                                          showPrompt(
                                            '새 문서 추가',
                                            '문서 제목을 입력하세요',
                                            (title) => {
                                              if (title) {
                                                addGeneralDocument(boardName.toLowerCase(), title.trim(), 'document', undefined, user?.id);
                                                showToast(`'${title}' 문서가 생성되었습니다.`);
                                                setPrompt(null);
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
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 dark:text-text-primary hover:bg-amber-50 dark:hover:bg-amber-900/10 rounded transition-colors"
                                        onClick={() => {
                                          showPrompt(
                                            '새 폴더 추가',
                                            '폴더 이름을 입력하세요',
                                            (title) => {
                                              if (title) {
                                                addGeneralDocument(boardName.toLowerCase(), title.trim(), 'folder', undefined, user?.id);
                                                showToast(`'${title}' 폴더가 생성되었습니다.`);
                                                setPrompt(null);
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
                                  <div className="mt-3">
                                    <GeneralDocumentSection
                                      documents={boardGeneralDocs}
                                      onOpenDetail={handleOpenDetail}
                                      onDeleteDocument={(itemId) => {
                                        console.log('[onDeleteDocument] itemId:', itemId, 'boardGeneralDocs:', boardGeneralDocs);
                                        const doc = boardGeneralDocs.find(d => d.id === itemId);
                                        console.log('[onDeleteDocument] found doc:', doc);
                                        if (doc) {
                                          showConfirm(
                                            '삭제',
                                            `"${doc.title}"을(를) 삭제하시겠습니까?`,
                                            async (confirmed) => {
                                              console.log('[onDeleteDocument] confirmed:', confirmed);
                                              if (confirmed) {
                                                await deleteGeneralDocument(itemId);
                                                showToast('삭제되었습니다.', 'success');
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
                                              await updateGeneralDocument(itemId, { parent_item_id: targetFolder.id });
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
                                          (title) => {
                                            if (title) {
                                              addGeneralDocument(boardName.toLowerCase(), title.trim(), 'document', folderId, user?.id);
                                              showToast(`'${title}' 문서가 생성되었습니다.`);
                                              setPrompt(null);
                                            }
                                          }
                                        );
                                      }}
                                      isReadOnly={isReadOnly}
                                    />
                                  </div>
                                )}
                              </div>
                            )}

                            {standaloneProjects.length > 0 && (
                              <div className="flex gap-12 overflow-x-auto py-3 pb-6 custom-scrollbar min-h-[350px] px-2">
                                <SortableContext items={standaloneProjects.map(p => p.id)} strategy={horizontalListSortingStrategy}>
                                  {standaloneProjects.map((project, idx) => (
                                    <ProjectColumn key={project.id} project={project} projectIndex={idx + 1} {...projectColumnProps} />
                                  ))}
                                </SortableContext>
                              </div>
                            )}

                            {completedProjects.length > 0 && (
                              <div className="mt-2">
                                <button
                                  className="flex items-center gap-2 px-2 py-2 text-sm font-bold text-gray-500 dark:text-text-secondary hover:text-gray-900 dark:hover:text-text-primary transition-colors cursor-pointer"
                                  onClick={() => setExpandedCompletedBoards(prev => {
                                    const next = new Set(prev);
                                    next.has(boardName) ? next.delete(boardName) : next.add(boardName);
                                    return next;
                                  })}
                                >
                                  <ChevronRight
                                    size={14}
                                    className={`transition-transform duration-200 ${expandedCompletedBoards.has(boardName) ? 'rotate-90' : ''}`}
                                  />
                                  <span>완료된 프로젝트</span>
                                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full text-xs font-bold tabular-nums">
                                    {completedProjects.length}
                                  </span>
                                </button>

                                {expandedCompletedBoards.has(boardName) && (
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
                                )}
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
                  allItems={[...projectItems, ...generalDocs]}
                  onClose={closeDetailPanel}
                  isFullscreen={isDetailFullscreen}
                  onToggleFullscreen={() => setUrlState({ fullscreen: !isDetailFullscreen })}
                  onBreadcrumbNavigate={handleBreadcrumbNavigate}
                  onUpdateItem={handleUpdateItem}
                  onUpdateProject={handleUpdateProject}
                  onDeleteItem={handleDeleteItem}
                  onDeleteProject={deleteProject}
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
              projects={projects}
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
            onConfirm={() => { confirm.onConfirm(true); setConfirm(null); }}
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
