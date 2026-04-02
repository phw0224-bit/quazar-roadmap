import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  convertClipboardPayloadToEditorHTML,
  convertEditorHTMLToMarkdown,
  convertLegacyHTMLToMarkdown,
  convertMarkdownToEditorHTML,
  isLikelyHTML,
  normalizeDescriptionSource,
} from './markdownTransform.js';

const { window } = new JSDOM('<!doctype html><html><body></body></html>');

global.DOMParser = window.DOMParser;
global.Node = window.Node;
global.document = window.document;

test('canonical toggle markdown round-trips through editor html', () => {
  const markdown = [
    '> [!toggle] 제품 요구사항',
    '> 본문 첫 문단',
    '> - 체크포인트',
    '> - 후속 작업',
  ].join('\n');

  const html = convertMarkdownToEditorHTML(markdown);
  const roundTrip = convertEditorHTMLToMarkdown(html);

  assert.match(html, /data-toggle/);
  assert.equal(roundTrip, markdown);
});

test('details html normalizes into canonical toggle markdown', () => {
  const html = `
    <details>
      <summary>제품 요구사항</summary>
      <p>본문 첫 문단</p>
      <ul>
        <li>체크포인트</li>
      </ul>
    </details>
  `;

  const markdown = convertLegacyHTMLToMarkdown(html);

  assert.equal(
    markdown,
    ['> [!toggle] 제품 요구사항', '> 본문 첫 문단', '> - 체크포인트'].join('\n'),
  );
});

test('callout html serializes into canonical callout markdown', () => {
  const html = `
    <div data-callout data-type="warning">
      <p>주의 사항</p>
      <p>세부 설명</p>
    </div>
  `;

  const markdown = convertEditorHTMLToMarkdown(html);

  assert.equal(markdown, ['> [!warning]', '> 주의 사항', '> 세부 설명'].join('\n'));
});

test('legacy html is detected before conversion', () => {
  assert.equal(isLikelyHTML('<p>본문</p>'), true);
  assert.equal(isLikelyHTML('그냥 마크다운 텍스트'), false);
});

test('clipboard paste prefers existing editor html for internal round-trip', () => {
  const html = '<p>잘라낸 문장</p>';

  assert.equal(
    convertClipboardPayloadToEditorHTML({ htmlData: html, textData: '잘라낸 문장' }),
    html,
  );
});

test('clipboard paste normalizes details html into toggle editor html', () => {
  const html = '<details><summary>토글 제목</summary><p>본문</p></details>';
  const normalized = convertClipboardPayloadToEditorHTML({ htmlData: html, textData: '토글 제목' });

  assert.match(normalized, /data-toggle/);
  assert.match(normalized, /토글 제목/);
});

test('normalizeDescriptionSource converts legacy html into markdown before editing', () => {
  const html = '<h1>API 명세</h1><p>본문입니다.</p>';

  const markdown = normalizeDescriptionSource(html);

  assert.equal(markdown, '# API 명세\n\n본문입니다.');
});

test('preview wiki link html serializes back into canonical wiki link markdown', () => {
  const html = '<p><a href="#" data-wiki-link="abc-123" data-page-link="" data-id="abc-123" data-title="문서">문서</a></p>';

  const markdown = convertEditorHTMLToMarkdown(html);

  assert.equal(markdown, '[[문서|abc-123]]');
});
