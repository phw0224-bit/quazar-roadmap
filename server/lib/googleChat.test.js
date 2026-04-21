import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDevRequestChatMessage, buildDevRequestDetailUrl } from './googleChat.js';

test('buildDevRequestDetailUrl includes the request id and fullscreen flag', () => {
  const url = buildDevRequestDetailUrl('req-123');

  assert.ok(url.includes('item=req-123'));
  assert.ok(url.includes('fullscreen=1'));
});

test('buildDevRequestChatMessage includes the important request fields', () => {
  const message = buildDevRequestChatMessage({
    request: {
      id: 'req-123',
      title: '로그인 오류 수정',
      request_team: '기획팀',
      status: '접수됨',
      priority: '높음',
      description: '모바일에서 로그인 버튼이 동작하지 않습니다.',
    },
    creatorName: '홍길동',
  });

  assert.ok(message.includes('개발팀 요청이 등록되었습니다.'));
  assert.ok(message.includes('제목: 로그인 오류 수정'));
  assert.ok(message.includes('요청팀: 기획팀'));
  assert.ok(message.includes('상태: 접수됨'));
  assert.ok(message.includes('우선순위: 높음'));
  assert.ok(message.includes('작성자: 홍길동'));
  assert.ok(message.includes('요청 내용: 모바일에서 로그인 버튼이 동작하지 않습니다.'));
  assert.ok(message.includes('상세 링크: '));
});
