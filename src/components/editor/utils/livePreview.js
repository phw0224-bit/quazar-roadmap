/**
 * @fileoverview Markdown live preview 장식 계획 유틸.
 *
 * - 비활성 줄: 헤더/토글/체크리스트/위키링크 + 인라인 마크 전부 렌더링
 * - 활성 줄(커서 위치 줄): 줄 수준 prefix(##, -, > 등)는 source 그대로 두고,
 *   인라인 마크(**bold**, ~~취소선~~, ==형광펜== 등)는 토큰 단위로 렌더링.
 *   커서가 해당 토큰 내부에 있으면 source 표시, 그 외는 렌더링.
 */
import { renderMarkdownPreviewHTML } from './markdownPreview.js';

export function getMarkdownLivePreviewPlan(text, activeLineIndex = -1, cursorPos = -1) {
  const source = text || '';
  const lines = source.split('\n');
  const lineStarts = getLineStarts(lines);
  const replacements = [];
  const lineClasses = [];
  const blockWidgets = [];
  const marks = [];
  const inlineWidgets = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const codeFenceRange = getFencedCodeBlock(lines, lineStarts, lineIndex, activeLineIndex);
    if (codeFenceRange) {
      blockWidgets.push(codeFenceRange);
      lineIndex = codeFenceRange.endLine;
      continue;
    }

    const tableRange = getMarkdownTableBlock(lines, lineStarts, lineIndex, activeLineIndex);
    if (tableRange) {
      blockWidgets.push(tableRange);
      lineIndex = tableRange.endLine;
      continue;
    }

    const blockquoteRange = getBlockquoteBlock(lines, lineStarts, lineIndex, activeLineIndex);
    if (blockquoteRange) {
      blockWidgets.push(blockquoteRange);
      lineIndex = blockquoteRange.endLine;
      continue;
    }

    const line = lines[lineIndex];
    if (isHorizontalRule(line) && lineIndex !== activeLineIndex) {
      blockWidgets.push({
        from: lineStarts[lineIndex],
        to: lineStarts[lineIndex] + line.length,
        html: renderMarkdownPreviewHTML(line),
        className: 'cm-live-hr-widget',
        endLine: lineIndex,
      });
      continue;
    }

    if (lineIndex === activeLineIndex) {
      lineClasses.push({
        lineStart: lineStarts[lineIndex],
        className: 'cm-live-active-line',
      });
      // 줄 수준 prefix는 source 그대로 두고, 인라인 마크만 토큰 단위로 렌더링
      const lineStart = lineStarts[lineIndex];
      collectInlineMarks(lines[lineIndex], lineStart, marks, replacements, cursorPos);
      collectImageWidgets(lines[lineIndex], lineStart, inlineWidgets, cursorPos);
      continue;
    }

    const lineStart = lineStarts[lineIndex];

    const headingMatch = line.match(/^(#{1,6})\s+/);
    if (headingMatch) {
      replacements.push({
        from: lineStart,
        to: lineStart + headingMatch[0].length,
        label: '',
        className: 'cm-live-hidden',
      });
      lineClasses.push({
        lineStart,
        className: `cm-live-heading cm-live-heading-${headingMatch[1].length}`,
      });
    }

    const toggleMatch = line.match(/^>\s*\[!(toggle(?:-[a-z0-9]+)?)\]\s*/i);
    if (toggleMatch) {
      replacements.push({
        from: lineStart,
        to: lineStart + toggleMatch[0].length,
        label: '▸ ',
        className: 'cm-live-toggle-prefix',
      });
      lineClasses.push({
        lineStart,
        className: 'cm-live-toggle-line',
      });
    } else {
      const quoteMatch = line.match(/^>\s+/);
      if (quoteMatch) {
        replacements.push({
          from: lineStart,
          to: lineStart + quoteMatch[0].length,
          label: '',
          className: 'cm-live-hidden',
        });
        lineClasses.push({
          lineStart,
          className: 'cm-live-quote-line',
        });
      }
    }

    const taskMatch = line.match(/^-\s+\[( |x|X)\]\s+/);
    if (taskMatch) {
      replacements.push({
        from: lineStart,
        to: lineStart + taskMatch[0].length,
        label: taskMatch[1].toLowerCase() === 'x' ? '☑ ' : '☐ ',
        className: 'cm-live-task-prefix',
      });
      lineClasses.push({
        lineStart,
        className: taskMatch[1].toLowerCase() === 'x' ? 'cm-live-task-done' : 'cm-live-task-line',
      });
    }

    const bulletMatch = line.match(/^-\s+/);
    if (bulletMatch && !taskMatch) {
      replacements.push({
        from: lineStart,
        to: lineStart + bulletMatch[0].length,
        label: '• ',
        className: 'cm-live-bullet-prefix',
      });
    }

    const orderedMatch = line.match(/^(\d+)\.\s+/);
    if (orderedMatch) {
      replacements.push({
        from: lineStart,
        to: lineStart + orderedMatch[0].length,
        label: `${orderedMatch[1]}. `,
        className: 'cm-live-ordered-prefix',
      });
    }

    const wikiRegex = /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g;
    let wikiMatch;
    while ((wikiMatch = wikiRegex.exec(line)) !== null) {
      replacements.push({
        from: lineStart + wikiMatch.index,
        to: lineStart + wikiMatch.index + wikiMatch[0].length,
        label: wikiMatch[1],
        className: 'cm-live-wiki-link',
      });
    }

    collectInlineMarks(line, lineStart, marks, replacements, -1);
    collectImageWidgets(line, lineStart, inlineWidgets, -1);
  }

  return { replacements, lineClasses, blockWidgets, marks, inlineWidgets };
}

function getLineStarts(lines) {
  const starts = [];
  let offset = 0;

  lines.forEach((line, index) => {
    starts.push(offset);
    offset += line.length;
    if (index < lines.length - 1) offset += 1;
  });

  return starts;
}

function getMarkdownTableBlock(lines, lineStarts, lineIndex, activeLineIndex) {
  if (!isTableHeaderLine(lines[lineIndex]) || !isTableDividerLine(lines[lineIndex + 1])) {
    return null;
  }

  let endLine = lineIndex + 1;
  while (isTableBodyLine(lines[endLine + 1])) {
    endLine += 1;
  }

  if (activeLineIndex >= lineIndex && activeLineIndex <= endLine) {
    return null;
  }

  const from = lineStarts[lineIndex];
  const lastLine = lines[endLine] || '';
  const to = lineStarts[endLine] + lastLine.length;
  const markdown = lines.slice(lineIndex, endLine + 1).join('\n');
  const rows = lines.slice(lineIndex + 2, endLine + 1);

  return {
    from,
    to,
    html: buildTableWidgetHTML(markdown),
    className: 'cm-live-table-widget',
    endLine,
  };
}

function buildTableWidgetHTML(markdown) {
  return renderMarkdownPreviewHTML(markdown);
}

function isTableHeaderLine(line = '') {
  return /^\s*\|.+\|\s*$/.test(line);
}

function isTableDividerLine(line = '') {
  return /^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line);
}

function isTableBodyLine(line = '') {
  return /^\s*\|.*\|\s*$/.test(line);
}

function getBlockquoteBlock(lines, lineStarts, lineIndex, activeLineIndex) {
  if (!/^\s*>\s?/.test(lines[lineIndex]) || /^\s*>\s*\[!toggle/i.test(lines[lineIndex])) {
    return null;
  }

  let endLine = lineIndex;
  while (endLine + 1 < lines.length && /^\s*>\s?/.test(lines[endLine + 1]) && !/^\s*>\s*\[!toggle/i.test(lines[endLine + 1])) {
    endLine += 1;
  }

  if (activeLineIndex >= lineIndex && activeLineIndex <= endLine) return null;

  const from = lineStarts[lineIndex];
  const lastLine = lines[endLine] || '';
  const to = lineStarts[endLine] + lastLine.length;
  const markdown = lines.slice(lineIndex, endLine + 1).join('\n');

  return {
    from,
    to,
    html: renderMarkdownPreviewHTML(markdown),
    className: 'cm-live-blockquote-widget',
    endLine,
  };
}

function getFencedCodeBlock(lines, lineStarts, lineIndex, activeLineIndex) {
  if (!/^\s*```/.test(lines[lineIndex])) return null;

  let endLine = lineIndex + 1;
  while (endLine < lines.length && !/^\s*```/.test(lines[endLine])) {
    endLine += 1;
  }
  if (endLine >= lines.length) return null;

  if (activeLineIndex >= lineIndex && activeLineIndex <= endLine) return null;

  const from = lineStarts[lineIndex];
  const lastLine = lines[endLine] || '';
  const to = lineStarts[endLine] + lastLine.length;
  const markdown = lines.slice(lineIndex, endLine + 1).join('\n');

  return {
    from,
    to,
    html: renderMarkdownPreviewHTML(markdown),
    className: 'cm-live-codeblock-widget',
    endLine,
  };
}

function isHorizontalRule(line = '') {
  const trimmed = line.trim();
  return /^(\*\s*){3,}$/.test(trimmed)
    || /^(-\s*){3,}$/.test(trimmed)
    || /^(_\s*){3,}$/.test(trimmed);
}

function collectInlineMarks(line, lineStart, marks, replacements, cursorPos) {
  collectWrappedToken(line, lineStart, /\*\*([^*]+)\*\*/g, 2, 'cm-live-strong', replacements, marks, cursorPos);
  collectWrappedToken(line, lineStart, /`([^`]+)`/g, 1, 'cm-live-inline-code', replacements, marks, cursorPos);
  collectWrappedToken(line, lineStart, /\*([^*\s][^*]*?)\*/g, 1, 'cm-live-emphasis', replacements, marks, cursorPos);
  collectWrappedToken(line, lineStart, /~~([^~\n]+)~~/g, 2, 'cm-live-strikethrough', replacements, marks, cursorPos);
  collectWrappedToken(line, lineStart, /==([^=\n]+)==/g, 2, 'cm-live-highlight', replacements, marks, cursorPos);
}

/**
 * @description 이미지 마크다운 `![alt](url)` 을 인라인 위젯으로 변환.
 * 커서가 해당 토큰 내부에 있으면 source 그대로 표시하여 편집 가능.
 */
function collectImageWidgets(line, lineStart, inlineWidgets, cursorPos) {
  const imageRegex = /!\[([^\]]*)\]\(([^)\n]+)\)/g;
  let match;
  while ((match = imageRegex.exec(line)) !== null) {
    const from = lineStart + match.index;
    const to = from + match[0].length;
    // 커서가 이미지 마크다운 내부에 있으면 source 그대로 표시
    if (cursorPos >= 0 && cursorPos >= from && cursorPos <= to) continue;
    inlineWidgets.push({
      from,
      to,
      url: match[2],
      alt: match[1] || '',
    });
  }
}

function collectWrappedToken(line, lineStart, regex, wrapperLength, className, replacements, marks, cursorPos) {
  let match;
  while ((match = regex.exec(line)) !== null) {
    const from = lineStart + match.index;
    const to = from + match[0].length;
    // 커서가 이 토큰 안에 있으면 렌더링 건너뜀 → source 그대로 표시
    if (cursorPos >= 0 && cursorPos >= from && cursorPos <= to) continue;
    replacements.push({
      from,
      to: from + wrapperLength,
      label: '',
      className: 'cm-live-hidden',
    });
    replacements.push({
      from: to - wrapperLength,
      to,
      label: '',
      className: 'cm-live-hidden',
    });
    marks.push({
      from: from + wrapperLength,
      to: to - wrapperLength,
      className,
    });
  }
}
