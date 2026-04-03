/**
 * @fileoverview 특정 아이템을 현재 보거나 편집 중인 사람을 표시하는 컴포넌트.
 *
 * PresenceContext에서 onlineUsers를 가져와 itemId로 필터링한다.
 * 자기 자신(currentUserId)은 목록에서 제외한다.
 * 아무도 없으면 null을 반환해 공간을 차지하지 않는다.
 */
import { usePresenceContext } from '../hooks/usePresenceContext';

const FIELD_LABEL = {
  title: '제목',
  tags: '태그',
  assignees: '담당자',
  description: '본문',
};

export default function ItemViewers({ itemId }) {
  const { onlineUsers, currentUserId } = usePresenceContext();

  const viewers = onlineUsers.filter(
    (u) => u.itemId === itemId && u.userId !== currentUserId
  );

  if (viewers.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-2 border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-elevated)]/50">
      {viewers.map((user) => (
        <span
          key={user.userId}
          className="flex items-center gap-1 text-xs text-[color:var(--color-text-secondary)]"
        >
          {user.editingField ? (
            <>
              <span>✏️</span>
              <span className="font-semibold text-[color:var(--color-text-primary)]">{user.name}</span>
              <span>{FIELD_LABEL[user.editingField] || user.editingField} 편집 중</span>
            </>
          ) : (
            <>
              <span>👁</span>
              <span className="font-semibold text-[color:var(--color-text-primary)]">{user.name}</span>
            </>
          )}
        </span>
      ))}
    </div>
  );
}
