import { useEffect, useReducer, useCallback } from 'react';
import API from '../api/kanbanAPI';
import { supabase } from '../lib/supabase';

const INITIAL_STATE = {
  phases: [],
  loading: true,
  error: null,
};

const kanbanReducer = (state, action) => {
  switch (action.type) {
    case 'SET_DATA':
      return { ...state, phases: action.payload, loading: false };
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
    case 'MOVE_PHASE':
      const newPhases = [...state.phases];
      const movingIdx = newPhases.findIndex(p => p.id === action.payload.phaseId);
      const [movingPhase] = newPhases.splice(movingIdx, 1);
      newPhases.splice(action.payload.targetIndex, 0, movingPhase);
      return { ...state, phases: newPhases };
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
    case 'MOVE_ITEM':
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
      dispatch({ type: 'SET_DATA', payload: data.phases });
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

  const addPhase = async (title, boardType = 'main') => {
    const newPhase = await API.addPhase(title, boardType);
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

  const moveItem = async (sourcePhaseId, targetPhaseId, itemId, targetIndex) => {
    dispatch({ type: 'MOVE_ITEM', payload: { sourcePhaseId, targetPhaseId, itemId, targetIndex } });
    await API.moveItem(sourcePhaseId, targetPhaseId, itemId, targetIndex);
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

  return {
    phases: state.phases,
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
    addComment,
    updateComment,
    deleteComment,
  };
};
