/**
 * @fileoverview 목록 중심 Realtime 재조회 정책.
 *
 * 상세 본문(description) 편집은 로컬 autosave를 source of truth로 두고,
 * 목록 변화(추가/삭제)만 Realtime으로 전체 재조회한다.
 */

/**
 * @param {Object} payload - Supabase realtime postgres_changes payload
 * @returns {boolean} 전체 보드 재조회가 필요하면 true
 */
export function shouldRefetchBoardForEntryChange(payload) {
  const eventType = payload?.eventType;

  if (eventType === 'INSERT' || eventType === 'DELETE') {
    return true;
  }

  if (eventType === 'UPDATE') {
    return false;
  }

  return false;
}
