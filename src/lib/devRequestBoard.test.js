import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEV_REQUEST_BOARD,
  DEV_REQUEST_STATUSES,
  DEV_REQUEST_TABLE,
  DEV_REQUEST_TEMPLATE,
  createDevRequestDescriptionScaffold,
  createDevRequestInlinePlaceholders,
  createDevRequestTemplateData,
} from './devRequestBoard.js';

test('dev request table exposes the expected metadata', () => {
  assert.equal(DEV_REQUEST_TABLE, 'team_requests');
  assert.equal(DEV_REQUEST_BOARD.boardType, '개발팀');
  assert.equal(DEV_REQUEST_BOARD.label, '요청');
  assert.equal(
    DEV_REQUEST_BOARD.description,
    '다른 팀이 요청을 등록하고 개발팀이 처리합니다.',
  );
  assert.equal(DEV_REQUEST_BOARD.emptyMessage, '아직 등록된 요청이 없습니다.');
  assert.deepEqual(DEV_REQUEST_STATUSES, ['접수됨', '검토중', '진행중', '완료']);
});

test('dev request template exposes the expected placeholder fields', () => {
  assert.equal(DEV_REQUEST_TEMPLATE.title, '임시 요청명세 템플릿');
  assert.deepEqual(
    DEV_REQUEST_TEMPLATE.fields.map((field) => field.label),
    ['요청 배경', '목표', '영향 범위', '우선순위', '희망 일정', '참고 링크', '검수 기준'],
  );
  assert.ok(
    DEV_REQUEST_TEMPLATE.fields.every((field) => typeof field.hint === 'string' && field.hint.length > 0),
  );
  assert.deepEqual(createDevRequestTemplateData(), {
    background: '',
    goal: '',
    impact: '',
    priority: '',
    timeline: '',
    links: '',
    acceptance: '',
  });
  assert.equal(
    createDevRequestDescriptionScaffold(),
    '## [요청 배경]\n\n## [목표]\n\n## [영향 범위]\n\n## [우선순위]\n\n## [희망 일정]\n\n## [참고 링크]\n\n## [검수 기준]\n',
  );
  assert.equal(
    createDevRequestInlinePlaceholders()['## [요청 배경]'],
    '- 왜 지금 이 요청이 필요한지 한두 문장으로 적습니다.',
  );
});
