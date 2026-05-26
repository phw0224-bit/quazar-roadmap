/**
 * @fileoverview 브라우저 Notification API 접근을 캡슐화한다.
 *
 * 현재 앱이 열린 상태에서 새 알림 도착 시 데스크톱/브라우저 알림을 띄우는 용도다.
 * 백그라운드 Web Push(Service Worker 기반)는 별도 범위로 남겨둔다.
 */

export function isBrowserNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission() {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return window.Notification.permission;
}

export async function requestBrowserNotificationPermission() {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return window.Notification.requestPermission();
}

export function showBrowserNotification({ title, body, tag, onClick }) {
  if (!isBrowserNotificationSupported()) return null;
  if (window.Notification.permission !== 'granted') return null;

  const notification = new window.Notification(title, {
    body,
    tag,
    icon: '/pwa-192x192.png',
    badge: '/favicon-32x32.png',
    renotify: false,
  });

  if (typeof onClick === 'function') {
    notification.onclick = (event) => {
      event.preventDefault();
      onClick();
    };
  }

  return notification;
}
