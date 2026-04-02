import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPageWikiLink,
  renderMarkdownPreviewHTML,
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

test('renderMarkdownPreviewHTML keeps standard markdown headings', () => {
  const html = renderMarkdownPreviewHTML('# 큰 제목');
  assert.match(html, /<h1[^>]*>큰 제목<\/h1>/);
});
