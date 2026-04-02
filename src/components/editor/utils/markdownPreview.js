/**
 * @fileoverview 옵시디언형 Markdown 미리보기 렌더 유틸.
 *
 * 저장 원본은 Markdown으로 유지하고, 상세 패널 미리보기만 HTML로 렌더링한다.
 * 커스텀 문법은 토글/위키링크를 우선 지원하며, 나머지는 marked로 렌더링한다.
 */
import { marked } from 'marked';

export function buildPageWikiLink(item) {
  const title = item?.title || item?.content || '제목 없음';
  return item?.id ? `[[${title}|${item.id}]]` : `[[${title}]]`;
}

export function renderMarkdownPreviewHTML(markdown) {
  if (!markdown) return '';

  const normalized = markdown.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const chunks = [];
  let buffer = [];

  const flush = () => {
    const source = buffer.join('\n').trim();
    if (!source) {
      buffer = [];
      return;
    }
    chunks.push(marked.parse(preprocessWikiLinks(source)));
    buffer = [];
  };

  for (let index = 0; index < lines.length;) {
    const toggleMatch = lines[index].match(/^>\s*\[!(toggle(?:-[a-z0-9]+)?)\]\s*(.*)$/i);
    if (!toggleMatch) {
      buffer.push(lines[index]);
      index += 1;
      continue;
    }

    flush();

    const marker = toggleMatch[1].toLowerCase();
    const title = escapeHTML(toggleMatch[2] || '토글');
    const bodyLines = [];
    index += 1;

    while (index < lines.length && /^>\s?/.test(lines[index])) {
      bodyLines.push(lines[index].replace(/^>\s?/, ''));
      index += 1;
    }

    const bodyMarkdown = preprocessWikiLinks(bodyLines.join('\n').trim());
    const variant = marker === 'toggle' ? 'default' : marker.replace(/^toggle-/, '');
    const bodyHTML = bodyMarkdown ? marked.parse(bodyMarkdown) : '<p></p>';
    chunks.push(
      `<details data-toggle-preview="" data-variant="${variant}" open><summary>${title}</summary>${bodyHTML}</details>`,
    );
  }

  flush();
  return chunks.join('\n');
}

function preprocessWikiLinks(markdown) {
  return markdown.replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_match, left, right) => {
    const hasRight = typeof right === 'string';
    const title = escapeHTML(hasRight ? left : left);
    const target = escapeHTML(hasRight ? right : left);
    return `<a href="#" data-wiki-link="${target}" data-page-link="" data-id="${target}" data-title="${title}" class="wiki-link">${title}</a>`;
  });
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
