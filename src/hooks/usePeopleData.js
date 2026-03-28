/**
 * @fileoverview 피플 보드 전용 데이터 훅. 팀원별 assigned items를 부서 단위로 그룹화.
 *
 * kanbanAPI.getPeopleData()를 호출하여 profiles → teams → members → tasks 트리 구조 반환.
 * useKanbanData와 독립적 — 피플 뷰 전용으로 별도 로드.
 *
 * @returns {{ teams, loading, error, refetch }}
 * teams: [{ teamName, members: [{ id, name, department, tasks: [...] }] }]
 */
import { useCallback, useEffect, useReducer } from 'react';
import API from '../api/kanbanAPI';

const INITIAL_STATE = {
  teams: [],
  loading: true,
  error: null,
};

const peopleReducer = (state, action) => {
  switch (action.type) {
    case 'SET_DATA':
      return { ...state, teams: action.payload, loading: false, error: null };
    case 'SET_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: true, error: null };
    default:
      return state;
  }
};

export const usePeopleData = () => {
  const [state, dispatch] = useReducer(peopleReducer, INITIAL_STATE);

  const fetchPeopleData = useCallback(async () => {
    dispatch({ type: 'SET_LOADING' });
    try {
      const data = await API.getPeopleData();
      dispatch({ type: 'SET_DATA', payload: data.teams });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
    }
  }, []);

  useEffect(() => {
    fetchPeopleData();
  }, [fetchPeopleData]);

  return {
    teams: state.teams,
    loading: state.loading,
    error: state.error,
    refetch: fetchPeopleData,
  };
};
