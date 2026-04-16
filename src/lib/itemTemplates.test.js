import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getTemplateInlinePlaceholders,
  getTemplateScaffold,
} from './itemTemplates.js';

test('returns development scaffold with structure only', () => {
  const scaffold = getTemplateScaffold('development');

  assert.match(scaffold, /1\. 개발/);
  assert.match(scaffold, /\[원인\]\n\n\[목표\]/);
  assert.doesNotMatch(scaffold, /왜 이 작업을 하는지/);
});

test('returns inline guidance placeholders separate from scaffold content', () => {
  const placeholders = getTemplateInlinePlaceholders('development');

  assert.equal(placeholders['[원인]'], '- 왜 이 작업을 하는지, 요청 배경이나 문제상황');
  assert.equal(placeholders['[결과]'], '- 완료 내용, 현재 상태, 남은 액션, 참고 링크');
});

test('returns empty values for unknown template types', () => {
  assert.equal(getTemplateScaffold('unknown'), '');
  assert.deepEqual(getTemplateInlinePlaceholders('unknown'), {});
});
