import test from 'node:test';
import assert from 'node:assert/strict';
import { getMarkdownLivePreviewPlan } from './livePreview.js';

import {
  buildPageWikiLink,
  renderMarkdownPreviewHTML,
  toggleMarkdownTaskItem,
} from './markdownPreview.js';

test('buildPageWikiLink emits title-first canonical wiki link', () => {
  assert.equal(
    buildPageWikiLink({ id: 'abc-123', title: '로드맵 문서' }),
    '[[로드맵 문서|abc-123]]',
  );
});

test('renderMarkdownPreviewHTML renders toggle syntax as details block', () => {
  const html = renderMarkdownPreviewHTML([
    '> [!toggle] 제품 요구사항',
    '> 첫 문단',
    '> - 체크리스트',
  ].join('\n'));

  assert.match(html, /<details[^>]*data-toggle-preview/);
  assert.match(html, /<summary>제품 요구사항<\/summary>/);
  assert.match(html, /<li>체크리스트<\/li>/);
});

test('renderMarkdownPreviewHTML renders wiki links as clickable anchors', () => {
  const html = renderMarkdownPreviewHTML('관련 문서: [[로드맵 문서|abc-123]]');

  assert.match(html, /data-wiki-link="abc-123"/);
  assert.match(html, />로드맵 문서<\/a>/);
});

test('renderMarkdownPreviewHTML renders inline embeds as compact badges instead of expanded blocks', () => {
  const html = renderMarkdownPreviewHTML('참조: ![[로드맵 문서|abc-123]]');

  assert.match(html, /md-inline-embed/);
  assert.match(html, /📄 로드맵 문서/);
  assert.doesNotMatch(html, /md-embed-block/);
});

test('preview inline embed text matches the live compact embed label', () => {
  const markdown = '참조: ![[Pasted Content 1025 chars|item-1]]';
  const html = renderMarkdownPreviewHTML(markdown);
  const livePlan = getMarkdownLivePreviewPlan(markdown, -1);
  const embedReplacement = livePlan.replacements.find((item) => item.className === 'cm-live-embed-link');

  assert.ok(embedReplacement);
  assert.match(html, new RegExp(embedReplacement.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(html, /1025 chars[\s\S]*1025 chars/);
});

test('renderMarkdownPreviewHTML keeps standard markdown headings', () => {
  const html = renderMarkdownPreviewHTML('# 큰 제목');
  assert.match(html, /<h1[^>]*>큰 제목<\/h1>/);
});

test('renderMarkdownPreviewHTML converts single line break into br', () => {
  const html = renderMarkdownPreviewHTML('첫 줄\n둘째 줄');
  assert.match(html, /<p>첫 줄<br>\s*둘째 줄<\/p>/);
});

test('renderMarkdownPreviewHTML renders ordered lists', () => {
  const html = renderMarkdownPreviewHTML('1. 첫번째\n2. 두번째');
  assert.match(html, /<ol>/);
  assert.match(html, /<li>첫번째<\/li>/);
  assert.match(html, /<li>두번째<\/li>/);
});

test('renderMarkdownPreviewHTML renders extended callout types', () => {
  const html = renderMarkdownPreviewHTML([
    '> [!abstract] 요약',
    '> 핵심 내용',
  ].join('\n'));

  assert.match(html, /data-callout-type="abstract"/);
  assert.match(html, /md-callout-gray/);
});

test('toggleMarkdownTaskItem toggles the target checklist item only', () => {
  const markdown = ['- [ ] 첫번째', '- [x] 두번째', '- [ ] 세번째'].join('\n');
  const next = toggleMarkdownTaskItem(markdown, 1, false);

  assert.equal(next, ['- [ ] 첫번째', '- [ ] 두번째', '- [ ] 세번째'].join('\n'));
});

test('toggleMarkdownTaskItem ignores invalid index', () => {
  const markdown = '- [ ] 할 일';
  const next = toggleMarkdownTaskItem(markdown, 9, true);

  assert.equal(next, markdown);
});
