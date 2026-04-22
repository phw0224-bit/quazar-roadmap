import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDevRequestSubmissionMissingFields,
  isDevRequestReadyToSubmit,
} from './devRequestSubmission.js';

test('getDevRequestSubmissionMissingFields reports required request fields', () => {
  assert.deepEqual(
    getDevRequestSubmissionMissingFields({
      title: '로그인 오류',
      description: '',
      request_team: null,
      priority: '높음',
    }),
    ['본문']
  );
});

test('isDevRequestReadyToSubmit accepts a complete request', () => {
  assert.equal(
    isDevRequestReadyToSubmit({
      title: '로그인 오류',
      description: '모바일에서 로그인 버튼이 동작하지 않습니다.',
      request_team: '기획팀',
      priority: '높음',
    }),
    true
  );
});
