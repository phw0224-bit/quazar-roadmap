/**
 * @fileoverview 상세 설명 섹션의 기본 모드 선택 규칙.
 *
 * 읽기 전용 여부와 본문 존재 여부만으로 라이브/미리보기 초기 모드를 결정해
 * ItemDescriptionSection이 아이템 전환 시 일관된 첫 화면을 보여주도록 돕는다.
 */

const DESCRIPTION_MODE_STORAGE_KEY = 'item-description-mode';
const VALID_DESCRIPTION_MODES = new Set(['live', 'split', 'preview']);

/**
 * @description 상세 설명의 초기 보기 모드를 결정한다.
 * @param {Object} options - `{ isReadOnly }`
 * @returns {string} `'preview'|'live'|'split'`
 */
export function getInitialDescriptionMode({ isReadOnly }) {
  if (isReadOnly) return 'preview';

  if (typeof window !== 'undefined') {
    const savedMode = window.localStorage.getItem(DESCRIPTION_MODE_STORAGE_KEY);
    if (VALID_DESCRIPTION_MODES.has(savedMode)) {
      return savedMode;
    }

    if (window.matchMedia?.('(min-width: 1280px)').matches) {
      return 'split';
    }
  }

  return 'live';
}

export function persistDescriptionMode(mode) {
  if (typeof window === 'undefined') return;
  if (!VALID_DESCRIPTION_MODES.has(mode)) return;
  window.localStorage.setItem(DESCRIPTION_MODE_STORAGE_KEY, mode);
}
