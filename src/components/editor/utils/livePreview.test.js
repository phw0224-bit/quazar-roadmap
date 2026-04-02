import test from 'node:test';
import assert from 'node:assert/strict';

import { getMarkdownLivePreviewPlan } from './livePreview.js';

test('live preview hides heading markers on inactive lines', () => {
  const plan = getMarkdownLivePreviewPlan('# 제목\n본문', 1);

  assert.ok(plan.replacements.some((item) => item.className === 'cm-live-hidden'));
  assert.ok(plan.lineClasses.some((item) => item.className.includes('cm-live-heading-1')));
});

test('live preview keeps active line in source form', () => {
  const plan = getMarkdownLivePreviewPlan('# 제목\n본문', 0);

  assert.equal(plan.replacements.length, 0);
  assert.equal(plan.marks.length, 0);
  assert.equal(plan.blockWidgets.length, 0);
  assert.ok(plan.lineClasses.some((item) => item.className === 'cm-live-active-line'));
});

test('live preview replaces wiki links and task markers', () => {
  const plan = getMarkdownLivePreviewPlan('- [ ] 작업 [[문서|abc-123]]', -1);

  assert.ok(plan.replacements.some((item) => item.className === 'cm-live-task-prefix'));
  assert.ok(plan.replacements.some((item) => item.className === 'cm-live-wiki-link' && item.label === '문서'));
});

test('live preview replaces toggle marker and adds toggle line class', () => {
  const plan = getMarkdownLivePreviewPlan('> [!toggle] 제품 요구사항', -1);

  assert.ok(plan.replacements.some((item) => item.className === 'cm-live-toggle-prefix'));
  assert.ok(plan.lineClasses.some((item) => item.className === 'cm-live-toggle-line'));
});

test('live preview renders inactive markdown tables as block widgets', () => {
  const plan = getMarkdownLivePreviewPlan('| 열 1 | 열 2 |\n| --- | --- |\n| 값 | 값 |', -1);

  assert.equal(plan.blockWidgets.length, 1);
  assert.match(plan.blockWidgets[0].html, /<table/i);
});

test('live preview keeps active table line in source form', () => {
  const plan = getMarkdownLivePreviewPlan('| 열 1 | 열 2 |\n| --- | --- |\n| 값 | 값 |', 1);

  assert.equal(plan.blockWidgets.length, 0);
});

test('live preview renders inactive blockquotes as block widgets', () => {
  const plan = getMarkdownLivePreviewPlan('> `api/online/auth`\n> **설명**', -1);

  assert.equal(plan.blockWidgets.length, 1);
  assert.match(plan.blockWidgets[0].html, /<blockquote/i);
});

test('live preview renders inactive horizontal rules as block widgets', () => {
  const plan = getMarkdownLivePreviewPlan('---', -1);

  assert.equal(plan.blockWidgets.length, 1);
  assert.match(plan.blockWidgets[0].html, /<hr/i);
});

test('live preview renders inactive fenced code blocks as block widgets', () => {
  const plan = getMarkdownLivePreviewPlan('```json\n{\n  "message": "success"\n}\n```', -1);

  assert.equal(plan.blockWidgets.length, 1);
  assert.match(plan.blockWidgets[0].html, /<pre/i);
});

test('live preview decorates inline bold and code tokens on inactive lines', () => {
  const plan = getMarkdownLivePreviewPlan('**요청 헤더** 와 `access-token`', -1);

  assert.ok(plan.marks.some((item) => item.className === 'cm-live-strong'));
  assert.ok(plan.marks.some((item) => item.className === 'cm-live-inline-code'));
});

test('live preview replaces ordered list prefixes on inactive lines', () => {
  const plan = getMarkdownLivePreviewPlan('1. 첫번째', -1);

  assert.ok(plan.replacements.some((item) => item.className === 'cm-live-ordered-prefix'));
});
