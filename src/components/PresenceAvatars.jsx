/**
 * @fileoverview 앱 전체 접속자를 겹친 이니셜 아바타로 표시하는 헤더 컴포넌트.
 *
 * userId 해시 기반 고정 색상을 사용해 같은 사람은 항상 같은 색으로 표시된다.
 * 최대 5개 표시 후 초과 인원은 +N 배지로 표시한다.
 */
import { usePresenceContext } from '../hooks/usePresenceContext';

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-indigo-500',
];

function hashColor(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const MAX_VISIBLE = 5;

export default function PresenceAvatars() {
  const { onlineUsers } = usePresenceContext();

  if (onlineUsers.length === 0) return null;

  const visible = onlineUsers.slice(0, MAX_VISIBLE);
  const overflow = onlineUsers.length - MAX_VISIBLE;

  return (
    <div className="flex items-center" title={`접속 중: ${onlineUsers.map(u => u.name).join(', ')}`}>
      <div className="flex -space-x-2">
        {visible.map((user) => (
          <div
            key={user.userId}
            className={`relative w-8 h-8 rounded-full ${hashColor(user.userId)} flex items-center justify-center text-white text-xs font-black border-2 border-white dark:border-bg-base shadow-sm`}
            title={user.name}
          >
            {user.name.charAt(0)}
          </div>
        ))}
        {overflow > 0 && (
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-bg-elevated flex items-center justify-center text-gray-600 dark:text-text-secondary text-xs font-black border-2 border-white dark:border-bg-base shadow-sm">
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
