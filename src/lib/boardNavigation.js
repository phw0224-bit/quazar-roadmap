export const MAIN_BOARD_TYPE = 'main';
export const TEAM_BOARD_TYPES = ['개발팀', 'AI팀', '지원팀'];
export const ALL_BOARD_TYPES = [MAIN_BOARD_TYPE, ...TEAM_BOARD_TYPES];

export function normalizeBoardType(boardType) {
  if (typeof boardType !== 'string') return MAIN_BOARD_TYPE;

  const trimmed = boardType.trim();
  if (!trimmed) return MAIN_BOARD_TYPE;

  return ALL_BOARD_TYPES.includes(trimmed) ? trimmed : MAIN_BOARD_TYPE;
}

export function getDefaultBoardType(user) {
  return normalizeBoardType(user?.user_metadata?.department);
}

export function isTeamBoard(boardType) {
  return normalizeBoardType(boardType) !== MAIN_BOARD_TYPE;
}

export function resolveBoardTypeForBoardView(boardType, fallbackBoardType) {
  const normalized = normalizeBoardType(boardType);
  if (isTeamBoard(normalized)) return normalized;
  return normalizeBoardType(fallbackBoardType);
}

export function getBoardSectionLabel(boardType) {
  const normalized = normalizeBoardType(boardType);
  if (normalized === MAIN_BOARD_TYPE) return '전사 로드맵';
  return `${normalized} 보드`;
}

