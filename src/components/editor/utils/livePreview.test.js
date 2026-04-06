import test from 'node:test';
import assert from 'node:assert/strict';

import { getMarkdownLivePreviewPlan } from './livePreview.js';

test('live preview hides heading markers on inactive lines', () => {
  const plan = getMarkdownLivePreviewPlan('# 제목\n본문', 1);

  assert.ok(plan.replacements.some((item) => item.className === 'cm-live-hidden'));
  assert.ok(plan.lineClasses.some((item) => item.className.includes('cm-live-heading-1')));
});

test('live preview keeps active line prefix in source form but renders inline marks', () => {
  // 줄 수준 prefix(# 등)는 source 그대로, 인라인 마크는 렌더링
  const plan = getMarkdownLivePreviewPlan('# 제목\n본문', 0);

  // heading prefix(# )는 숨기지 않음 (줄 수준 장식 생략)
  assert.ok(!plan.lineClasses.some((item) => item.className?.includes('cm-live-heading')));
  assert.ok(plan.lineClasses.some((item) => item.className === 'cm-live-active-line'));
  assert.equal(plan.blockWidgets.length, 0);
});

test('live preview applies active heading depth class on active heading line', () => {
  const plan = getMarkdownLivePreviewPlan('### 활성 헤딩', 0);

  assert.ok(plan.lineClasses.some((item) => item.className === 'cm-live-active-heading cm-live-active-heading-3'));
});

test('live preview does not apply active heading class on non-heading active line', () => {
  const plan = getMarkdownLivePreviewPlan('일반 문장', 0);

  assert.ok(!plan.lineClasses.some((item) => item.className.includes('cm-live-active-heading')));
});

test('live preview renders inline bold on active line when cursor is outside the token', () => {
  // '**굵게** 텍스트' — cursorPos=10 (텍스트 부분), 커서가 bold 토큰 밖
  const text = '**굵게** 텍스트';
  // bold 토큰: '**굵게**' = 0~9 bytes (UTF-16 기준 대략적으로 확인)
  const cursorPos = text.length; // 맨 끝
  const plan = getMarkdownLivePreviewPlan(text, 0, cursorPos);

  assert.ok(plan.marks.some((item) => item.className === 'cm-live-strong'));
});

test('live preview skips bold rendering on active line when cursor is inside the token', () => {
  // '**굵게** 텍스트' — cursorPos=2 (bold 토큰 내부)
  const text = '**bold** text';
  const cursorPos = 3; // bold 토큰 안쪽
  const plan = getMarkdownLivePreviewPlan(text, 0, cursorPos);

  assert.ok(!plan.marks.some((item) => item.className === 'cm-live-strong'));
});

test('live preview keeps wiki title text while hiding delimiters and alias tail', () => {
  const plan = getMarkdownLivePreviewPlan('- [ ] 작업 [[문서|abc-123]]', -1);

  assert.ok(plan.replacements.some((item) => item.className === 'cm-live-task-prefix'));
  assert.ok(plan.replacements.some((item) => item.className === 'cm-live-hidden'));
  assert.ok(plan.marks.some((item) => item.className === 'cm-live-wiki-link'));
});

test('live preview decorates wiki link without alias by hiding only brackets', () => {
  const plan = getMarkdownLivePreviewPlan('참조 [[문서]]', -1);

  assert.ok(plan.replacements.some((item) => item.className === 'cm-live-hidden'));
  assert.ok(plan.marks.some((item) => item.className === 'cm-live-wiki-link'));
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

test('live preview code block range ends at closing fence line', () => {
  const markdown = '```json\n{}\n```\n다음 줄';
  const plan = getMarkdownLivePreviewPlan(markdown, -1);

  assert.equal(plan.blockWidgets.length, 1);
  assert.equal(plan.blockWidgets[0].to, markdown.indexOf('\n다음 줄'));
});

test('live preview decorates inline bold and code tokens on inactive lines', () => {
  const plan = getMarkdownLivePreviewPlan('**요청 헤더** 와 `access-token`', -1);

  assert.ok(plan.marks.some((item) => item.className === 'cm-live-strong'));
  assert.ok(plan.marks.some((item) => item.className === 'cm-live-inline-code'));
});

test('live preview decorates strikethrough tokens on inactive lines', () => {
  const plan = getMarkdownLivePreviewPlan('~~취소선~~ 텍스트', -1);

  assert.ok(plan.marks.some((item) => item.className === 'cm-live-strikethrough'));
});

test('live preview decorates highlight tokens on inactive lines', () => {
  const plan = getMarkdownLivePreviewPlan('==형광펜== 텍스트', -1);

  assert.ok(plan.marks.some((item) => item.className === 'cm-live-highlight'));
});

test('live preview creates image inline widget for inactive lines', () => {
  const plan = getMarkdownLivePreviewPlan('텍스트 ![고양이](https://example.com/cat.jpg) 끝', -1);

  assert.equal(plan.inlineWidgets.length, 1);
  assert.equal(plan.inlineWidgets[0].url, 'https://example.com/cat.jpg');
  assert.equal(plan.inlineWidgets[0].alt, '고양이');
});

test('live preview skips image widget when cursor is inside image token', () => {
  const text = '![cat](https://example.com/cat.jpg)';
  const cursorPos = 5; // 이미지 토큰 내부
  const plan = getMarkdownLivePreviewPlan(text, 0, cursorPos);

  assert.equal(plan.inlineWidgets.length, 0);
});

test('live preview replaces ordered list prefixes on inactive lines', () => {
  const plan = getMarkdownLivePreviewPlan('1. 첫번째', -1);

  assert.ok(plan.replacements.some((item) => item.className === 'cm-live-ordered-prefix'));
});

test('live preview renders inactive mermaid blocks as widgets', () => {
  const plan = getMarkdownLivePreviewPlan('```mermaid\ngraph TD\nA-->B\n```', -1);

  assert.equal(plan.blockWidgets.length, 1);
  assert.equal(plan.blockWidgets[0].type, 'mermaid');
  assert.match(plan.blockWidgets[0].code, /graph TD/);
  assert.equal(plan.blockWidgets[0].className, 'cm-live-mermaid-block');
});

test('live preview mermaid block range ends at closing fence line', () => {
  const markdown = '```mermaid\ngraph TD\nA-->B\n```\n본문';
  const plan = getMarkdownLivePreviewPlan(markdown, -1);

  assert.equal(plan.blockWidgets.length, 1);
  assert.equal(plan.blockWidgets[0].to, markdown.indexOf('\n본문'));
});

test('live preview keeps active mermaid block in source form', () => {
  const plan = getMarkdownLivePreviewPlan('```mermaid\ngraph TD\nA-->B\n```', 1);

  assert.equal(plan.blockWidgets.length, 0);
});

test('live preview distinguishes mermaid from regular code blocks', () => {
  const markdown = '```javascript\nconsole.log();\n```\n\n```mermaid\ngraph TD\n```';
  const plan = getMarkdownLivePreviewPlan(markdown, -1);

  assert.equal(plan.blockWidgets.length, 2);
  assert.equal(plan.blockWidgets[0].className, 'cm-live-codeblock-widget'); // javascript
  assert.equal(plan.blockWidgets[1].type, 'mermaid'); // mermaid
});

