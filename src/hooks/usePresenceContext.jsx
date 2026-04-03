import { createContext, useContext } from 'react';

export const PresenceContext = createContext({
  onlineUsers: [],
  updateEditing: () => {},
  currentUserId: null,
});

export function usePresenceContext() {
  return useContext(PresenceContext);
}
