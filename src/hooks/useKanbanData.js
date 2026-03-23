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
    case 'LOAD_BOARD':
      return { ...state, phases: action.payload, loading: false };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    // --- 실시간 이벤트 처리 ---
    case 'REALTIME_PHASE_EVENT': {
      const { eventType, new: newPhase, old: oldPhase } = action.payload;
      if (eventType === 'INSERT') {
        if (state.phases.some(p => p.id === newPhase.id)) return state;
        return { ...state, phases: [...state.phases, { ...newPhase, items: [] }].sort((a, b) => a.order_index - b.order_index) };
      }
      if (eventType === 'UPDATE') {
        return {
          ...state,
          phases: state.phases.map(p => p.id === newPhase.id ? { ...p, ...newPhase } : p).sort((a, b) => a.order_index - b.order_index)
        };
      }
      if (eventType === 'DELETE') {
        return { ...state, phases: state.phases.filter(p => p.id !== oldPhase.id) };
      }
      return state;
    }

    case 'REALTIME_ITEM_EVENT': {
      const { eventType, new: newItem, old: oldItem } = action.payload;
      
      if (eventType === 'INSERT') {
        return {
          ...state,
          phases: state.phases.map(p => {
            if (p.id === newItem.phase_id) {
              if (p.items.some(i => i.id === newItem.id)) return p;
              return { ...p, items: [...p.items, { ...newItem, comments: [] }].sort((a, b) => a.order_index - b.order_index) };
            }
            return p;
          })
        };
      }

      if (eventType === 'UPDATE') {
        // 1. 기존 페이즈 찾기
        let prevPhaseId = null;
        for (const p of state.phases) {
          if (p.items.some(i => i.id === newItem.id)) {
            prevPhaseId = p.id;
            break;
          }
        }

        // 2. 페이즈가 바뀌었는지 확인
        if (prevPhaseId && prevPhaseId !== newItem.phase_id) {
          return {
            ...state,
            phases: state.phases.map(p => {
              if (p.id === prevPhaseId) {
                return { ...p, items: p.items.filter(i => i.id !== newItem.id) };
              }
              if (p.id === newItem.phase_id) {
                // 이미 있으면 업데이트만, 없으면 추가
                const exists = p.items.some(i => i.id === newItem.id);
                const baseItem = p.items.find(i => i.id === newItem.id) || { comments: [] };
                const updatedItems = exists 
                  ? p.items.map(i => i.id === newItem.id ? { ...i, ...newItem } : i)
                  : [...p.items, { ...newItem, ...baseItem }];
                return { ...p, items: updatedItems.sort((a, b) => a.order_index - b.order_index) };
              }
              return p;
            })
          };
        }

        // 동일 페이즈 내 업데이트
        return {
          ...state,
          phases: state.phases.map(p => p.id === newItem.phase_id ? {
            ...p,
            items: p.items.map(i => i.id === newItem.id ? { ...i, ...newItem } : i).sort((a, b) => a.order_index - b.order_index)
          } : p)
        };
      }

      if (eventType === 'DELETE') {
        return {
          ...state,
          phases: state.phases.map(p => ({
            ...p,
            items: p.items.filter(i => i.id !== oldItem.id)
          }))
        };
      }
      return state;
    }

    case 'REALTIME_COMMENT_EVENT': {
      const { eventType, new: newComment, old: oldComment } = action.payload;
      if (eventType === 'INSERT') {
        return {
          ...state,
          phases: state.phases.map(p => ({
            ...p,
            items: p.items.map(i => i.id === newComment.item_id ? {
              ...i,
              comments: i.comments.some(c => c.id === newComment.id) ? i.comments : [...i.comments, newComment]
            } : i)
          }))
        };
      }
      if (eventType === 'DELETE') {
        return {
          ...state,
          phases: state.phases.map(p => ({
            ...p,
            items: p.items.map(i => ({
              ...i,
              comments: i.comments.filter(c => c.id !== oldComment.id)
            }))
          }))
        };
      }
      return state;
    }

    // --- 기존 액션 (Optimistic UI를 위해 유지하되, 서버 신호와 부드럽게 병합) ---
    case 'ADD_PHASE':
      if (state.phases.some(p => p.id === action.payload.id)) return state;
      return { ...state, phases: [...state.phases, action.payload] };
    case 'UPDATE_PHASE':
      return {
        ...state,
        phases: state.phases.map((p) =>
          p.id === action.payload.id ? { ...p, ...action.payload.updates } : p
        ),
      };
    case 'DELETE_PHASE':
      return {
        ...state,
        phases: state.phases.filter((p) => p.id !== action.payload),
      };
    case 'MOVE_PHASE': {
      const { phaseId, targetIndex } = action.payload;
      const newPhases = [...state.phases];
      const phaseIndex = newPhases.findIndex((p) => p.id === phaseId);
      if (phaseIndex === -1) return state;
      const [phase] = newPhases.splice(phaseIndex, 1);
      newPhases.splice(targetIndex, 0, phase);
      return { ...state, phases: newPhases };
    }
    case 'ADD_ITEM':
      return {
        ...state,
        phases: state.phases.map((p) =>
          p.id === action.payload.phaseId
            ? { ...p, items: [...p.items, action.payload.item] }
            : p
        ),
      };
    case 'UPDATE_ITEM':
      return {
        ...state,
        phases: state.phases.map((p) =>
          p.id === action.payload.phaseId
            ? {
                ...p,
                items: p.items.map((i) =>
                  i.id === action.payload.itemId
                    ? { ...i, ...action.payload.updates }
                    : i
                ),
              }
            : p
        ),
      };
    case 'DELETE_ITEM':
      return {
        ...state,
        phases: state.phases.map((p) =>
          p.id === action.payload.phaseId
            ? { ...p, items: p.items.filter((i) => i.id !== action.payload.itemId) }
            : p
        ),
      };
    case 'MOVE_ITEM': {
      const { sourcePhaseId, targetPhaseId, itemId, item, targetIndex } = action.payload;
      
      if (sourcePhaseId === targetPhaseId) {
        return {
          ...state,
          phases: state.phases.map((p) => {
            if (p.id === sourcePhaseId) {
              const newItems = p.items.filter((i) => i.id !== itemId);
              newItems.splice(targetIndex, 0, item);
              return { ...p, items: newItems };
            }
            return p;
          }),
        };
      }
      
      return {
        ...state,
        phases: state.phases.map((p) => {
          if (p.id === sourcePhaseId) {
            return {
              ...p,
              items: p.items.filter((i) => i.id !== itemId),
            };
          }
          if (p.id === targetPhaseId) {
            const newItems = [...p.items];
            newItems.splice(targetIndex, 0, item);
            return { ...p, items: newItems };
          }
          return p;
        }),
      };
    }
    case 'ADD_COMMENT':
      return {
        ...state,
        phases: state.phases.map((p) =>
          p.id === action.payload.phaseId
            ? {
                ...p,
                items: p.items.map((i) =>
                  i.id === action.payload.itemId
                    ? {
                        ...i,
                        comments: i.comments.some(c => c.id === action.payload.comment.id) ? i.comments : [...i.comments, action.payload.comment],
                      }
                    : i
                ),
              }
            : p
        ),
      };
    default:
      return state;
  }
};

export const useKanbanData = () => {
  const [state, dispatch] = useReducer(kanbanReducer, INITIAL_STATE);

  const fetchBoardData = useCallback(async () => {
    try {
      const boardData = await API.getBoardData();
      dispatch({ type: 'LOAD_BOARD', payload: boardData.phases });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error.message || 'Failed to load board data',
      });
    }
  }, []);

  useEffect(() => {
    fetchBoardData();

    // --- 실시간 구독 설정 ---
    const phaseChannel = supabase
      .channel('realtime-phases')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'phases' }, (payload) => {
        dispatch({ type: 'REALTIME_PHASE_EVENT', payload });
      })
      .subscribe();

    const itemChannel = supabase
      .channel('realtime-items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (payload) => {
        dispatch({ type: 'REALTIME_ITEM_EVENT', payload });
      })
      .subscribe();

    const commentChannel = supabase
      .channel('realtime-comments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (payload) => {
        dispatch({ type: 'REALTIME_COMMENT_EVENT', payload });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(phaseChannel);
      supabase.removeChannel(itemChannel);
      supabase.removeChannel(commentChannel);
    };
  }, [fetchBoardData]);

  const addPhase = useCallback(
    async (phaseTitle) => {
      const PRESET_COLORS = ['blue', 'green', 'gold', 'purple', 'emerald', 'indigo', 'rose'];
      const randomColor = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
      try {
        const serverPhase = await API.addPhase(phaseTitle, randomColor);
        const newPhase = { ...serverPhase, color: randomColor, items: [] };
        dispatch({ type: 'ADD_PHASE', payload: newPhase });
        return newPhase;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
        throw error;
      }
    },
    []
  );

  const updatePhase = useCallback(async (phaseId, updates) => {
    try {
      await API.updatePhase(phaseId, updates);
      dispatch({ type: 'UPDATE_PHASE', payload: { id: phaseId, updates } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  }, []);

  const deletePhase = useCallback(async (phaseId) => {
    try {
      await API.deletePhase(phaseId);
      dispatch({ type: 'DELETE_PHASE', payload: phaseId });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  }, []);

  const movePhase = useCallback(async (phaseId, targetIndex) => {
    try {
      dispatch({ type: 'MOVE_PHASE', payload: { phaseId, targetIndex } });
      await API.movePhase(phaseId, targetIndex);
    } catch (error) {
      fetchBoardData();
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, [fetchBoardData]);

  const addItem = useCallback(
    async (phaseId, itemTitle, itemContent = '') => {
      try {
        const serverItem = await API.addItem(phaseId, itemTitle, itemContent);
        const newItem = { ...serverItem, comments: [] };
        dispatch({ type: 'ADD_ITEM', payload: { phaseId, item: newItem } });
        return newItem;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
        throw error;
      }
    },
    []
  );

  const updateItem = useCallback(async (phaseId, itemId, updates) => {
    try {
      await API.updateItem(phaseId, itemId, updates);
      dispatch({ type: 'UPDATE_ITEM', payload: { phaseId, itemId, updates } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  }, []);

  const deleteItem = useCallback(async (phaseId, itemId) => {
    try {
      await API.deleteItem(phaseId, itemId);
      dispatch({ type: 'DELETE_ITEM', payload: { phaseId, itemId } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  }, []);

  const moveItem = useCallback(
    async (sourcePhaseId, targetPhaseId, itemId, targetIndex) => {
      try {
        const sourcePhase = state.phases.find((p) => p.id === sourcePhaseId);
        const item = sourcePhase?.items.find((i) => i.id === itemId);

        if (item) {
          dispatch({
            type: 'MOVE_ITEM',
            payload: { sourcePhaseId, targetPhaseId, itemId, item, targetIndex },
          });
          await API.moveItem(sourcePhaseId, targetPhaseId, itemId, targetIndex);
        }
      } catch (error) {
        fetchBoardData();
        dispatch({ type: 'SET_ERROR', payload: error.message });
      }
    },
    [state.phases, fetchBoardData]
  );

  const addComment = useCallback(
    async (phaseId, itemId, content) => {
      try {
        const serverComment = await API.addComment(phaseId, itemId, content);
        dispatch({
          type: 'ADD_COMMENT',
          payload: { phaseId, itemId, comment: serverComment },
        });
        return serverComment;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
        throw error;
      }
    },
    []
  );

  const updateComment = useCallback(
    async (phaseId, itemId, commentId, updates) => {
      try {
        await API.updateComment(phaseId, itemId, commentId, updates);
        dispatch({
          type: 'UPDATE_COMMENT',
          payload: { phaseId, itemId, commentId, updates },
        });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
        throw error;
      }
    },
    []
  );

  const deleteComment = useCallback(
    async (phaseId, itemId, commentId) => {
      try {
        await API.deleteComment(phaseId, itemId, commentId);
        dispatch({
          type: 'DELETE_COMMENT',
          payload: { phaseId, itemId, commentId },
        });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
        throw error;
      }
    },
    []
  );

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
