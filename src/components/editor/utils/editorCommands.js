/**
 * @fileoverview Markdown source editor 명령 정의와 슬래시 쿼리 파싱 유틸.
 *
 * 툴바와 슬래시 메뉴가 같은 명령 메타데이터를 재사용한다.
 * 실제 삽입/콜백 실행은 Editor.jsx/EditorToolbar.jsx에서 담당하고,
 * 이 파일은 검색/라벨/snippet 정의와 쿼리 파싱만 맡는다.
 */
import { buildMarkdownTableSnippet } from './tableEditing.js';

export function buildToggleSnippet(variant = 'toggle') {
  const marker = variant === 'toggle' ? 'toggle' : `toggle-${variant}`;
  return `> [!${marker}] 제목\n> 내용\n`;
}

export function buildCalloutSnippet(type) {
  return `> [!${type}] 제목\n> 내용\n`;
}

export const EDITOR_COMMANDS = [
  { id: 'h1', label: '제목 1', keywords: ['h1', 'heading', 'title'], insert: '# ', cursorOffset: 2 },
  { id: 'h2', label: '제목 2', keywords: ['h2', 'heading', 'title'], insert: '## ', cursorOffset: 3 },
  { id: 'h3', label: '제목 3', keywords: ['h3', 'heading', 'title'], insert: '### ', cursorOffset: 4 },
  { id: 'bullet', label: '불릿 리스트', keywords: ['bullet', 'list', 'ul'], insert: '- ', cursorOffset: 2 },
  { id: 'numbered', label: '번호 리스트', keywords: ['numbered', 'ordered', 'list', 'ol'], insert: '1. ', cursorOffset: 3 },
  { id: 'todo', label: '체크리스트', keywords: ['todo', 'check', 'task'], insert: '- [ ] ', cursorOffset: 6 },
  { id: 'quote', label: '인용', keywords: ['quote', 'blockquote'], insert: '> ', cursorOffset: 2 },
  { id: 'code', label: '코드 블록', keywords: ['code', 'fence', 'snippet'], insert: '```ts\n\n```', selectionFrom: 6, selectionTo: 6 },
  { id: 'mermaid', label: 'Mermaid 다이어그램', keywords: ['mermaid', 'diagram', 'flowchart'], insert: '```mermaid\ngraph TD\nA-->B\n```', selectionFrom: 12, selectionTo: 31 },
  { id: 'table', label: '표', keywords: ['table', 'grid', 'sheet'], insert: buildMarkdownTableSnippet(3), selectionFrom: 2, selectionTo: 5 },
  { id: 'divider', label: '구분선', keywords: ['divider', 'hr', 'separator'], insert: '\n---\n' },
  { id: 'math-inline', label: '인라인 수식', keywords: ['math', 'latex', 'katex', 'inline'], insert: '$x^2 + y^2 = z^2$', selectionFrom: 1, selectionTo: 14 },
  { id: 'math-block', label: '블록 수식', keywords: ['math', 'latex', 'katex', 'block', 'equation'], insert: '$$\n\\sum_{i=0}^{n}\n$$', selectionFrom: 3, selectionTo: 17 },
  { id: 'footnote-ref', label: '각주 참조', keywords: ['footnote', 'reference', 'citation'], insert: '[^1]', selectionFrom: 2, selectionTo: 3 },
  { id: 'footnote-def', label: '각주 본문', keywords: ['footnote', 'definition', 'note'], insert: '[^1]: 각주 내용을 입력하세요', selectionFrom: 6, selectionTo: 18 },
  { id: 'toggle', label: '토글', keywords: ['toggle', 'collapse'], insert: buildToggleSnippet('toggle'), selectionFrom: 12, selectionTo: 14 },
  { id: 'toggle-note', label: '토글 노트', keywords: ['toggle-note', 'toggle', 'note'], insert: buildToggleSnippet('note'), selectionFrom: 17, selectionTo: 19 },
  { id: 'toggle-h1', label: '토글 제목 1', keywords: ['toggle-h1', 'toggle', 'h1'], insert: buildToggleSnippet('h1'), selectionFrom: 15, selectionTo: 17 },
  { id: 'toggle-h2', label: '토글 제목 2', keywords: ['toggle-h2', 'toggle', 'h2'], insert: buildToggleSnippet('h2'), selectionFrom: 15, selectionTo: 17 },
  { id: 'toggle-h3', label: '토글 제목 3', keywords: ['toggle-h3', 'toggle', 'h3'], insert: buildToggleSnippet('h3'), selectionFrom: 15, selectionTo: 17 },
  {
    id: 'link-page',
    label: '위키 링크',
    description: '기존 페이지를 [[위키 링크]]로 연결합니다.',
    keywords: ['wiki', 'wikilink', 'link', 'page', '페이지', '위키'],
    action: 'link-page',
  },
  { id: 'page', label: '새 페이지', keywords: ['page', 'new-page', 'child-page', 'subpage'], action: 'create-page' },
  { id: 'image', label: '이미지/파일', keywords: ['image', 'file', 'upload'], action: 'image' },
  // Callout 타입
  { id: 'callout-note',     label: '📝 Note',     keywords: ['note', 'callout'],     insert: buildCalloutSnippet('note'),    selectionFrom: 9,  selectionTo: 11 },
  { id: 'callout-tip',      label: '💡 Tip',      keywords: ['tip', 'hint', 'callout'],      insert: buildCalloutSnippet('tip'),     selectionFrom: 8,  selectionTo: 10 },
  { id: 'callout-warning',  label: '⚠️ Warning',  keywords: ['warning', 'caution', 'callout'],  insert: buildCalloutSnippet('warning'), selectionFrom: 12, selectionTo: 14 },
  { id: 'callout-danger',   label: '🔴 Danger',   keywords: ['danger', 'error', 'callout'],   insert: buildCalloutSnippet('danger'),  selectionFrom: 11, selectionTo: 13 },
  { id: 'callout-success',  label: '✅ Success',  keywords: ['success', 'check', 'done', 'callout'],  insert: buildCalloutSnippet('success'), selectionFrom: 12, selectionTo: 14 },
  { id: 'callout-info',     label: 'ℹ️ Info',     keywords: ['info', 'callout'],     insert: buildCalloutSnippet('info'),    selectionFrom: 9,  selectionTo: 11 },
  { id: 'callout-abstract', label: '📋 Abstract', keywords: ['abstract', 'summary', 'callout'], insert: buildCalloutSnippet('abstract'), selectionFrom: 13, selectionTo: 15 },
  { id: 'callout-question', label: '❓ Question', keywords: ['question', 'callout'], insert: buildCalloutSnippet('question'), selectionFrom: 13, selectionTo: 15 },
  { id: 'callout-bug',      label: '🐛 Bug',      keywords: ['bug', 'callout'],      insert: buildCalloutSnippet('bug'),     selectionFrom: 8,  selectionTo: 10 },
  { id: 'callout-example',  label: '📌 Example',  keywords: ['example', 'callout'],  insert: buildCalloutSnippet('example'), selectionFrom: 12, selectionTo: 14 },
  { id: 'callout-quote',    label: '💬 Quote',    keywords: ['quote', 'callout'],    insert: buildCalloutSnippet('quote'),   selectionFrom: 10, selectionTo: 12 },
];

export function filterEditorCommands(query) {
  const normalized = (query || '').trim().toLowerCase();
  if (!normalized) return EDITOR_COMMANDS;

  return EDITOR_COMMANDS.filter((command) =>
    command.id.includes(normalized)
    || command.label.toLowerCase().includes(normalized)
    || command.keywords.some((keyword) => keyword.includes(normalized)),
  );
}

export function getSlashCommandContext(text, cursor) {
  if (cursor == null) return null;

  const start = text.lastIndexOf('\n', cursor - 1) + 1;
  const line = text.slice(start, cursor);
  const match = line.match(/(?:^|\s)\/([a-z0-9-]*)$/i);
  if (!match) return null;

  const slashIndex = line.lastIndexOf(`/${match[1]}`);
  const from = start + slashIndex;
  const to = cursor;

  return {
    from,
    to,
    query: match[1].toLowerCase(),
    text: text.slice(from, to),
  };
}

export function getWikiLinkContext(text, cursor) {
  if (cursor == null) return null;

  const prefix = text.slice(0, cursor);
  const openIndex = prefix.lastIndexOf('[[');
  if (openIndex < 0) return null;

  const closedIndex = prefix.lastIndexOf(']]');
  if (closedIndex > openIndex) return null;

  const segment = prefix.slice(openIndex, cursor);
  if (/[\n\r]/.test(segment)) return null;

  return {
    from: openIndex,
    to: cursor,
    query: segment.slice(2).trim(),
    text: segment,
  };
}

export function rankWikiLinkItems(items, query = '') {
  const normalized = query.trim().toLowerCase();

  return [...items].sort((left, right) => {
    const leftTitle = `${left?.title || left?.content || ''}`.trim();
    const rightTitle = `${right?.title || right?.content || ''}`.trim();
    const leftRank = getWikiRank(leftTitle, normalized);
    const rightRank = getWikiRank(rightTitle, normalized);

    if (leftRank !== rightRank) return leftRank - rightRank;

    const leftTime = Date.parse(left?.created_at || 0) || 0;
    const rightTime = Date.parse(right?.created_at || 0) || 0;
    if (leftTime !== rightTime) return rightTime - leftTime;

    return leftTitle.localeCompare(rightTitle, 'ko');
  });
}

function getWikiRank(title, query) {
  const normalizedTitle = title.toLowerCase();
  if (!query) return 3;
  if (normalizedTitle === query) return 0;
  if (normalizedTitle.startsWith(query)) return 1;
  if (normalizedTitle.includes(query)) return 2;
  return 3;
}
