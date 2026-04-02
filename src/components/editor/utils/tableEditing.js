/**
 * @fileoverview Markdown 표 편집 유틸.
 *
 * CodeMirror source editor 안에서 표를 직접 구조화하지 않고, Markdown 원문만 바꿔서
 * Tab 이동/행 추가/열 추가/셀 비우기 같은 편집 보조를 제공한다.
 */

export function buildMarkdownTableSnippet(columnCount = 3) {
  const safeColumnCount = Math.max(2, columnCount);
  const header = Array.from({ length: safeColumnCount }, (_, index) => `열 ${index + 1}`);
  const body = Array.from({ length: safeColumnCount }, () => '');
  return formatMarkdownTable([header, body]).text;
}

export function getMarkdownTableContext(text, cursor) {
  const source = text || '';
  const lines = source.split('\n');
  const lineStarts = getLineStarts(lines);
  const lineIndex = getLineIndexAtOffset(lineStarts, cursor);

  if (lineIndex < 0 || lineIndex >= lines.length) return null;

  let startLine = lineIndex;
  let endLine = lineIndex;

  while (startLine > 0 && isMarkdownTableLine(lines[startLine - 1])) startLine -= 1;
  while (endLine + 1 < lines.length && isMarkdownTableLine(lines[endLine + 1])) endLine += 1;

  const tableLines = lines.slice(startLine, endLine + 1);
  if (tableLines.length < 2) return null;
  if (!isDividerLine(tableLines[1])) return null;

  const parsedRows = tableLines.map(parseMarkdownTableRow);
  const columnCount = parsedRows[0].length;
  if (columnCount < 2 || parsedRows.some((row) => row.length !== columnCount)) return null;

  const editableRows = [parsedRows[0], ...parsedRows.slice(2)];
  const editableLineIndices = [startLine, ...Array.from({ length: Math.max(0, tableLines.length - 2) }, (_, index) => startLine + index + 2)];
  const activeEditableRowIndex = editableLineIndices.indexOf(lineIndex);
  if (activeEditableRowIndex === -1) return null;

  const activeColumnIndex = getColumnIndexFromCursor(lines[lineIndex], cursor - lineStarts[lineIndex], columnCount);
  const tableStart = lineStarts[startLine];
  const tableEnd = lineStarts[endLine] + lines[endLine].length;
  const activeCell = getAbsoluteCellRange(lines, lineStarts, editableLineIndices[activeEditableRowIndex], activeColumnIndex);

  return {
    startLine,
    endLine,
    tableStart,
    tableEnd,
    columnCount,
    editableRows,
    activeEditableRowIndex,
    activeColumnIndex,
    activeCell,
  };
}

export function getMarkdownTableContextByStartLine(text, startLine) {
  const source = text || '';
  const lines = source.split('\n');
  if (startLine < 0 || startLine >= lines.length) return null;

  const lineStarts = getLineStarts(lines);
  let endLine = startLine;
  while (endLine + 1 < lines.length && isMarkdownTableLine(lines[endLine + 1])) endLine += 1;

  const tableLines = lines.slice(startLine, endLine + 1);
  if (tableLines.length < 2) return null;
  if (!isDividerLine(tableLines[1])) return null;

  const parsedRows = tableLines.map(parseMarkdownTableRow);
  const columnCount = parsedRows[0].length;
  if (columnCount < 2 || parsedRows.some((row) => row.length !== columnCount)) return null;

  const editableRows = [parsedRows[0], ...parsedRows.slice(2)];

  return {
    startLine,
    endLine,
    tableStart: lineStarts[startLine],
    tableEnd: lineStarts[endLine] + lines[endLine].length,
    columnCount,
    editableRows,
  };
}

export function moveMarkdownTableSelection(text, cursor, direction = 'next') {
  const context = getMarkdownTableContext(text, cursor);
  if (!context) return null;

  const rows = context.editableRows.map((row) => [...row]);
  let rowIndex = context.activeEditableRowIndex;
  let columnIndex = context.activeColumnIndex;

  if (direction === 'prev') {
    if (columnIndex > 0) {
      columnIndex -= 1;
    } else if (rowIndex > 0) {
      rowIndex -= 1;
      columnIndex = rows[0].length - 1;
    }
  } else if (columnIndex < rows[0].length - 1) {
    columnIndex += 1;
  } else if (rowIndex < rows.length - 1) {
    rowIndex += 1;
    columnIndex = 0;
  } else {
    rows.push(Array.from({ length: rows[0].length }, () => ''));
    rowIndex = rows.length - 1;
    columnIndex = 0;
  }

  return replaceTable(text, context, rows, rowIndex, columnIndex);
}

export function addMarkdownTableRow(text, cursor) {
  const context = getMarkdownTableContext(text, cursor);
  if (!context) return null;

  const rows = context.editableRows.map((row) => [...row]);
  const insertAt = context.activeEditableRowIndex + 1;
  rows.splice(insertAt, 0, Array.from({ length: context.columnCount }, () => ''));
  return replaceTable(text, context, rows, insertAt, context.activeColumnIndex);
}

export function addMarkdownTableColumn(text, cursor) {
  const context = getMarkdownTableContext(text, cursor);
  if (!context) return null;

  const rows = context.editableRows.map((row) => {
    const nextRow = [...row];
    nextRow.splice(context.activeColumnIndex + 1, 0, '');
    return nextRow;
  });

  return replaceTable(text, context, rows, context.activeEditableRowIndex, context.activeColumnIndex + 1);
}

export function clearMarkdownTableCell(text, cursor) {
  const context = getMarkdownTableContext(text, cursor);
  if (!context) return null;

  const rows = context.editableRows.map((row) => [...row]);
  rows[context.activeEditableRowIndex][context.activeColumnIndex] = '';
  return replaceTable(text, context, rows, context.activeEditableRowIndex, context.activeColumnIndex);
}

export function deleteMarkdownTableRow(text, cursor) {
  const context = getMarkdownTableContext(text, cursor);
  if (!context) return null;

  const rows = context.editableRows.map((row) => [...row]);
  if (rows.length <= 2) {
    rows[context.activeEditableRowIndex] = Array.from({ length: context.columnCount }, () => '');
    return replaceTable(text, context, rows, context.activeEditableRowIndex, context.activeColumnIndex);
  }

  rows.splice(context.activeEditableRowIndex, 1);
  const nextRowIndex = Math.max(0, Math.min(context.activeEditableRowIndex, rows.length - 1));
  return replaceTable(text, context, rows, nextRowIndex, Math.min(context.activeColumnIndex, rows[0].length - 1));
}

export function deleteMarkdownTableColumn(text, cursor) {
  const context = getMarkdownTableContext(text, cursor);
  if (!context) return null;

  const rows = context.editableRows.map((row) => [...row]);
  if (context.columnCount <= 2) {
    rows.forEach((row) => {
      row[context.activeColumnIndex] = '';
    });
    return replaceTable(text, context, rows, context.activeEditableRowIndex, context.activeColumnIndex);
  }

  rows.forEach((row) => {
    row.splice(context.activeColumnIndex, 1);
  });

  const nextColumnIndex = Math.max(0, Math.min(context.activeColumnIndex, rows[0].length - 1));
  return replaceTable(text, context, rows, context.activeEditableRowIndex, nextColumnIndex);
}

export function addMarkdownTableRowAt(text, startLine, rowIndex) {
  const context = getMarkdownTableContextByStartLine(text, startLine);
  if (!context) return null;

  const rows = context.editableRows.map((row) => [...row]);
  const insertAt = Math.max(0, Math.min(rowIndex + 1, rows.length));
  rows.splice(insertAt, 0, Array.from({ length: context.columnCount }, () => ''));
  return replaceTable(text, context, rows, insertAt, 0);
}

export function deleteMarkdownTableRowAt(text, startLine, rowIndex) {
  const context = getMarkdownTableContextByStartLine(text, startLine);
  if (!context) return null;

  const rows = context.editableRows.map((row) => [...row]);
  const safeRowIndex = Math.max(0, Math.min(rowIndex, rows.length - 1));

  if (rows.length <= 2) {
    rows[safeRowIndex] = Array.from({ length: context.columnCount }, () => '');
    return replaceTable(text, context, rows, safeRowIndex, 0);
  }

  rows.splice(safeRowIndex, 1);
  return replaceTable(text, context, rows, Math.max(0, Math.min(safeRowIndex, rows.length - 1)), 0);
}

export function addMarkdownTableColumnAt(text, startLine, columnIndex) {
  const context = getMarkdownTableContextByStartLine(text, startLine);
  if (!context) return null;

  const rows = context.editableRows.map((row) => {
    const nextRow = [...row];
    nextRow.splice(Math.max(0, Math.min(columnIndex + 1, nextRow.length)), 0, '');
    return nextRow;
  });

  return replaceTable(text, context, rows, 0, Math.max(0, Math.min(columnIndex + 1, rows[0].length - 1)));
}

export function deleteMarkdownTableColumnAt(text, startLine, columnIndex) {
  const context = getMarkdownTableContextByStartLine(text, startLine);
  if (!context) return null;

  const safeColumnIndex = Math.max(0, Math.min(columnIndex, context.columnCount - 1));
  const rows = context.editableRows.map((row) => [...row]);

  if (context.columnCount <= 2) {
    rows.forEach((row) => {
      row[safeColumnIndex] = '';
    });
    return replaceTable(text, context, rows, 0, safeColumnIndex);
  }

  rows.forEach((row) => {
    row.splice(safeColumnIndex, 1);
  });

  return replaceTable(text, context, rows, 0, Math.max(0, Math.min(safeColumnIndex, rows[0].length - 1)));
}

function replaceTable(text, context, rows, focusRowIndex, focusColumnIndex) {
  const formatted = formatMarkdownTable(rows);
  const nextText = `${text.slice(0, context.tableStart)}${formatted.text}${text.slice(context.tableEnd)}`;
  const cell = formatted.cellPositions[focusRowIndex]?.[focusColumnIndex];
  const nextCursor = context.tableStart + (cell?.start ?? 0);

  return {
    text: nextText,
    cursor: nextCursor,
    selectionFrom: nextCursor,
    selectionTo: nextCursor,
  };
}

function formatMarkdownTable(rows) {
  const normalizedRows = rows.map((row) => row.map((cell) => `${cell ?? ''}`.trim()));
  const columnCount = normalizedRows[0]?.length || 0;
  const widths = Array.from({ length: columnCount }, (_, columnIndex) =>
    Math.max(
      3,
      ...normalizedRows.map((row) => (row[columnIndex] || '').length),
    ));

  const formattedRows = [];
  const cellPositions = [];

  normalizedRows.forEach((row) => {
    const positions = [];
    let line = '|';

    row.forEach((cell, columnIndex) => {
      line += ' ';
      const start = line.length;
      line += cell.padEnd(widths[columnIndex], ' ');
      positions.push({ start, end: line.length });
      line += ' |';
    });

    formattedRows.push(line);
    cellPositions.push(positions);
  });

  const divider = `|${widths.map((width) => ` ${'-'.repeat(width)} |`).join('')}`;
  const text = [formattedRows[0], divider, ...formattedRows.slice(1)].join('\n');

  return { text, cellPositions };
}

function isMarkdownTableLine(line) {
  const trimmed = (line || '').trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|');
}

function isDividerLine(line) {
  const cells = parseMarkdownTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function parseMarkdownTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
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

function getLineIndexAtOffset(lineStarts, offset) {
  if (!lineStarts.length) return -1;

  for (let index = lineStarts.length - 1; index >= 0; index -= 1) {
    if (offset >= lineStarts[index]) return index;
  }
  return 0;
}

function getColumnIndexFromCursor(line, offsetInLine, columnCount) {
  const pipeIndices = [];
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '|') pipeIndices.push(index);
  }

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const start = pipeIndices[columnIndex] ?? 0;
    const end = pipeIndices[columnIndex + 1] ?? line.length;
    if (offsetInLine <= end) return columnIndex;
    if (offsetInLine > start && offsetInLine <= end) return columnIndex;
  }

  return Math.max(0, columnCount - 1);
}

function getAbsoluteCellRange(lines, lineStarts, lineIndex, columnIndex) {
  const line = lines[lineIndex] || '';
  const pipeIndices = [];
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '|') pipeIndices.push(index);
  }

  const cellStart = (pipeIndices[columnIndex] ?? 0) + 1;
  const cellEnd = pipeIndices[columnIndex + 1] ?? line.length;
  const leadingSpaces = (line.slice(cellStart, cellEnd).match(/^\s*/) || [''])[0].length;
  const trailingSpaces = (line.slice(cellStart, cellEnd).match(/\s*$/) || [''])[0].length;

  return {
    from: lineStarts[lineIndex] + cellStart + leadingSpaces,
    to: lineStarts[lineIndex] + Math.max(cellStart + leadingSpaces, cellEnd - trailingSpaces),
  };
}
