/**
 * @fileoverview Supabase Realtime Presence 채널 관리.
 *
 * board-presence 채널을 구독해 접속자 목록을 실시간으로 추적한다.
 * isReadOnly(비로그인) 사용자는 채널 구독 자체를 건너뛴다.
 * itemId 변경 시 track() 재호출로 현재 위치를 갱신한다.
 *
 * @returns {{ onlineUsers: Array, updateEditing: Function }}
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function usePresence({ user, itemId, isReadOnly }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const channelRef = useRef(null);
  const itemIdRef = useRef(itemId);
  const editingFieldRef = useRef(null);
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || '익명';

  // itemIdRef를 최신 값으로 유지 (클로저 문제 방지)
  useEffect(() => {
    itemIdRef.current = itemId;
  }, [itemId]);

  const syncPresenceState = useCallback((channel) => {
    const state = channel.presenceState();
    // userId 기준으로 중복 제거 (Map 사용해서 최신 상태만 유지)
    const userMap = new Map();
    Object.values(state).flat().forEach(p => {
      userMap.set(p.userId, {
        userId: p.userId,
        name: p.name,
        itemId: p.itemId ?? null,
        editingField: p.editingField ?? null,
      });
    });
    setOnlineUsers(Array.from(userMap.values()));
  }, []);

  // 채널 구독 (마운트 시 1회)
  useEffect(() => {
    if (isReadOnly || !user) return;

    const channel = supabase.channel('board-presence', {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        syncPresenceState(channel);
      })
      .on('presence', { event: 'leave' }, () => {
        syncPresenceState(channel);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: user.id,
            name: displayName,
            itemId: itemIdRef.current ?? null,
            editingField: null,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user, isReadOnly, syncPresenceState]);

  // itemId 변경 시 track() 재호출
  useEffect(() => {
    if (isReadOnly || !user || !channelRef.current) return;

    channelRef.current.track({
      userId: user.id,
      name: displayName,
      itemId: itemId ?? null,
      editingField: null,
    });

    // 아이템 닫힐 때 editingField도 초기화
    editingFieldRef.current = null;
  }, [itemId, user, isReadOnly]);

  /**
   * @description 편집 중인 필드를 Presence에 반영한다.
   * @param {string|null} field - 'title'|'tags'|'assignees'|'description'|null
   */
  const updateEditing = useCallback((field) => {
    if (isReadOnly || !user || !channelRef.current) return;
    editingFieldRef.current = field;
    channelRef.current.track({
      userId: user.id,
      name: displayName,
      itemId: itemIdRef.current ?? null,
      editingField: field ?? null,
    });
  }, [user, isReadOnly]);

  return { onlineUsers, updateEditing };
}
