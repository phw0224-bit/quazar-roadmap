/**
 * @fileoverview ProjectColumn 메뉴를 컬럼 헤더의 반투명/드래그 레이어에서 분리하기 위한 오버레이 규칙.
 *
 * 메뉴를 body 포털에 fixed로 렌더해 backdrop-blur 헤더나 카드 DnD 레이어의 영향을 받지 않게 한다.
 * ProjectColumn.jsx가 이 파일의 위치 계산과 표면 클래스를 사용해 메뉴의 불투명도와 클릭 차단을 보장한다.
 */

export const PROJECT_MENU_SURFACE_CLASS = 'fixed z-[1210] min-w-[180px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl pointer-events-auto dark:border-border-subtle dark:bg-bg-elevated';

/**
 * @description 프로젝트 메뉴를 트리거 버튼 기준으로 배치하되 화면 밖으로 나가지 않게 보정한다.
 * @param {Object} triggerRect - `getBoundingClientRect()` 결과 중 top/right/bottom을 포함한 객체
 * @param {Object} options - 메뉴 크기와 viewport 정보. `{ menuWidth, menuHeight, viewportWidth, viewportHeight }`
 * @returns {Object} `{ left, top, transformOrigin }`
 */
export function getProjectMenuPosition(triggerRect, options = {}) {
  const {
    menuWidth = 180,
    menuHeight = 220,
    viewportWidth = 0,
    viewportHeight = 0,
    offset = 8,
    margin = 12,
  } = options;

  const preferredLeft = triggerRect.right - menuWidth;
  const maxLeft = Math.max(margin, viewportWidth - menuWidth - margin);
  const left = Math.min(Math.max(preferredLeft, margin), maxLeft);

  const fitsBelow = triggerRect.bottom + offset + menuHeight <= viewportHeight - margin;
  const top = fitsBelow
    ? triggerRect.bottom + offset
    : Math.max(margin, triggerRect.top - menuHeight - offset);

  return {
    left,
    top,
    transformOrigin: fitsBelow ? 'top right' : 'bottom right',
  };
}
