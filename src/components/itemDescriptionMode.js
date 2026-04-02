/**
 * @fileoverview 상세 설명 섹션의 기본 모드 선택 규칙.
 *
 * 읽기 전용 여부와 본문 존재 여부만으로 라이브/미리보기 초기 모드를 결정해
 * ItemDescriptionSection이 아이템 전환 시 일관된 첫 화면을 보여주도록 돕는다.
 */

/**
 * @description 상세 설명의 초기 보기 모드를 결정한다.
 * @param {Object} options - `{ isReadOnly, description }`
 * @returns {string} `'preview'|'live'`
 */
export function getInitialDescriptionMode({ isReadOnly, description }) {
  if (isReadOnly) return 'preview';

  return String(description || '').trim() ? 'preview' : 'live';
}
