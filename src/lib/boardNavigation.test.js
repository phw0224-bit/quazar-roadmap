import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAIN_BOARD_TYPE,
  TEAM_BOARD_TYPES,
  getBoardSectionLabel,
  getDefaultBoardType,
  isTeamBoard,
  normalizeBoardType,
  resolveBoardTypeForBoardView,
} from './boardNavigation.js';

test('normalizeBoardType only allows known boards', () => {
  assert.equal(normalizeBoardType('개발팀'), '개발팀');
  assert.equal(normalizeBoardType('AI팀'), 'AI팀');
  assert.equal(normalizeBoardType('지원팀'), '지원팀');
  assert.equal(normalizeBoardType('main'), MAIN_BOARD_TYPE);
  assert.equal(normalizeBoardType('unknown'), MAIN_BOARD_TYPE);
  assert.equal(normalizeBoardType(''), MAIN_BOARD_TYPE);
});

test('getDefaultBoardType uses the user department when available', () => {
  assert.equal(getDefaultBoardType({ user_metadata: { department: '개발팀' } }), '개발팀');
  assert.equal(getDefaultBoardType({ user_metadata: { department: 'AI팀' } }), 'AI팀');
  assert.equal(getDefaultBoardType({ user_metadata: { department: '지원팀' } }), '지원팀');
  assert.equal(getDefaultBoardType({ user_metadata: { department: '기획팀' } }), MAIN_BOARD_TYPE);
  assert.equal(getDefaultBoardType(null), MAIN_BOARD_TYPE);
});

test('resolveBoardTypeForBoardView falls back to the default team board', () => {
  assert.equal(resolveBoardTypeForBoardView('개발팀', 'AI팀'), '개발팀');
  assert.equal(resolveBoardTypeForBoardView('main', '개발팀'), '개발팀');
  assert.equal(resolveBoardTypeForBoardView(null, '지원팀'), '지원팀');
});

test('board helpers expose the expected labels', () => {
  assert.equal(getBoardSectionLabel('main'), '전사 로드맵');
  assert.equal(getBoardSectionLabel('개발팀'), '개발팀 보드');
  assert.equal(isTeamBoard('개발팀'), true);
  assert.equal(isTeamBoard('main'), false);
  assert.deepEqual(TEAM_BOARD_TYPES, ['개발팀', 'AI팀', '지원팀']);
});
