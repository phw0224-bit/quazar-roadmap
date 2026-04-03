/**
 * @fileoverview Presence 상태를 보드 전역에서 공유하는 Context.
 *
 * KanbanBoard에서 만든 onlineUsers/updateEditing/currentUserId를
 * PresenceAvatars와 ItemViewers가 prop drilling 없이 소비하도록 묶는다.
 */
import { createContext, useContext } from 'react';

export const PresenceContext = createContext({
  onlineUsers: [],
  updateEditing: () => {},
  currentUserId: null,
});

export function usePresenceContext() {
  return useContext(PresenceContext);
}
