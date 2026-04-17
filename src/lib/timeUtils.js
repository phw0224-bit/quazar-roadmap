/**
 * 시간차를 한국어 상대 시간으로 변환
 * @param {string | Date} dateString - ISO 8601 형식 또는 Date 객체
 * @returns {string} "방금", "N분 전", "N시간 전" 등의 형식
 */
export function timeAgo(dateString) {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diffMs = now - date;

  if (diffMs < 0) return '방금';

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;

  return date.toLocaleDateString('ko-KR');
}
