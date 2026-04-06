/**
 * @fileoverview 상세 설명 에디터의 Markdown 단일 원본 계층.
 *
 * Tiptap은 HTML을 편집 UI로 사용하지만, description 저장/복사 기준은 canonical Markdown으로 유지한다.
 * 이 파일은 Markdown -> editor HTML, editor/legacy HTML -> Markdown 변환과 커스텀 블록(toggle/callout/page link) 정규화를 담당한다.
 *
 * 공개 API:
 * - convertMarkdownToEditorHTML(markdown)
 * - convertEditorHTMLToMarkdown(html)
 * - convertLegacyHTMLToMarkdown(html)
 * - convertClipboardPayloadToEditorHTML({ htmlData, textData })
 * - isLikelyHTML(value)
 * - normalizeDescriptionSource(value)
 */
import { marked } from 'marked';
import TurndownService from 'turndown';

const CALLOUT_TYPES = new Set([
  'note',
  'info',
  'tip',
  'hint',
  'warning',
  'caution',
  'danger',
  'error',
  'success',
  'check',
  'done',
  'abstract',
  'summary',
  'question',
  'bug',
  'example',
  'quote',
]);
const TOGGLE_VARIANTS = new Set(['toggle', 'toggle-h1', 'toggle-h2', 'toggle-h3', 'toggle-note']);

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

turndown.addRule('wikiLink', {
  filter: (node) => node.nodeName === 'A' && node.getAttribute('data-wiki-link'),
  replacement: (_content, node) => {
    const title = node.getAttribute('data-title') || node.textContent || '제목 없음';
    const id = node.getAttribute('data-id') || node.getAttribute('data-wiki-link') || '';
    return `[[${title}${id ? `|${id}` : ''}]]`;
  },
});

export function isLikelyHTML(value) {
  if (!value || typeof value !== 'string') return false;
  return /^\s*<\/?[a-z][\s\S]*>/i.test(value.trim());
}

export function convertMarkdownToEditorHTML(markdown) {
  if (!markdown) return '';
  const lines = normalizeLines(markdown).split('\n');
  const chunks = [];
  let buffer = [];

  const flushBuffer = () => {
    const source = buffer.join('\n').trim();
    if (source) chunks.push(marked.parse(source));
    buffer = [];
  };

  for (let i = 0; i < lines.length;) {
    const match = parseAdmonitionStart(lines[i]);
    if (!match) {
      buffer.push(lines[i]);
      i += 1;
      continue;
    }

    flushBuffer();
    const { html, nextIndex } = renderAdmonitionBlock(lines, i, match);
    chunks.push(html);
    i = nextIndex;
  }

  flushBuffer();
  return chunks.join('\n');
}

export function convertEditorHTMLToMarkdown(html) {
  if (!html) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');
  const markdown = serializeChildren(doc.body.childNodes);
  return cleanupMarkdown(markdown);
}

export function convertLegacyHTMLToMarkdown(html) {
  return convertEditorHTMLToMarkdown(html);
}

export function convertClipboardPayloadToEditorHTML({ htmlData, textData }) {
  if (htmlData && isLikelyHTML(htmlData)) {
    if (isLegacyExternalHTML(htmlData)) {
      return convertMarkdownToEditorHTML(convertLegacyHTMLToMarkdown(htmlData));
    }

    return htmlData;
  }

  if (!textData) return '';
  return convertMarkdownToEditorHTML(textData);
}

export function normalizeDescriptionSource(value) {
  if (!value) return '';
  if (!isLikelyHTML(value)) return value;
  return convertLegacyHTMLToMarkdown(value);
}

function normalizeLines(value) {
  return value.replace(/\r\n?/g, '\n');
}

function parseAdmonitionStart(line) {
  const match = line.match(/^>\s*\[!([a-z0-9-]+)\]\s*(.*)$/i);
  if (!match) return null;
  return {
    marker: match[1].toLowerCase(),
    title: (match[2] || '').trim(),
  };
}

function renderAdmonitionBlock(lines, startIndex, match) {
  const contentLines = [];
  let index = startIndex + 1;

  while (index < lines.length && /^>\s?/.test(lines[index])) {
    contentLines.push(lines[index].replace(/^>\s?/, ''));
    index += 1;
  }

  const contentMarkdown = contentLines.join('\n').trim();
  if (TOGGLE_VARIANTS.has(match.marker)) {
    return {
      html: renderToggleHTML(match.marker, match.title, contentMarkdown),
      nextIndex: index,
    };
  }

  if (CALLOUT_TYPES.has(match.marker)) {
    return {
      html: renderCalloutHTML(match.marker, match.title, contentMarkdown),
      nextIndex: index,
    };
  }

  return {
    html: marked.parse(lines[startIndex]),
    nextIndex: startIndex + 1,
  };
}

function renderToggleHTML(marker, title, bodyMarkdown) {
  const variant = marker === 'toggle' ? 'default' : marker.replace(/^toggle-/, '');
  const headerHTML = `<p>${marked.parseInline(title || '토글')}</p>`;
  const bodyHTML = bodyMarkdown ? marked.parse(bodyMarkdown) : '<p></p>';
  return `<details data-toggle="" data-variant="${variant}" data-open="true">${headerHTML}${bodyHTML}</details>`;
}

function renderCalloutHTML(marker, title, bodyMarkdown) {
  const segments = [];
  if (title) segments.push(`<p>${marked.parseInline(title)}</p>`);
  if (bodyMarkdown) segments.push(marked.parse(bodyMarkdown));
  if (segments.length === 0) segments.push('<p></p>');
  return `<div data-callout="" data-type="${marker}">${segments.join('')}</div>`;
}

function serializeChildren(nodes) {
  const segments = [];

  for (const node of nodes) {
    const markdown = serializeNode(node);
    if (markdown) segments.push(markdown);
  }

  return segments.join('\n\n');
}

function serializeNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const value = node.textContent?.trim();
    return value || '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const element = node;
  if (element.matches('details[data-toggle], details')) {
    return serializeToggle(element);
  }

  if (element.matches('[data-callout]')) {
    return serializeCallout(element);
  }

  if (element.matches('[data-page-link]')) {
    const title = element.getAttribute('data-title') || '제목 없음';
    const id = element.getAttribute('data-id') || '';
    return `[[${title}${id ? `|${id}` : ''}]]`;
  }

  if (element.matches('ul[data-type="taskList"]')) {
    return serializeTaskList(element);
  }

  return turndown.turndown(element.outerHTML).trim();
}

function serializeToggle(element) {
  const isLegacyDetails = !element.hasAttribute('data-toggle');
  const variant = getToggleMarker(element.getAttribute('data-variant'));

  let titleMarkdown = '';
  let bodyNodes = [];

  if (isLegacyDetails) {
    const summary = element.querySelector('summary');
    titleMarkdown = summary ? serializeInlineNode(summary) : '토글';
    bodyNodes = Array.from(element.childNodes).filter((child) => child !== summary);
  } else {
    const blocks = Array.from(element.childNodes).filter(isMeaningfulNode);
    const [headerNode, ...restNodes] = blocks;
    titleMarkdown = headerNode ? serializeInlineNode(headerNode) : '토글';
    bodyNodes = restNodes;
  }

  const bodyMarkdown = serializeChildren(bodyNodes);
  const prefixedBody = prefixQuoteBlock(bodyMarkdown);
  const firstLine = `> [!${variant}] ${titleMarkdown}`.trimEnd();
  return cleanupMarkdown([firstLine, prefixedBody].filter(Boolean).join('\n'));
}

function serializeCallout(element) {
  const marker = (element.getAttribute('data-type') || 'info').toLowerCase();
  const bodyMarkdown = serializeChildren(element.childNodes);
  const prefixedBody = prefixQuoteBlock(bodyMarkdown);
  const firstLine = `> [!${marker}]`;
  return cleanupMarkdown([firstLine, prefixedBody].filter(Boolean).join('\n'));
}

function serializeTaskList(element) {
  const items = Array.from(element.querySelectorAll(':scope > li')).map((item) => {
    const checked = item.getAttribute('data-checked') === 'true';
    const body = item.querySelector('div') || item;
    const text = turndown.turndown(body.innerHTML).trim().replace(/\n+/g, ' ');
    return `- [${checked ? 'x' : ' '}] ${text}`.trimEnd();
  });
  return items.join('\n');
}

function prefixQuoteBlock(markdown) {
  if (!markdown) return '';
  const lines = markdown.split('\n');
  const normalized = lines.filter((line, index) => {
    if (line.trim() !== '') return true;
    const next = lines[index + 1]?.trim() || '';
    return next !== '' && !/^([-*+]|\d+\.)\s/.test(next);
  });

  return normalized
    .map((line) => `> ${line}`.trimEnd())
    .join('\n');
}

function serializeInlineNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.trim() || '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  return turndown.turndown(node.innerHTML || node.textContent || '').trim().replace(/\n+/g, ' ');
}

function isMeaningfulNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return Boolean(node.textContent?.trim());
  }
  return node.nodeType === Node.ELEMENT_NODE;
}

function getToggleMarker(variant) {
  switch ((variant || 'default').toLowerCase()) {
    case 'h1':
      return 'toggle-h1';
    case 'h2':
      return 'toggle-h2';
    case 'h3':
      return 'toggle-h3';
    case 'note':
    case 'callout':
      return 'toggle-note';
    default:
      return 'toggle';
  }
}

function cleanupMarkdown(markdown) {
  return normalizeLines(markdown)
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n>\n/g, '\n')
    .replace(/^-\s{2,}/gm, '- ')
    .replace(/^>\s-\s{2,}/gm, '> - ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function isLegacyExternalHTML(html) {
  return /<details[\s>]/i.test(html) || /<summary[\s>]/i.test(html);
}
