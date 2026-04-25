/**
 * @fileoverview 옵시디언형 Markdown 미리보기 렌더 유틸.
 *
 * 저장 원본은 Markdown으로 유지하고, 상세 패널 미리보기만 HTML로 렌더링한다.
 * 커스텀 문법: toggle(접기), callout(강조 박스), 위키링크, 각주를 우선 처리하고
 * 나머지는 marked로 렌더링한다.
 */
import { marked } from 'marked';
import markedFootnote from 'marked-footnote';
import katex from 'katex';

marked.use(markedFootnote());
marked.use({
  gfm: true,
  breaks: true,
});

function parseMarkdown(source) {
  return decorateRenderedTables(marked.parse(source));
}

/**
 * @description $$...$$ 블록 수식과 $...$ 인라인 수식을 KaTeX HTML로 변환한다.
 * marked에 넘기기 전에 선처리하여 마크다운 파서의 간섭을 방지한다.
 */
function preprocessMath(source) {
  // 블록 수식: $$ ... $$ (멀티라인 포함)
  let result = source.replace(/\$\$([\s\S]+?)\$\$/g, (_match, formula) => {
    try {
      return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `<span class="md-math-error">${formula}</span>`;
    }
  });
  // 인라인 수식: $...$ (줄바꿈 없는 것만)
  result = result.replace(/\$([^$\n]+?)\$/g, (_match, formula) => {
    try {
      return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `<span class="md-math-error">${formula}</span>`;
    }
  });
  return result;
}

/**
 * 옵시디언 호환 Callout 타입 정의.
 * icon: 아이콘 문자, color: Tailwind 색상 접두사
 */
const CALLOUT_TYPES = {
  note:     { icon: '📝', label: 'Note',     color: 'blue' },
  info:     { icon: 'ℹ️',  label: 'Info',     color: 'blue' },
  tip:      { icon: '💡', label: 'Tip',      color: 'yellow' },
  hint:     { icon: '💡', label: 'Hint',     color: 'yellow' },
  warning:  { icon: '⚠️', label: 'Warning',  color: 'orange' },
  caution:  { icon: '⚠️', label: 'Caution',  color: 'orange' },
  danger:   { icon: '🔴', label: 'Danger',   color: 'red' },
  error:    { icon: '❌', label: 'Error',    color: 'red' },
  success:  { icon: '✅', label: 'Success',  color: 'green' },
  check:    { icon: '✅', label: 'Check',    color: 'green' },
  done:     { icon: '✅', label: 'Done',     color: 'green' },
  abstract: { icon: '📋', label: 'Abstract', color: 'gray' },
  summary:  { icon: '📋', label: 'Summary',  color: 'gray' },
  question: { icon: '❓', label: 'Question', color: 'purple' },
  bug:      { icon: '🐛', label: 'Bug',      color: 'red' },
  example:  { icon: '📌', label: 'Example',  color: 'purple' },
  quote:    { icon: '💬', label: 'Quote',    color: 'gray' },
};

const TOGGLE_REGEX = /^>\s*\[!(toggle(?:-[a-z0-9]+)?)\]\s*(.*)$/i;
const CALLOUT_REGEX = /^>\s*\[!([a-z][a-z0-9-]*)\]\s*(.*)$/i;
const INLINE_EMBED_REGEX = /!\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g;

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
    // 수식 → 위키링크 → marked 순서로 처리
    chunks.push(parseMarkdown(preprocessWikiLinks(preprocessMath(source))));
    buffer = [];
  };

  for (let index = 0; index < lines.length;) {
    const line = lines[index];

    // toggle 우선 처리
    const toggleMatch = line.match(TOGGLE_REGEX);
    if (toggleMatch) {
      flush();
      const marker = toggleMatch[1].toLowerCase();
      const title = escapeHTML(toggleMatch[2] || '토글');
      const bodyLines = [];
      index += 1;
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        bodyLines.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      const bodyMarkdown = preprocessWikiLinks(preprocessMath(bodyLines.join('\n').trim()));
      const variant = marker === 'toggle' ? 'default' : marker.replace(/^toggle-/, '');
      const bodyHTML = bodyMarkdown ? parseMarkdown(bodyMarkdown) : '<p></p>';
      chunks.push(
        `<details data-toggle-preview="" data-variant="${variant}" open><summary>${title}</summary>${bodyHTML}</details>`,
      );
      continue;
    }

    // callout 처리 (> [!note], > [!warning] 등)
    const calloutMatch = line.match(CALLOUT_REGEX);
    if (calloutMatch) {
      flush();
      const typeKey = calloutMatch[1].toLowerCase();
      const calloutDef = CALLOUT_TYPES[typeKey];
      if (calloutDef) {
        const titleText = calloutMatch[2].trim() || calloutDef.label;
        const bodyLines = [];
        index += 1;
        while (index < lines.length && /^>\s?/.test(lines[index])) {
          bodyLines.push(lines[index].replace(/^>\s?/, ''));
          index += 1;
        }
        const bodyMarkdown = preprocessWikiLinks(preprocessMath(bodyLines.join('\n').trim()));
        const bodyHTML = bodyMarkdown ? parseMarkdown(bodyMarkdown) : '';
        chunks.push(renderCalloutHTML(typeKey, calloutDef, titleText, bodyHTML));
        continue;
      }
    }

    buffer.push(line);
    index += 1;
  }

  flush();
  return chunks.join('\n');
}

/**
 * @description preview에서 클릭된 체크리스트 항목을 Markdown 원문에 반영한다.
 * @param {string} markdown - 원본 markdown
 * @param {number} targetIndex - 문서 내 체크리스트 순번(0-based)
 * @param {boolean} checked - 체크 상태
 * @returns {string} 토글 반영된 markdown
 */
export function toggleMarkdownTaskItem(markdown, targetIndex, checked) {
  if (typeof markdown !== 'string' || targetIndex < 0) return markdown || '';

  let cursor = -1;
  return markdown.replace(/^(\s*[-*]\s+\[)( |x|X)(\]\s+)/gm, (match, prefix, _state, suffix) => {
    cursor += 1;
    if (cursor !== targetIndex) return match;
    return `${prefix}${checked ? 'x' : ' '}${suffix}`;
  });
}

function preprocessWikiLinks(markdown) {
  return markdown.replace(INLINE_EMBED_REGEX, (_match, left) => {
    const title = escapeHTML(left.trim() || '제목 없음');
    return `<span class="md-inline-embed" data-inline-embed="">📄 ${title}</span>`;
  }).replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_match, left, right) => {
    const hasRight = typeof right === 'string';
    const title = escapeHTML(hasRight ? left : left);
    const target = escapeHTML(hasRight ? right : left);
    return `<a href="#" data-wiki-link="${target}" data-page-link="" data-id="${target}" data-title="${title}" class="wiki-link">${title}</a>`;
  });
}

function renderCalloutHTML(typeKey, def, title, bodyHTML) {
  return `<div class="md-callout md-callout-${def.color}" data-callout-type="${typeKey}">
  <div class="md-callout-title">
    <span class="md-callout-icon">${def.icon}</span>
    <span class="md-callout-label">${escapeHTML(title)}</span>
  </div>
  ${bodyHTML ? `<div class="md-callout-body">${bodyHTML}</div>` : ''}
</div>`;
}

function decorateRenderedTables(html) {
  if (!html || !html.includes('<table>')) return html;

  return html.replace(/<table>/g, '<div class="markdown-preview-table-wrap"><table class="markdown-preview-table">')
    .replace(/<\/table>/g, '</table></div>');
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
