import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import API from '../api/kanbanAPI';

function formatRelativeTime(value) {
  if (!value) return '';

  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const formatter = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });

  if (Math.abs(diffMinutes) < 1) return '방금 전';
  if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, 'minute');

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, 'hour');

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) return formatter.format(diffDays, 'day');

  return date.toLocaleDateString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getNotificationMessage(notification) {
  const actorName = notification.actor_profile?.name || '누군가';
  const entityTitle = notification.payload?.entity_title || '제목 없는 항목';

  if (notification.type === 'assignment_added') {
    return `${actorName}님이 "${entityTitle}"에 담당자로 지정했습니다.`;
  }

  return `${actorName}님이 "${entityTitle}"와 관련된 알림을 보냈습니다.`;
}

export default function NotificationsInbox({ user, onOpenNotification, onShowToast }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const containerRef = useRef(null);

  const hasUnread = unreadCount > 0;
  const visibleNotifications = useMemo(() => notifications.slice(0, 12), [notifications]);

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    if (!silent) setLoading(true);
    try {
      const result = await API.getNotifications(20);
      setNotifications(result.notifications || []);
      setUnreadCount(result.unreadCount || 0);
    } catch (error) {
      if (!silent) {
        onShowToast?.(`알림을 불러오지 못했습니다: ${error.message}`, 'error');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [onShowToast, user?.id]);

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!user?.id) return undefined;

    const intervalId = window.setInterval(() => {
      loadNotifications({ silent: true });
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [loadNotifications, user?.id]);

  const handleToggleOpen = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      await loadNotifications();
    }
  };

  const applyReadUpdates = (readRows = []) => {
    const readAtById = new Map((readRows || []).map((row) => [row.id, row.read_at]));

    if (readAtById.size === 0) return;

    setNotifications((current) =>
      current.map((notification) => (
        readAtById.has(notification.id)
          ? { ...notification, read_at: readAtById.get(notification.id) }
          : notification
      ))
    );
    setUnreadCount((current) => Math.max(0, current - readAtById.size));
  };

  const handleOpenItem = async (notification) => {
    try {
      if (!notification.read_at) {
        const readRows = await API.markNotificationsAsRead([notification.id]);
        applyReadUpdates(readRows);
      }
      setOpen(false);
      await onOpenNotification?.(notification);
    } catch (error) {
      onShowToast?.(`알림을 여는 중 오류가 발생했습니다: ${error.message}`, 'error');
    }
  };

  const handleMarkAllRead = async () => {
    if (!hasUnread) return;

    try {
      setMarkingAll(true);
      const readRows = await API.markAllNotificationsAsRead();
      applyReadUpdates(readRows);
    } catch (error) {
      onShowToast?.(`알림 읽음 처리 실패: ${error.message}`, 'error');
    } finally {
      setMarkingAll(false);
    }
  };

  if (!user?.id) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggleOpen}
        className="relative h-9 w-9 rounded-xl border border-gray-200 dark:border-border-subtle bg-white dark:bg-bg-elevated text-gray-500 dark:text-text-secondary hover:text-gray-900 dark:hover:text-text-primary hover:border-gray-300 dark:hover:border-border-strong transition-colors cursor-pointer flex items-center justify-center"
        title="알림"
      >
        <Bell size={16} />
        {hasUnread && (
          <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-[1100] w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-100 dark:border-border-subtle bg-white dark:bg-bg-elevated shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-border-subtle">
            <div>
              <p className="text-sm font-black text-gray-900 dark:text-text-primary">알림</p>
              <p className="text-[11px] text-gray-500 dark:text-text-tertiary">
                최근 담당자 지정 알림을 확인합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={!hasUnread || markingAll}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                hasUnread
                  ? 'text-gray-700 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-bg-hover cursor-pointer'
                  : 'text-gray-300 dark:text-text-tertiary cursor-not-allowed'
              }`}
            >
              <CheckCheck size={14} />
              모두 읽음
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="px-4 py-8 text-sm text-center text-gray-500 dark:text-text-tertiary">
                알림을 불러오는 중입니다.
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="px-4 py-8 text-sm text-center text-gray-500 dark:text-text-tertiary">
                아직 도착한 알림이 없습니다.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-border-subtle">
                {visibleNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleOpenItem(notification)}
                    className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                      notification.read_at
                        ? 'bg-transparent hover:bg-gray-50 dark:hover:bg-bg-hover/60'
                        : 'bg-brand-50/60 dark:bg-brand-800/10 hover:bg-brand-50 dark:hover:bg-brand-800/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 h-2.5 w-2.5 rounded-full ${notification.read_at ? 'bg-gray-200 dark:bg-border-subtle' : 'bg-brand-500'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-text-primary leading-5 break-words">
                          {getNotificationMessage(notification)}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500 dark:text-text-tertiary">
                          <span>{notification.payload?.board_type === 'main' ? '전사 로드맵' : notification.payload?.board_type || '팀 보드'}</span>
                          <span>·</span>
                          <span>{formatRelativeTime(notification.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
