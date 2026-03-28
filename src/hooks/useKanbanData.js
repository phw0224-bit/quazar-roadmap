/**
 * @fileoverview 전체 칸반 보드 상태의 단일 진실 소스(Single Source of Truth).
 *
 * useReducer로 phases/sections를 관리하고, Supabase Realtime으로 다른 클라이언트와 동기화.
 * 모든 CRUD 작업은 "dispatch 먼저 → API 호출 나중" 패턴(Optimistic Update)을 사용.
 *
 * 상태 구조:
 * - phases: 칸반 컬럼(project) 배열. 각 phase는 items 배열 내장.
 * - sections: 컬럼 그룹. phases와 별도 관리.
 * - page_type='page' 아이템은 SET_DATA에서 phases에서 제거됨 (사이드바 전용).
 */
import { useEffect, useReducer, useCallback } from 'react';
import API, { createChildPage } from '../api/kanbanAPI';
import { supabase } from '../lib/supabase';

const INITIAL_STATE = {
  phases: [],
  sections: [],
  loading: true,
  error: null,
};

/**
 * @description 칸반 보드의 모든 상태 변경을 처리하는 순수 함수.
 *
 * 지원 액션:
 * - SET_DATA: 초기 로드 또는 Realtime 재조회 후 전체 교체
 * - ADD/UPDATE/DELETE/MOVE_PHASE: 칸반 컬럼(project) CRUD
 * - ADD/UPDATE/DELETE/MOVE_ITEM: 카드(item) CRUD. MOVE는 cross-phase 지원
 * - ADD/UPDATE/DELETE_COMMENT: 댓글 CRUD
 * - ADD/UPDATE/DELETE/MOVE_SECTION: 섹션 그룹 CRUD
 * - ADD_CHILD_PAGE: page_type='page' 아이템 추가 (사이드바용)
 *
 * @param {Object} state - 현재 상태 { phases, sections, loading, error }
 * @param {Object} action - { type: string, payload: any }
 * @returns {Object} 새 상태 (항상 새 객체 반환, 불변성 유지)
 */
const kanbanReducer = (state, action) => {
  switch (action.type) {
    case 'SET_DATA':
      return { ...state, phases: action.payload.phases, sections: action.payload.sections, loading: false };
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
        phases: state.phases.map(p =>
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
    case 'ADD_PHASE':
      return { ...state, phases: [...state.phases, { ...action.payload, items: [] }] };
    case 'UPDATE_PHASE':
      return {
        ...state,
        phases: state.phases.map(p => p.id === action.payload.id ? { ...p, ...action.payload.updates } : p)
      };
    case 'DELETE_PHASE':
      return { ...state, phases: state.phases.filter(p => p.id !== action.payload) };
    case 'MOVE_PHASE': {
      const newPhases = [...state.phases];
      const movingIdx = newPhases.findIndex(p => p.id === action.payload.phaseId);
      const [movingPhase] = newPhases.splice(movingIdx, 1);
      newPhases.splice(action.payload.targetIndex, 0, movingPhase);
      return { ...state, phases: newPhases };
    }
    case 'ADD_ITEM':
      return {
        ...state,
        phases: state.phases.map(p => 
          p.id === action.payload.phaseId 
            ? { ...p, items: [...p.items, { ...action.payload.item, comments: [] }].sort((a, b) => a.order_index - b.order_index) }
            : p
        )
      };
    case 'UPDATE_ITEM':
      return {
        ...state,
        phases: state.phases.map(p => 
          p.id === action.payload.phaseId
            ? { ...p, items: p.items.map(i => i.id === action.payload.itemId ? { ...i, ...action.payload.updates } : i) }
            : p
        )
      };
    case 'DELETE_ITEM':
      return {
        ...state,
        phases: state.phases.map(p => 
          p.id === action.payload.phaseId
            ? { ...p, items: p.items.filter(i => i.id !== action.payload.itemId) }
            : p
        )
      };
    case 'MOVE_ITEM': {
      const { sourcePhaseId, targetPhaseId, itemId, targetIndex } = action.payload;

      const sourcePhase = state.phases.find(p => p.id === sourcePhaseId);
      const movingItem = sourcePhase.items.find(i => i.id === itemId);
      if (!movingItem) return state;

      // 같은 단계 내 이동인 경우
      if (sourcePhaseId === targetPhaseId) {
        return {
          ...state,
          phases: state.phases.map(p => {
            if (p.id === sourcePhaseId) {
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
        phases: state.phases.map(p => {
          if (p.id === sourcePhaseId) {
            return { ...p, items: p.items.filter(i => i.id !== itemId) };
          }
          if (p.id === targetPhaseId) {
            const newItems = [...p.items];
            newItems.splice(targetIndex, 0, { ...movingItem, project_id: targetPhaseId });
            return { ...p, items: newItems.map((item, idx) => ({ ...item, order_index: idx })) };
          }
          return p;
        })
      };
    }
    case 'ADD_CHILD_PAGE':
      return {
        ...state,
        phases: state.phases.map(p =>
          p.id === action.payload.phaseId
            ? { ...p, items: [...(p.items || []), { ...action.payload.newPage, comments: [] }].sort((a, b) => a.order_index - b.order_index) }
            : p
        ),
      };
    case 'ADD_COMMENT':
      return {
        ...state,
        phases: state.phases.map(p => ({
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
        phases: state.phases.map(p => ({
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
        phases: state.phases.map(p => ({
          ...p,
          items: p.items.map(i => 
            i.id === action.payload.itemId 
              ? { ...i, comments: i.comments.filter(c => c.id !== action.payload.commentId) }
              : i
          )
        }))
      };
    default:
      return state;
  }
};

export const useKanbanData = () => {
  const [state, dispatch] = useReducer(kanbanReducer, INITIAL_STATE);

  const fetchData = useCallback(async () => {
    try {
      const data = await API.getBoardData();
      dispatch({ type: 'SET_DATA', payload: { phases: data.phases, sections: data.sections } });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
    }
  }, []);

  useEffect(() => {
    fetchData();

    const fetchCommentWithProfile = async (commentId) => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, profiles(name, department)')
        .eq('id', commentId)
        .single();
      if (!error) return data;
      return null;
    };

    // Real-time Subscriptions
    const itemsChannel = supabase.channel('items-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => fetchData())
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

    const phasesChannel = supabase.channel('projects-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(phasesChannel);
    };
  }, [fetchData]);

  /**
   * @description 새 칸반 컬럼(Phase)을 추가. order_index는 현재 최대값+1 자동 계산.
   * @param {string} title - 컬럼 제목
   * @param {string} [boardType='main'] - 'main'|'개발팀'|'AI팀'|'지원팀'
   * @param {string|null} [sectionId=null] - 속할 섹션 ID. null이면 섹션 없는 컬럼
   */
  const addPhase = async (title, boardType = 'main', sectionId = null) => {
    const newPhase = await API.addPhase(title, boardType, sectionId);
    dispatch({ type: 'ADD_PHASE', payload: newPhase });
  };

  const updatePhase = async (phaseId, updates) => {
    const updated = await API.updatePhase(phaseId, updates);
    dispatch({ type: 'UPDATE_PHASE', payload: { id: phaseId, updates: updated } });
  };

  const deletePhase = async (phaseId) => {
    await API.deletePhase(phaseId);
    dispatch({ type: 'DELETE_PHASE', payload: phaseId });
  };

  const movePhase = async (phaseId, targetIndex) => {
    dispatch({ type: 'MOVE_PHASE', payload: { phaseId, targetIndex } });
    await API.movePhase(phaseId, targetIndex);
  };

  const addItem = async (phaseId, title, content) => {
    const newItem = await API.addItem(phaseId, title, content);
    dispatch({ type: 'ADD_ITEM', payload: { phaseId, item: newItem } });
  };

  const updateItem = async (phaseId, itemId, updates) => {
    const updated = await API.updateItem(phaseId, itemId, updates);
    dispatch({ type: 'UPDATE_ITEM', payload: { phaseId, itemId, updates: updated } });
  };

  const deleteItem = async (phaseId, itemId) => {
    await API.deleteItem(phaseId, itemId);
    dispatch({ type: 'DELETE_ITEM', payload: { phaseId, itemId } });
  };

  /**
   * @description 아이템을 다른 Phase로 이동 또는 같은 Phase 내 재정렬.
   * Optimistic: dispatch로 UI 즉시 반영 후 API 호출.
   * 이동 후 source/target phase 양쪽의 order_index 전체 재계산.
   * @param {string} sourcePhaseId - 원래 phase ID
   * @param {string} targetPhaseId - 목적 phase ID (같은 phase면 재정렬)
   * @param {string} itemId - 이동할 아이템 ID
   * @param {number} targetIndex - 목적 phase에서의 위치 (0-based)
   */
  const moveItem = async (sourcePhaseId, targetPhaseId, itemId, targetIndex) => {
    dispatch({ type: 'MOVE_ITEM', payload: { sourcePhaseId, targetPhaseId, itemId, targetIndex } });
    await API.moveItem(sourcePhaseId, targetPhaseId, itemId, targetIndex);
  };

  /**
   * @description page_type='page' 아이템(문서 페이지)을 생성하고 부모 아이템과 양방향 연결.
   * 칸반 카드가 아닌 중첩 페이지 생성 시 사용. 사이드바 트리에 표시됨.
   * 부모의 related_items에도 자동으로 추가됨.
   * @param {string} phaseId - 속할 phase ID
   * @param {string} parentItemId - 부모 아이템 ID (related_items 양방향 연결)
   * @param {string} title - 페이지 제목
   */
  const addChildPage = async (phaseId, parentItemId, title) => {
    const newPage = await createChildPage(phaseId, parentItemId, title);
    
    // 1. 하위 페이지(자기 자신)의 related_items에 부모 페이지를 추가 (상위 페이지 연결)
    if (parentItemId) {
      await updateItem(phaseId, newPage.id, {
        related_items: [parentItemId]
      });
      // 로컬 상태 동기화를 위해 newPage 객체 업데이트
      newPage.related_items = [parentItemId];
    }

    // 2. 부모 아이템의 related_items에도 하위 페이지를 추가 (양방향 연결)
    if (parentItemId) {
      const parentPhase = state.phases.find(p => p.id === phaseId);
      const parentItem = parentPhase?.items.find(i => i.id === parentItemId);
      if (parentItem) {
        const currentRelations = parentItem.related_items || [];
        if (!currentRelations.includes(newPage.id)) {
          await updateItem(phaseId, parentItemId, { 
            related_items: [...currentRelations, newPage.id] 
          });
        }
      }
    }

    dispatch({ type: 'ADD_CHILD_PAGE', payload: { phaseId, newPage } });
    return newPage;
  };

  const addComment = async (phaseId, itemId, content) => {
    const newComment = await API.addComment(phaseId, itemId, content);
    // Real-time listener will also handle this, but we can update state immediately for speed
    dispatch({ type: 'ADD_COMMENT', payload: { itemId, comment: newComment } });
  };

  const updateComment = async (phaseId, itemId, commentId, updates) => {
    const updated = await API.updateComment(phaseId, itemId, commentId, updates);
    dispatch({ type: 'UPDATE_COMMENT', payload: { itemId, commentId, updates: updated } });
  };

  const deleteComment = async (phaseId, itemId, commentId) => {
    await API.deleteComment(phaseId, itemId, commentId);
    dispatch({ type: 'DELETE_COMMENT', payload: { itemId, commentId } });
  };

  const addSection = async (boardType, title) => {
    const newSection = await API.addSection(boardType, title);
    dispatch({ type: 'ADD_SECTION', payload: newSection });
  };

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

  return {
    phases: state.phases,
    sections: state.sections,
    loading: state.loading,
    error: state.error,
    addPhase,
    updatePhase,
    deletePhase,
    movePhase,
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
  };
};
