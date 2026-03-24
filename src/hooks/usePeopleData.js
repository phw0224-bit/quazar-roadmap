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
