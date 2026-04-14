/**
 * @fileoverview 앱 전체 접속자 프로필 아바타 + 미니 반응 팝오버.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import API from '../api/kanbanAPI';
import { usePresenceContext } from '../hooks/usePresenceContext';
import ProfileAvatar from './ProfileAvatar';
import { REACTION_META, REACTION_TYPES } from '../lib/profileAppearance';

const MAX_VISIBLE = 5;

export default function PresenceAvatars() {
  const { onlineUsers, currentUserId } = usePresenceContext();
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [reactionSummary, setReactionSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [reactingType, setReactingType] = useState(null);
  const popoverRef = useRef(null);

  const visibleUsers = useMemo(() => onlineUsers.slice(0, MAX_VISIBLE), [onlineUsers]);
  const selectedUser = useMemo(
    () => onlineUsers.find((user) => user.userId === selectedUserId) || null,
    [onlineUsers, selectedUserId]
  );

  useEffect(() => {
    if (!selectedUserId) return;
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setSelectedUserId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) {
      setReactionSummary(null);
      return;
    }
    let mounted = true;
    const loadSummary = async () => {
      setLoadingSummary(true);
      try {
        const summary = await API.getProfileReactionSummary(selectedUserId, 24);
        if (mounted) setReactionSummary(summary);
      } catch (error) {
        if (mounted) {
          console.warn('[PresenceAvatars] reaction summary load failed:', error.message);
          setReactionSummary({
            counts: Object.fromEntries(REACTION_TYPES.map((type) => [type, 0])),
            myReactions: {},
          });
        }
      } finally {
        if (mounted) setLoadingSummary(false);
      }
    };
    loadSummary();
    return () => {
      mounted = false;
    };
  }, [selectedUserId]);

  if (onlineUsers.length === 0) return null;

  const overflow = onlineUsers.length - MAX_VISIBLE;

  const handleToggleReaction = async (reactionType) => {
    if (!selectedUserId || selectedUserId === currentUserId) return;
    try {
      setReactingType(reactionType);
      const summary = await API.toggleProfileReaction(selectedUserId, reactionType);
      setReactionSummary(summary);
    } catch (error) {
      console.warn('[PresenceAvatars] reaction toggle failed:', error.message);
    } finally {
      setReactingType(null);
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <div className="flex items-center" title={`접속 중: ${onlineUsers.map((u) => u.name).join(', ')}`}>
        <div className="flex -space-x-2">
          {visibleUsers.map((user) => (
            <button
              key={user.userId}
              type="button"
              onClick={() => setSelectedUserId((prev) => (prev === user.userId ? null : user.userId))}
              className="cursor-pointer"
            >
              <ProfileAvatar
                name={user.name}
                size="sm"
                customization={{
                  avatarStyle: user.avatarStyle,
                  themeColor: user.themeColor,
                  moodEmoji: user.moodEmoji,
                }}
                title={user.name}
              />
            </button>
          ))}
          {overflow > 0 && (
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-bg-elevated flex items-center justify-center text-gray-600 dark:text-text-secondary text-xs font-black border-2 border-white dark:border-bg-base shadow-sm">
              +{overflow}
            </div>
          )}
        </div>
      </div>

      {selectedUser && (
        <div className="absolute right-0 top-11 z-[1050] w-72 rounded-2xl border border-gray-100 dark:border-border-subtle bg-white dark:bg-bg-elevated shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <ProfileAvatar
              name={selectedUser.name}
              customization={{
                avatarStyle: selectedUser.avatarStyle,
                themeColor: selectedUser.themeColor,
                moodEmoji: selectedUser.moodEmoji,
              }}
              size="md"
            />
            <div className="min-w-0">
              <p className="text-sm font-black text-gray-900 dark:text-text-primary truncate">{selectedUser.name}</p>
              <p className="text-xs text-gray-500 dark:text-text-tertiary truncate">
                {selectedUser.statusMessage || '상태 메시지가 없습니다.'}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-border-subtle pt-3">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-400 dark:text-text-tertiary mb-2">
              24시간 반응
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {REACTION_TYPES.map((type) => {
                const meta = REACTION_META[type];
                const count = reactionSummary?.counts?.[type] || 0;
                const isMine = Boolean(reactionSummary?.myReactions?.[type]);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleToggleReaction(type)}
                    disabled={loadingSummary || reactingType === type || selectedUser.userId === currentUserId}
                    className={`rounded-xl border px-1 py-1.5 flex flex-col items-center gap-1 text-xs transition-colors ${
                      isMine
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-border-subtle hover:border-gray-300 dark:hover:border-border-strong'
                    } ${
                      selectedUser.userId === currentUserId ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                    }`}
                    title={meta.label}
                  >
                    <span className="text-base leading-none">{meta.emoji}</span>
                    <span className="font-bold text-gray-600 dark:text-text-secondary">{count}</span>
                  </button>
                );
              })}
            </div>
            {selectedUser.userId === currentUserId && (
              <p className="text-[11px] text-gray-400 dark:text-text-tertiary mt-2">내 프로필에는 반응할 수 없어요.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
