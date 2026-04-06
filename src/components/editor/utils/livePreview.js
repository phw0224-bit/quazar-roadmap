/**
 * @fileoverview Markdown live preview 장식 계획 유틸.
 *
 * - 비활성 줄: 헤더/토글/체크리스트/위키링크/callout/수식 + 인라인 마크 전부 렌더링
 * - 활성 줄(커서 위치 줄): 줄 수준 prefix(##, -, > 등)는 source 그대로 두고,
 *   인라인 마크(**bold**, ~~취소선~~, ==형광펜==, $수식$ 등)는 토큰 단위로 렌더링.
 *   커서가 해당 토큰 내부에 있으면 source 표시, 그 외는 렌더링.
 */
import { renderMarkdownPreviewHTML } from './markdownPreview.js';
import katex from 'katex';

export function getMarkdownLivePreviewPlan(text, activeLineIndex = -1, cursorPos = -1) {
  const source = text || '';
  const lines = source.split('\n');
  const lineStarts = getLineStarts(lines);
  const activeToggleRange = getActiveToggleRange(lines, activeLineIndex);
  const replacements = [];
  const lineClasses = [];
  const blockWidgets = [];
  const marks = [];
  const inlineWidgets = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (activeToggleRange && lineIndex >= activeToggleRange.startLine && lineIndex <= activeToggleRange.endLine) {
      if (lineIndex === activeLineIndex) {
        lineClasses.push({
          lineStart: lineStarts[lineIndex],
          className: 'cm-live-active-line',
        });
      }
      continue;
    }

    // 블록 수식 $$ ... $$ 처리 (코드 블록보다 먼저)
    const mathBlockRange = getMathBlock(lines, lineStarts, lineIndex, activeLineIndex);
    if (mathBlockRange) {
      blockWidgets.push(mathBlockRange);
      lineIndex = mathBlockRange.endLine;
      continue;
    }

    // Mermaid 블록 우선 처리 (일반 코드 블록보다 먼저)
    const mermaidRange = getMermaidCodeBlock(lines, lineStarts, lineIndex, activeLineIndex);
    if (mermaidRange) {
      blockWidgets.push(mermaidRange);
      lineIndex = mermaidRange.endLine;
      continue;
    }

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

    const toggleRange = getToggleBlock(lines, lineStarts, lineIndex, activeLineIndex);
    if (toggleRange) {
      blockWidgets.push(toggleRange);
      lineIndex = toggleRange.endLine;
      continue;
    }

    // callout 블록 (> [!note] 등) — blockquote보다 먼저 처리
    const calloutRange = getCalloutBlock(lines, lineStarts, lineIndex, activeLineIndex);
    if (calloutRange) {
      blockWidgets.push(calloutRange);
      lineIndex = calloutRange.endLine;
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
        to: getBlockRangeEnd(lines, lineStarts, lineIndex),
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
      const activeHeadingMatch = line.match(/^(#{1,6})\s+/);
      if (activeHeadingMatch) {
        lineClasses.push({
          lineStart: lineStarts[lineIndex],
          className: `cm-live-active-heading cm-live-active-heading-${activeHeadingMatch[1].length}`,
        });
      }
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

    // ![[embed]] 먼저 처리하고, 일반 [[wiki]] 처리
    collectEmbedDecorations(line, lineStart, replacements, cursorPos);
    collectWikiLinkDecorations(line, lineStart, replacements, marks);
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

function getBlockRangeEnd(lines, lineStarts, endLine) {
  const lastLine = lines[endLine] || '';
  return lineStarts[endLine] + lastLine.length;
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
  const to = getBlockRangeEnd(lines, lineStarts, endLine);
  const markdown = lines.slice(lineIndex, endLine + 1).join('\n');

  return {
    from,
    to,
    html: renderMarkdownPreviewHTML(markdown),
    className: 'cm-live-table-widget',
    endLine,
  };
}

function getToggleBlock(lines, lineStarts, lineIndex, activeLineIndex) {
  const firstLine = lines[lineIndex];
  if (!/^\s*>\s*\[!toggle(?:-[a-z0-9]+)?\]/i.test(firstLine)) return null;

  let endLine = lineIndex;
  while (endLine + 1 < lines.length && /^\s*>\s?/.test(lines[endLine + 1])) {
    endLine += 1;
  }

  if (activeLineIndex >= lineIndex && activeLineIndex <= endLine) return null;

  const from = lineStarts[lineIndex];
  const to = getBlockRangeEnd(lines, lineStarts, endLine);
  const markdown = lines.slice(lineIndex, endLine + 1).join('\n');

  return {
    from,
    to,
    html: renderMarkdownPreviewHTML(markdown),
    className: 'cm-live-toggle-widget',
    endLine,
  };
}

function getActiveToggleRange(lines, activeLineIndex) {
  if (activeLineIndex < 0 || activeLineIndex >= lines.length) return null;

  for (let startLine = 0; startLine < lines.length; startLine += 1) {
    if (!/^\s*>\s*\[!toggle(?:-[a-z0-9]+)?\]/i.test(lines[startLine])) continue;

    let endLine = startLine;
    while (endLine + 1 < lines.length && /^\s*>\s?/.test(lines[endLine + 1])) {
      endLine += 1;
    }

    if (activeLineIndex >= startLine && activeLineIndex <= endLine) {
      return { startLine, endLine };
    }

    startLine = endLine;
  }

  return null;
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

// > [!...] 패턴인지 확인 (toggle 또는 callout — 둘 다 별도 처리)
const ADMONITION_LINE_RE = /^\s*>\s*\[![a-z]/i;

function getCalloutBlock(lines, lineStarts, lineIndex, activeLineIndex) {
  const firstLine = lines[lineIndex];
  // toggle은 별도 처리, callout만 여기서 담당
  if (!/^\s*>\s*\[!/i.test(firstLine) || /^\s*>\s*\[!toggle/i.test(firstLine)) return null;

  let endLine = lineIndex;
  while (endLine + 1 < lines.length && /^\s*>\s?/.test(lines[endLine + 1])) {
    endLine += 1;
  }

  if (activeLineIndex >= lineIndex && activeLineIndex <= endLine) return null;

  const from = lineStarts[lineIndex];
  const to = getBlockRangeEnd(lines, lineStarts, endLine);
  const markdown = lines.slice(lineIndex, endLine + 1).join('\n');

  return {
    from,
    to,
    html: renderMarkdownPreviewHTML(markdown),
    className: 'cm-live-callout-widget',
    endLine,
  };
}

function getBlockquoteBlock(lines, lineStarts, lineIndex, activeLineIndex) {
  // > [!...] 패턴(toggle/callout)은 다른 함수에서 처리
  if (!/^\s*>\s?/.test(lines[lineIndex]) || ADMONITION_LINE_RE.test(lines[lineIndex])) {
    return null;
  }

  let endLine = lineIndex;
  while (
    endLine + 1 < lines.length
    && /^\s*>\s?/.test(lines[endLine + 1])
    && !ADMONITION_LINE_RE.test(lines[endLine + 1])
  ) {
    endLine += 1;
  }

  if (activeLineIndex >= lineIndex && activeLineIndex <= endLine) return null;

  const from = lineStarts[lineIndex];
  const to = getBlockRangeEnd(lines, lineStarts, endLine);
  const markdown = lines.slice(lineIndex, endLine + 1).join('\n');

  return {
    from,
    to,
    html: renderMarkdownPreviewHTML(markdown),
    className: 'cm-live-blockquote-widget',
    endLine,
  };
}

/**
 * @description $$ ... $$ 블록 수식을 KaTeX HTML 위젯으로 변환.
 * 커서가 블록 내부에 있으면 source 그대로 표시.
 */
function getMathBlock(lines, lineStarts, lineIndex, activeLineIndex) {
  if (!/^\s*\$\$\s*$/.test(lines[lineIndex])) return null;

  let endLine = lineIndex + 1;
  while (endLine < lines.length && !/^\s*\$\$\s*$/.test(lines[endLine])) {
    endLine += 1;
  }
  if (endLine >= lines.length) return null;
  if (activeLineIndex >= lineIndex && activeLineIndex <= endLine) return null;

  const formula = lines.slice(lineIndex + 1, endLine).join('\n').trim();
  const from = lineStarts[lineIndex];
  const to = getBlockRangeEnd(lines, lineStarts, endLine);

  let html;
  try {
    html = katex.renderToString(formula, { displayMode: true, throwOnError: false });
  } catch {
    html = `<pre class="md-math-error">${formula}</pre>`;
  }

  return {
    from,
    to,
    html: `<div class="cm-live-math-block">${html}</div>`,
    className: 'cm-live-math-widget',
    endLine,
  };
}

function getMermaidCodeBlock(lines, lineStarts, lineIndex, activeLineIndex) {
  const firstLine = lines[lineIndex];
  if (!/^\s*```mermaid/i.test(firstLine)) return null;

  let endLine = lineIndex + 1;
  while (endLine < lines.length && !/^\s*```/.test(lines[endLine])) {
    endLine += 1;
  }
  if (endLine >= lines.length) return null;

  if (activeLineIndex >= lineIndex && activeLineIndex <= endLine) return null;

  const from = lineStarts[lineIndex];
  const to = getBlockRangeEnd(lines, lineStarts, endLine);
  const code = lines.slice(lineIndex + 1, endLine).join('\n');

  return {
    from,
    to,
    code,
    type: 'mermaid',
    className: 'cm-live-mermaid-block',
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
  const to = getBlockRangeEnd(lines, lineStarts, endLine);
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
  collectFootnoteRefs(line, lineStart, replacements, cursorPos);
  collectInlineMath(line, lineStart, replacements, cursorPos);
}

/**
 * @description 인라인 수식 $formula$ 를 KaTeX로 렌더링.
 * 커서가 토큰 내부에 있으면 source 그대로 표시.
 */
function collectInlineMath(line, lineStart, replacements, cursorPos) {
  const regex = /\$([^$\n]+?)\$/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    const from = lineStart + match.index;
    const to = from + match[0].length;
    if (cursorPos >= 0 && cursorPos >= from && cursorPos <= to) continue;
    let html;
    try {
      html = katex.renderToString(match[1].trim(), { displayMode: false, throwOnError: false });
    } catch {
      html = match[1];
    }
    replacements.push({ from, to, html, className: 'cm-live-math-inline' });
  }
}

/**
 * @description 각주 참조 [^label] 를 위첨자 스타일로 표시.
 * 커서가 토큰 내에 있으면 source 그대로 유지.
 */
function collectFootnoteRefs(line, lineStart, replacements, cursorPos) {
  const regex = /\[\^([^\]\n]+)\]/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    const from = lineStart + match.index;
    const to = from + match[0].length;
    if (cursorPos >= 0 && cursorPos >= from && cursorPos <= to) continue;
    replacements.push({ from, to, label: `[${match[1]}]`, className: 'cm-live-footnote-ref' });
  }
}

/**
 * @description ![[title|id]] 임베드 링크를 인라인 배지로 표시.
 * 커서가 토큰 내에 있으면 source 그대로 유지.
 */
function collectEmbedDecorations(line, lineStart, replacements, cursorPos) {
  const embedRegex = /!\[\[([^|\]]+)(?:\|([^\]]*))?\]\]/g;
  let match;
  while ((match = embedRegex.exec(line)) !== null) {
    const from = lineStart + match.index;
    const to = from + match[0].length;
    if (cursorPos >= 0 && cursorPos >= from && cursorPos <= to) continue;
    replacements.push({
      from,
      to,
      label: `📄 ${match[1]}`,
      className: 'cm-live-embed-link',
    });
  }
}

/**
 * @description [[title|id]] 위키링크를 링크 스타일로 표시.
 * ![[embed]]와 겹치지 않도록 앞에 !가 없는 패턴만 처리.
 */
function collectWikiLinkDecorations(line, lineStart, replacements, marks) {
  const wikiRegex = /(?<!!)(\[\[([^|\]]+)(?:\|([^\]]+))?\]\])/g;
  let wikiMatch;
  while ((wikiMatch = wikiRegex.exec(line)) !== null) {
    const title = (wikiMatch[2] || '').trim();
    if (!title) continue;
    const from = lineStart + wikiMatch.index;
    const to = from + wikiMatch[1].length;
    const hasAlias = typeof wikiMatch[3] === 'string';
    const titleFrom = from + 2;
    const titleTo = titleFrom + wikiMatch[2].length;

    replacements.push({
      from,
      to: from + 2,
      label: '',
      className: 'cm-live-hidden',
    });
    if (hasAlias) {
      replacements.push({
        from: titleTo,
        to,
        label: '',
        className: 'cm-live-hidden',
      });
    } else {
      replacements.push({
        from: to - 2,
        to,
        label: '',
        className: 'cm-live-hidden',
      });
    }
    marks.push({
      from: titleFrom,
      to: titleTo,
      className: 'cm-live-wiki-link',
    });
  }
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
