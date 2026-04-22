/**
 * @fileoverview 전체 칸반 보드 상태의 단일 진실 소스(Single Source of Truth).
 *
 * useReducer로 projects/sections를 관리하고, Supabase Realtime으로 다른 클라이언트와 동기화.
 * 모든 CRUD 작업은 "dispatch 먼저 → API 호출 나중" 패턴(Optimistic Update)을 사용.
 *
 * 상태 구조:
 * - projects: 칸반 컬럼(project) 배열. 각 project는 items 배열 내장.
 * - sections: 컬럼 그룹. projects와 별도 관리.
 * - page_type='page' 아이템은 SET_DATA에서 projects에서 제거됨 (사이드바 전용).
 */
import { useEffect, useReducer, useCallback, useRef } from 'react';
import API, { createChildPage } from '../api/kanbanAPI';
import { supabase } from '../lib/supabase';
import { normalizeProfileCustomization } from '../lib/profileAppearance';
import {
  applySidebarItemMove,
  applySidebarProjectMove,
  cloneProjectsSnapshot,
} from './sidebarMoveState.js';

const INITIAL_STATE = {
  projects: [],
  sections: [],
  generalDocs: [],  // project_id=null, page_type='page' 문서들 (팀별 분리)
  requestDocs: [],  // 별도 요청 테이블(team_requests)
  team_boards: {},  // { [boardType]: description }
  loading: true,
  error: null,
  currentBoardType: 'main',  // 현재 선택된 팀별 보드
};

const BOARD_TYPES = ['main', '개발팀', 'AI팀', '기획팀', '지원팀', '감정팀'];

/**
 * @description 칸반 보드의 모든 상태 변경을 처리하는 순수 함수.
 *
 * 지원 액션:
 * - SET_DATA: 초기 로드 또는 Realtime 재조회 후 전체 교체
 * - ADD/UPDATE/DELETE/MOVE_PROJECT: 칸반 컬럼(project) CRUD
 * - ADD/UPDATE/DELETE/MOVE_ITEM: 카드(item) CRUD. MOVE는 cross-project 지원
 * - ADD/UPDATE/DELETE_COMMENT: 댓글 CRUD
 * - ADD/UPDATE/DELETE/MOVE_SECTION: 섹션 그룹 CRUD
 * - ADD_CHILD_PAGE: page_type='page' 아이템 추가 (사이드바용)
 *
 * @param {Object} state - 현재 상태 { projects, sections, loading, error }
 * @param {Object} action - { type: string, payload: any }
 * @returns {Object} 새 상태 (항상 새 객체 반환, 불변성 유지)
 */
const kanbanReducer = (state, action) => {
  switch (action.type) {
    case 'SET_DATA':
      return {
        ...state,
        projects: action.payload.projects,
        sections: action.payload.sections,
        generalDocs: action.payload.generalDocs || [],  // 신규: 일반 문서 추가
        requestDocs: action.payload.requestDocs || [],
        loading: false
      };
    case 'ADD_SECTION':
      return { ...state, sections: [...state.sections, action.payload] };
    case 'UPDATE_SECTION':
      return {
        ...state,
        sections: state.sections.map(s =>
          s.id === action.payload.id ? { ...s, ...action.payload.updates } : s
        ),
      };
    case 'DELETE_SECTION':
      return {
        ...state,
        sections: state.sections.filter(s => s.id !== action.payload),
        projects: state.projects.map(p =>
          p.section_id === action.payload ? { ...p, section_id: null } : p
        ),
      };
    case 'MOVE_SECTION': {
      const { sectionId, targetIndex, boardType } = action.payload;
      const boardSections = state.sections
        .filter(s => s.board_type === boardType)
        .sort((a, b) => a.order_index - b.order_index);
      const otherSections = state.sections.filter(s => s.board_type !== boardType);
      const movingIdx = boardSections.findIndex(s => s.id === sectionId);
      const newBoardSections = [...boardSections];
      const [moving] = newBoardSections.splice(movingIdx, 1);
      newBoardSections.splice(targetIndex, 0, moving);
      const reordered = newBoardSections.map((s, idx) => ({ ...s, order_index: idx }));
      return { ...state, sections: [...otherSections, ...reordered] };
    }
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, { ...action.payload, items: [] }] };
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(p => p.id === action.payload.id ? { ...p, ...action.payload.updates } : p)
      };
    case 'DELETE_PROJECT':
      return { ...state, projects: state.projects.filter(p => p.id !== action.payload) };
    case 'MOVE_PROJECT': {
      const newProjects = [...state.projects];
      const movingIdx = newProjects.findIndex(p => p.id === action.payload.projectId);
      const [movingProject] = newProjects.splice(movingIdx, 1);
      newProjects.splice(action.payload.targetIndex, 0, movingProject);
      return { ...state, projects: newProjects };
    }
    case 'SIDEBAR_MOVE_PROJECT':
      return {
        ...state,
        projects: applySidebarProjectMove(state.projects, action.payload),
      };
    // 신규: 일반 문서 액션들
    case 'ADD_GENERAL_DOC':
      return {
        ...state,
        generalDocs: [...state.generalDocs, { ...action.payload, comments: [] }].sort((a, b) => a.order_index - b.order_index)
      };
    case 'UPDATE_GENERAL_DOC':
      return {
        ...state,
        generalDocs: state.generalDocs.map(doc =>
          doc.id === action.payload.itemId
            ? { ...doc, ...action.payload.updates }
            : doc
        )
      };
    case 'DELETE_GENERAL_DOC':
      return {
        ...state,
        generalDocs: state.generalDocs.filter(doc => doc.id !== action.payload)
      };
    case 'MOVE_GENERAL_DOC': {
      const { itemId, newIndex } = action.payload;
      const newDocs = [...state.generalDocs];
      const movingIdx = newDocs.findIndex(d => d.id === itemId);
      const [movingDoc] = newDocs.splice(movingIdx, 1);
      newDocs.splice(newIndex, 0, movingDoc);
      return { ...state, generalDocs: newDocs };
    }
    case 'ADD_REQUEST_DOC':
      return {
        ...state,
        requestDocs: [...state.requestDocs, action.payload].sort((a, b) => a.order_index - b.order_index)
      };
    case 'UPDATE_REQUEST_DOC':
      return {
        ...state,
        requestDocs: state.requestDocs.map(request =>
          request.id === action.payload.requestId
            ? { ...request, ...action.payload.updates }
            : request
        ).sort((a, b) => a.order_index - b.order_index)
      };
    case 'DELETE_REQUEST_DOC':
      return {
        ...state,
        requestDocs: state.requestDocs.filter(request => request.id !== action.payload)
      };
    case 'MOVE_REQUEST_DOC': {
      const { requestId, newIndex } = action.payload;
      const newRequests = [...state.requestDocs];
      const movingIdx = newRequests.findIndex(request => request.id === requestId);
      const [movingRequest] = newRequests.splice(movingIdx, 1);
      newRequests.splice(newIndex, 0, movingRequest);
      return {
        ...state,
        requestDocs: newRequests.map((request, index) => ({ ...request, order_index: index })),
      };
    }
    case 'ADD_ITEM':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, items: [...p.items, { ...action.payload.item, comments: [] }].sort((a, b) => a.order_index - b.order_index) }
            : p
        )
      };
    case 'UPDATE_ITEM':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, items: p.items.map(i => i.id === action.payload.itemId ? { ...i, ...action.payload.updates } : i) }
            : p
        )
      };
    case 'DELETE_ITEM':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, items: p.items.filter(i => i.id !== action.payload.itemId) }
            : p
        )
      };
    case 'MOVE_ITEM': {
      const { sourceProjectId, targetProjectId, itemId, targetIndex } = action.payload;

      const sourceProject = state.projects.find(p => p.id === sourceProjectId);
      const movingItem = sourceProject.items.find(i => i.id === itemId);
      if (!movingItem) return state;

      // 같은 단계 내 이동인 경우
      if (sourceProjectId === targetProjectId) {
        return {
          ...state,
          projects: state.projects.map(p => {
            if (p.id === sourceProjectId) {
              const newItems = p.items.filter(i => i.id !== itemId);
              newItems.splice(targetIndex, 0, movingItem);
              return { ...p, items: newItems.map((item, idx) => ({ ...item, order_index: idx })) };
            }
            return p;
          })
        };
      }

      // 다른 단계로 이동하는 경우
      return {
        ...state,
        projects: state.projects.map(p => {
          if (p.id === sourceProjectId) {
            return { ...p, items: p.items.filter(i => i.id !== itemId) };
          }
          if (p.id === targetProjectId) {
            const newItems = [...p.items];
            newItems.splice(targetIndex, 0, { ...movingItem, project_id: targetProjectId });
            return { ...p, items: newItems.map((item, idx) => ({ ...item, order_index: idx })) };
          }
          return p;
        })
      };
    }
    case 'SIDEBAR_MOVE_ITEM':
      return {
        ...state,
        projects: applySidebarItemMove(state.projects, action.payload),
      };
    case 'RESTORE_PROJECTS':
      return {
        ...state,
        projects: action.payload.projects,
      };
    case 'ADD_CHILD_PAGE':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, items: [...(p.items || []), { ...action.payload.newPage, comments: [] }].sort((a, b) => a.order_index - b.order_index) }
            : p
        ),
      };
    case 'ADD_COMMENT':
      return {
        ...state,
        projects: state.projects.map(p => ({
          ...p,
          items: p.items.map(i => 
            i.id === action.payload.itemId 
              ? { ...i, comments: [...(i.comments || []), action.payload.comment].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) }
              : i
          )
        }))
      };
    case 'UPDATE_COMMENT':
      return {
        ...state,
        projects: state.projects.map(p => ({
          ...p,
          items: p.items.map(i => 
            i.id === action.payload.itemId 
              ? { ...i, comments: i.comments.map(c => c.id === action.payload.commentId ? { ...c, ...action.payload.updates } : c) }
              : i
          )
        }))
      };
    case 'DELETE_COMMENT':
      return {
        ...state,
        projects: state.projects.map(p => ({
          ...p,
          items: p.items.map(i => 
            i.id === action.payload.itemId 
              ? { ...i, comments: i.comments.filter(c => c.id !== action.payload.commentId) }
              : i
          )
        }))
      };
    case 'SET_TEAM_BOARDS':
      return { ...state, team_boards: action.payload };
    case 'UPDATE_TEAM_BOARD':
      return {
        ...state,
        team_boards: {
          ...state.team_boards,
          [action.boardType]: { ...(state.team_boards[action.boardType] || {}), ...action.updates }
        }
      };
    case 'SET_BOARD_TYPE':
      if (state.currentBoardType === action.payload) {
        return state;
      }
      return { ...state, currentBoardType: action.payload };
    default:
      return state;
  }
};

export const useKanbanData = () => {
  const [state, dispatch] = useReducer(kanbanReducer, INITIAL_STATE);
  const fetchRequestIdRef = useRef(0);

  const fetchTeamBoardConfigs = useCallback(async () => {
    try {
      const configs = await API.getTeamBoardConfigs(BOARD_TYPES);
      dispatch({
        type: 'SET_TEAM_BOARDS',
        payload: configs,
      });
    } catch (err) {
      console.warn('[useKanbanData] 팀 보드 설정 조회 실패:', err.message);
    }
  }, []);

  const fetchData = useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current;

    try {
      const data = await API.getBoardData();

      if (requestId !== fetchRequestIdRef.current) return;

      dispatch({
        type: 'SET_DATA',
        payload: {
          projects: data.projects,
          sections: data.sections,
          generalDocs: data.generalDocs,  // 신규: 일반 문서 포함
          requestDocs: data.requestDocs || [],
        }
      });
    } catch (err) {
      if (requestId !== fetchRequestIdRef.current) return;
      dispatch({ type: 'SET_ERROR', payload: err.message });
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchTeamBoardConfigs();

    const fetchCommentWithProfile = async (commentId) => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, profiles(name, department)')
        .eq('id', commentId)
        .single();
      if (!error) {
        const { data: customization } = await supabase
          .from('profile_customizations')
          .select('avatar_style, theme_color, status_message, mood_emoji')
          .eq('user_id', data.user_id)
          .maybeSingle();
        return {
          ...data,
          profiles: {
            ...(data.profiles || {}),
            customization: normalizeProfileCustomization(customization),
          },
        };
      }
      return null;
    };

    // Real-time Subscriptions
    const itemsChannel = supabase.channel('items-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roadmap_items' }, () => fetchData())
      .subscribe();

    const requestDocsChannel = supabase.channel('team-requests-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_requests' }, () => fetchData())
      .subscribe();

    const commentsChannel = supabase.channel('comments-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const commentWithProfile = await fetchCommentWithProfile(payload.new.id);
          if (commentWithProfile) {
            dispatch({ type: 'ADD_COMMENT', payload: { itemId: payload.new.item_id, comment: commentWithProfile } });
          }
        } else if (payload.eventType === 'UPDATE') {
          const commentWithProfile = await fetchCommentWithProfile(payload.new.id);
          if (commentWithProfile) {
            dispatch({ type: 'UPDATE_COMMENT', payload: { itemId: payload.new.item_id, commentId: payload.new.id, updates: commentWithProfile } });
          }
        } else if (payload.eventType === 'DELETE') {
          dispatch({ type: 'DELETE_COMMENT', payload: { itemId: payload.old.item_id, commentId: payload.old.id } });
        }
      })
      .subscribe();

    const projectsChannel = supabase.channel('projects-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roadmap_projects' }, () => fetchData())
      .subscribe();

    const profileCustomizationChannel = supabase.channel('profile-customizations-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profile_customizations' }, () => fetchData())
      .subscribe();

    return () => {
      fetchRequestIdRef.current += 1;
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(requestDocsChannel);
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(projectsChannel);
      supabase.removeChannel(profileCustomizationChannel);
    };
  }, [fetchData, fetchTeamBoardConfigs]);

  /**
   * @description 새 칸반 컬럼(프로젝트)을 추가. order_index는 현재 최대값+1 자동 계산.
   * @param {string} title - 컬럼 제목
   * @param {string} [boardType='main'] - 'main'|'개발팀'|'AI팀'|'지원팀'
   * @param {string|null} [sectionId=null] - 속할 섹션 ID. null이면 섹션 없는 컬럼
   */
  const addProject = async (title, boardType = 'main', sectionId = null) => {
    const newProject = await API.addProject(title, boardType, sectionId);
    dispatch({ type: 'ADD_PROJECT', payload: newProject });
  };

  const updateProject = async (projectId, updates) => {
    const project = state.projects.find(p => p.id === projectId);
    const boardType = project?.board_type ?? 'main';
    const updated = await API.updateProject(projectId, updates, boardType);
    dispatch({ type: 'UPDATE_PROJECT', payload: { id: projectId, updates: updated } });
  };

  const completeProject = async (projectId, isCompleted) => {
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;
    const boardType = project.board_type ?? 'main';
    const meta = isCompleted
      ? { sectionId: project.section_id, orderIndex: project.order_index }
      : { preCompletionSectionId: project.pre_completion_section_id, preCompletionOrderIndex: project.pre_completion_order_index };
    const updates = isCompleted
      ? { is_completed: true, pre_completion_section_id: project.section_id, pre_completion_order_index: project.order_index }
      : { is_completed: false, section_id: project.pre_completion_section_id, order_index: project.pre_completion_order_index };
    dispatch({ type: 'UPDATE_PROJECT', payload: { id: projectId, updates } });
    await API.completeProject(projectId, isCompleted, meta, boardType);
  };

  const deleteProject = async (projectId) => {
    const project = state.projects.find(p => p.id === projectId);
    const boardType = project?.board_type ?? 'main';
    await API.deleteProject(projectId, boardType);
    dispatch({ type: 'DELETE_PROJECT', payload: projectId });
  };

  const moveProject = async (projectId, targetIndex) => {
    const project = state.projects.find(p => p.id === projectId);
    const boardType = project?.board_type ?? 'main';
    dispatch({ type: 'MOVE_PROJECT', payload: { projectId, targetIndex } });
    await API.moveProject(projectId, targetIndex, boardType);
  };

  const addItem = async (projectId, title, content, createdBy = null) => {
    const project = state.projects.find(p => p.id === projectId);
    const boardType = project?.board_type ?? 'main';
    const newItem = await API.addItem(projectId, title, content, createdBy, boardType);
    dispatch({ type: 'ADD_ITEM', payload: { projectId, item: newItem } });
  };

  const resolveProjectForItem = (projectId, itemId) => {
    if (projectId) {
      const matchedProject = state.projects.find(p => p.id === projectId);
      if (matchedProject) return matchedProject;
    }

    if (!itemId) return null;

    return state.projects.find((project) =>
      (project.items || []).some((item) => item.id === itemId),
    ) || null;
  };

  const updateItem = async (projectId, itemId, updates) => {
    const project = resolveProjectForItem(projectId, itemId);
    const boardType = project?.board_type ?? 'main';
    const resolvedProjectId = project?.id ?? projectId;
    const updated = await API.updateItem(resolvedProjectId, itemId, updates, boardType);
    dispatch({ type: 'UPDATE_ITEM', payload: { projectId: resolvedProjectId, itemId, updates: updated } });
  };

  const deleteItem = async (projectId, itemId) => {
    const project = resolveProjectForItem(projectId, itemId);
    const boardType = project?.board_type ?? 'main';
    const resolvedProjectId = project?.id ?? projectId;
    await API.deleteItem(resolvedProjectId, itemId, boardType);
    dispatch({ type: 'DELETE_ITEM', payload: { projectId: resolvedProjectId, itemId } });
  };

  /**
   * @description 아이템을 다른 프로젝트로 이동 또는 같은 프로젝트 내 재정렬.
   * Optimistic: dispatch로 UI 즉시 반영 후 API 호출.
   * 이동 후 source/target project 양쪽의 order_index 전체 재계산.
   * @param {string} sourceProjectId - 원래 project ID
   * @param {string} targetProjectId - 목적 project ID (같은 project면 재정렬)
   * @param {string} itemId - 이동할 아이템 ID
   * @param {number} targetIndex - 목적 project에서의 위치 (0-based)
   */
  const moveItem = async (sourceProjectId, targetProjectId, itemId, targetIndex) => {
    const project = state.projects.find(p => p.id === sourceProjectId);
    const boardType = project?.board_type ?? 'main';
    dispatch({ type: 'MOVE_ITEM', payload: { sourceProjectId, targetProjectId, itemId, targetIndex } });
    await API.moveItem(sourceProjectId, targetProjectId, itemId, targetIndex, undefined, boardType);
  };

  /**
   * @description page_type='page' 아이템(문서 페이지)을 생성하고 부모 아이템과 양방향 연결.
   * 칸반 카드가 아닌 중첩 페이지 생성 시 사용. 사이드바 트리에 표시됨.
   * 부모의 related_items에도 자동으로 추가됨.
   * @param {string} projectId - 속할 project ID
   * @param {string} parentItemId - 부모 아이템 ID (related_items 양방향 연결)
   * @param {string} title - 페이지 제목
   */
  const addChildPage = async (projectId, parentItemId, title, createdBy = null) => {
    let inheritedTeams = [];
    let inheritedTags = [];
    const parentProject = state.projects.find(p => p.id === projectId);
    const boardType = parentProject?.board_type ?? 'main';
    if (parentItemId) {
      const parentItem = parentProject?.items?.find(i => i.id === parentItemId);
      if (parentItem) {
        inheritedTeams = parentItem.teams || [];
        inheritedTags = parentItem.tags || [];
      }
    }

    const newPage = await createChildPage(projectId, parentItemId, title, {
      teams: inheritedTeams,
      tags: inheritedTags,
    }, boardType, createdBy);
    
    // 1. 하위 페이지(자기 자신)의 related_items에 부모 페이지를 추가 (상위 페이지 연결)
    if (parentItemId) {
      await updateItem(projectId, newPage.id, {
        related_items: [parentItemId]
      });
      // 로컬 상태 동기화를 위해 newPage 객체 업데이트
      newPage.related_items = [parentItemId];
    }

    // 2. 부모 아이템의 related_items에도 하위 페이지를 추가 (양방향 연결)
    if (parentItemId) {
      const parentItem = parentProject?.items.find(i => i.id === parentItemId);
      if (parentItem) {
        const currentRelations = parentItem.related_items || [];
        if (!currentRelations.includes(newPage.id)) {
          await updateItem(projectId, parentItemId, { 
            related_items: [...currentRelations, newPage.id] 
          });
        }
      }
    }

    dispatch({ type: 'ADD_CHILD_PAGE', payload: { projectId, newPage } });
    return newPage;
  };

  const addComment = async (projectId, itemId, content) => {
    const newComment = await API.addComment(projectId, itemId, content);
    // Real-time listener will also handle this, but we can update state immediately for speed
    dispatch({ type: 'ADD_COMMENT', payload: { itemId, comment: newComment } });
  };

  const updateComment = async (projectId, itemId, commentId, updates) => {
    const updated = await API.updateComment(projectId, itemId, commentId, updates);
    dispatch({ type: 'UPDATE_COMMENT', payload: { itemId, commentId, updates: updated } });
  };

  const deleteComment = async (projectId, itemId, commentId) => {
    await API.deleteComment(projectId, itemId, commentId);
    dispatch({ type: 'DELETE_COMMENT', payload: { itemId, commentId } });
  };

  const addSection = async (boardType, title) => {
    const newSection = await API.addSection(boardType, title);
    dispatch({ type: 'ADD_SECTION', payload: newSection });
  };

  // 신규: 일반 문서 관련 함수들
  const addGeneralDocument = async (boardType, title, type = 'document', parentFolderId = null, createdBy = null) => {
    const newDoc = await API.createGeneralDocument(boardType, title, type, parentFolderId, createdBy);
    dispatch({ type: 'ADD_GENERAL_DOC', payload: newDoc });
  };

  const updateGeneralDocument = async (itemId, updates) => {
    const doc = state.generalDocs.find(d => d.id === itemId);
    const boardType = doc?.board_type ?? 'main';
    const updated = await API.updateItem(null, itemId, updates, boardType);
    dispatch({ type: 'UPDATE_GENERAL_DOC', payload: { itemId, updates: updated } });
  };

  const deleteGeneralDocument = async (itemId) => {
    try {
      const doc = state.generalDocs.find(d => d.id === itemId);
      const boardType = doc?.board_type ?? 'main';
      await API.deleteGeneralDocument(itemId, boardType);
      dispatch({ type: 'DELETE_GENERAL_DOC', payload: itemId });
    } catch (err) {
      console.error('[deleteGeneralDocument] error:', err);
      throw err;
    }
  };

  const moveGeneralDocument = async (itemId, newIndex) => {
    const doc = state.generalDocs.find(d => d.id === itemId);
    const boardType = doc?.board_type ?? 'main';
    dispatch({ type: 'MOVE_GENERAL_DOC', payload: { itemId, newIndex } });
    await API.moveGeneralDocument(itemId, newIndex, boardType);
  };

  const addRequestDocument = async (boardType, title, createdBy = null, updates = {}) => {
    const newRequest = await API.createTeamRequest(boardType, title, createdBy, updates);
    dispatch({ type: 'ADD_REQUEST_DOC', payload: newRequest });
    return newRequest;
  };

  const updateRequestDocument = async (requestId, updates) => {
    const updated = await API.updateTeamRequest(requestId, updates);
    dispatch({ type: 'UPDATE_REQUEST_DOC', payload: { requestId, updates: updated } });
  };

  const submitRequestDocument = async (requestId) => {
    const submitted = await API.submitTeamRequest(requestId);
    if (submitted) {
      dispatch({ type: 'UPDATE_REQUEST_DOC', payload: { requestId, updates: submitted } });
    }
    return submitted;
  };

  const deleteRequestDocument = async (requestId) => {
    await API.deleteTeamRequest(requestId);
    dispatch({ type: 'DELETE_REQUEST_DOC', payload: requestId });
  };

  const moveRequestDocument = async (requestId, newIndex) => {
    dispatch({ type: 'MOVE_REQUEST_DOC', payload: { requestId, newIndex } });
    await API.moveTeamRequest(requestId, newIndex);
  };

  const setBoardType = useCallback((boardType) => {
    dispatch({ type: 'SET_BOARD_TYPE', payload: boardType });
  }, []);

  const updateSection = async (sectionId, updates) => {
    const updated = await API.updateSection(sectionId, updates);
    dispatch({ type: 'UPDATE_SECTION', payload: { id: sectionId, updates: updated } });
  };

  const deleteSection = async (sectionId) => {
    await API.deleteSection(sectionId);
    dispatch({ type: 'DELETE_SECTION', payload: sectionId });
  };

  const moveSection = async (sectionId, targetIndex, boardType) => {
    dispatch({ type: 'MOVE_SECTION', payload: { sectionId, targetIndex, boardType } });
    await API.moveSection(sectionId, targetIndex, boardType);
  };

  const moveSidebarItem = async (sourceProjectId, targetProjectId, itemId, targetIndex, targetParentId = null) => {
    const snapshot = cloneProjectsSnapshot(state.projects);
    const project = state.projects.find(p => p.id === sourceProjectId);
    const boardType = project?.board_type ?? 'main';
    const payload = { sourceProjectId, targetProjectId, itemId, targetIndex, targetParentId };
    dispatch({ type: 'SIDEBAR_MOVE_ITEM', payload });

    try {
      await API.moveItem(sourceProjectId, targetProjectId, itemId, targetIndex, targetParentId, boardType);
    } catch (err) {
      dispatch({ type: 'RESTORE_PROJECTS', payload: { projects: snapshot } });
      throw err;
    }
  };

  const updateTeamBoard = useCallback(async (boardType, updates) => {
    // updates = { description?: string, pinned_doc_ids?: string[] }
    dispatch({ type: 'UPDATE_TEAM_BOARD', boardType, updates });
    try {
      await API.upsertTeamBoardConfig(boardType, updates);
    } catch (err) {
      console.error('[updateTeamBoard] Error:', err.message);
      throw err;
    }
  }, []);

  const moveSidebarProject = async (projectId, targetSectionId, targetIndex) => {
    const snapshot = cloneProjectsSnapshot(state.projects);
    const project = state.projects.find(p => p.id === projectId);
    const boardType = project?.board_type ?? 'main';
    const payload = { projectId, targetSectionId, targetIndex };
    dispatch({ type: 'SIDEBAR_MOVE_PROJECT', payload });

    try {
      await API.moveProjectSidebar(projectId, targetSectionId, targetIndex, boardType);
    } catch (err) {
      dispatch({ type: 'RESTORE_PROJECTS', payload: { projects: snapshot } });
      throw err;
    }
  };

  return {
        projects: state.projects,
    sections: state.sections,
    generalDocs: state.generalDocs,  // 신규: 일반 문서 (팀별 분리)
    requestDocs: state.requestDocs,  // 신규: 개발팀 요청 테이블
    team_boards: state.team_boards,  // 신규: 팀 보드 설정 (보드 하단 설명)
    currentBoardType: state.currentBoardType,  // 신규: 현재 보드 타입
    loading: state.loading,
    error: state.error,
        addProject,
        updateProject,
        deleteProject,
        completeProject,
        moveProject,
    addItem,
    updateItem,
    deleteItem,
    moveItem,
    addChildPage,
    addComment,
    updateComment,
    deleteComment,
    addSection,
    updateSection,
    deleteSection,
    moveSection,
    // 신규: 일반 문서 함수들
    addGeneralDocument,
    updateGeneralDocument,
    deleteGeneralDocument,
    moveGeneralDocument,
    addRequestDocument,
    updateRequestDocument,
    submitRequestDocument,
    deleteRequestDocument,
    moveRequestDocument,
    updateTeamBoard,  // 신규: 팀 보드 설정 업데이트
    setBoardType,
    moveSidebarItem,
    moveSidebarProject,
  };
};
