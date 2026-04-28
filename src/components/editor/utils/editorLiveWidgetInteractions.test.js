import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findLiveTableRoot,
  getLiveTableEditPosition,
  getLiveTableStartLine,
  shouldIgnoreLivePreviewWidgetEvent,
} from './editorLiveWidgetInteractions.js';

function createMockView(text) {
  const lines = text.split('\n');
  const offsets = [];
  let cursor = 0;

  lines.forEach((line, index) => {
    offsets.push(cursor);
    cursor += line.length;
    if (index < lines.length - 1) cursor += 1;
  });

  return {
    state: {
      doc: {
        lines: lines.length,
        line(lineNumber) {
          return { from: offsets[lineNumber - 1] };
        },
      },
    },
  };
}

function createTableDomMock(startLine) {
  const tableRoot = {
    attributes: {
      'data-live-table-root': 'true',
      'data-live-table-start-line': String(startLine),
    },
    contains(node) {
      return node?.tableRoot === tableRoot;
    },
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
    querySelectorAll(selector) {
      if (selector === 'tbody tr') return this.bodyRows;
      return [];
    },
    bodyRows: [],
  };

  const createNode = ({ id = null, parent = null, kind = 'generic' } = {}) => ({
    id,
    parent,
    kind,
    tableRoot,
    closest(selector) {
      if (selector === '[data-live-table-root="true"], .cm-live-table-widget') {
        return tableRoot;
      }
      if (selector === 'tr') {
        return this.kind === 'tr' ? this : this.parent?.closest?.(selector) ?? null;
      }
      if (selector === 'thead') {
        return this.kind === 'thead' ? this : this.parent?.closest?.(selector) ?? null;
      }
      if (selector === 'tbody') {
        return this.kind === 'tbody' ? this : this.parent?.closest?.(selector) ?? null;
      }
      return this.parent?.closest?.(selector) ?? null;
    },
  });

  const thead = createNode({ kind: 'thead' });
  const tbody = createNode({ kind: 'tbody' });
  const headerRow = createNode({ kind: 'tr', parent: thead });
  const headerCell = createNode({ id: 'header-cell', parent: headerRow });
  const firstBodyRow = createNode({ kind: 'tr', parent: tbody });
  const secondBodyRow = createNode({ kind: 'tr', parent: tbody });
  const secondRowCell = createNode({ id: 'second-row-cell', parent: secondBodyRow });

  tableRoot.bodyRows = [firstBodyRow, secondBodyRow];

  return {
    tableRoot,
    headerCell,
    secondRowCell,
  };
}

test('table widgets ignore single-click events but not double-click events', () => {
  assert.equal(
    shouldIgnoreLivePreviewWidgetEvent({ type: 'mousedown' }, 'cm-live-table-widget'),
    true,
  );
  assert.equal(
    shouldIgnoreLivePreviewWidgetEvent({ type: 'click' }, 'cm-live-table-widget extra'),
    true,
  );
  assert.equal(
    shouldIgnoreLivePreviewWidgetEvent({ type: 'dblclick' }, 'cm-live-table-widget'),
    false,
  );
  assert.equal(
    shouldIgnoreLivePreviewWidgetEvent({ type: 'mousedown' }, 'cm-live-codeblock-widget'),
    false,
  );
});

test('table helpers locate table root and start line metadata', () => {
  const { secondRowCell } = createTableDomMock(4);
  const tableRoot = findLiveTableRoot(secondRowCell);

  assert.ok(tableRoot);
  assert.equal(getLiveTableStartLine(tableRoot), 4);
});

test('double-clicking table rows maps to the expected markdown source line', () => {
  const { tableRoot, headerCell, secondRowCell } = createTableDomMock(3);
  const view = createMockView([
    '앞 문단',
    '',
    '## 수정 파일 목록',
    '| 파일 | 수정 내용 |',
    '| --- | --- |',
    '| 첫 번째 | 내용 1 |',
    '| 두 번째 | 내용 2 |',
  ].join('\n'));

  const headerPos = getLiveTableEditPosition(view, tableRoot, headerCell, 3);
  const secondRowPos = getLiveTableEditPosition(view, tableRoot, secondRowCell, 3);

  assert.equal(headerPos, view.state.doc.line(4).from);
  assert.equal(secondRowPos, view.state.doc.line(7).from);
});
