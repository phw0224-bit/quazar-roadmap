/**
 * @fileoverview 아이템 엔티티 타입/문맥 판별 공통 헬퍼.
 *
 * UI 여러 지점(KanbanBoard, SearchModal 등)에서 동일 규칙을 재사용하기 위해
 * task/document/folder/memo/project 판별과 라벨 계산을 중앙화한다.
 */

export const ENTITY_TYPES = {
  TASK: 'task',
  DOCUMENT: 'document',
  FOLDER: 'folder',
  MEMO: 'memo',
  PROJECT: 'project',
};

/**
 * @param {Object|null|undefined} item
 * @returns {'task'|'document'|'folder'|'memo'|'project'}
 */
export function resolveEntityType(item) {
  if (!item) return ENTITY_TYPES.TASK;
  if (item.page_type === 'project') return ENTITY_TYPES.PROJECT;
  if (item.is_private) return ENTITY_TYPES.MEMO;
  if (item.page_type === 'folder') return ENTITY_TYPES.FOLDER;
  if (item.page_type === 'page') return ENTITY_TYPES.DOCUMENT;
  return ENTITY_TYPES.TASK;
}

/**
 * @param {{ item: Object|null|undefined, phase?: Object|null }} params
 * @returns {{
 *   type: 'task'|'document'|'folder'|'memo'|'project',
 *   boardType: string,
 *   collection: 'project'|'general'|'personal',
 * }}
 */
export function buildEntityContext({ item, phase = null }) {
  const type = resolveEntityType(item);
  const boardType = (phase?.board_type || item?.board_type || (type === ENTITY_TYPES.MEMO ? 'personal' : 'main'));
  let collection = 'project';

  if (type === ENTITY_TYPES.DOCUMENT || type === ENTITY_TYPES.FOLDER) {
    collection = item?.project_id ? 'project' : 'general';
  } else if (type === ENTITY_TYPES.MEMO) {
    collection = 'personal';
  }

  return { type, boardType, collection };
}

/**
 * @param {{ type: string, collection?: string }} context
 * @returns {string}
 */
export function getEntityLabel(context) {
  if (context?.type === ENTITY_TYPES.PROJECT) return '프로젝트';
  if (context?.type === ENTITY_TYPES.MEMO) return '개인 메모';
  if (context?.type === ENTITY_TYPES.FOLDER) return '일반 폴더';
  if (context?.type === ENTITY_TYPES.DOCUMENT) {
    return context?.collection === 'project' ? '프로젝트 문서' : '일반 문서';
  }
  return '업무';
}
