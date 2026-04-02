import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addMarkdownTableColumn,
  addMarkdownTableColumnAt,
  addMarkdownTableRow,
  addMarkdownTableRowAt,
  buildMarkdownTableSnippet,
  clearMarkdownTableCell,
  deleteMarkdownTableColumnAt,
  deleteMarkdownTableColumn,
  deleteMarkdownTableRowAt,
  deleteMarkdownTableRow,
  getMarkdownTableContextByStartLine,
  getMarkdownTableContext,
  moveMarkdownTableSelection,
} from './tableEditing.js';

test('buildMarkdownTableSnippet creates a valid markdown table', () => {
  const table = buildMarkdownTableSnippet(3);

  assert.match(table, /^\| 열 1 /m);
  assert.match(table, /\| --- /m);
});

test('getMarkdownTableContext detects active table cell', () => {
  const markdown = [
    '| 이름 | 상태 |',
    '| --- | --- |',
    '| 작업 | 진행 |',
  ].join('\n');

  const cursor = markdown.indexOf('진행');
  const context = getMarkdownTableContext(markdown, cursor);

  assert.equal(context?.activeEditableRowIndex, 1);
  assert.equal(context?.activeColumnIndex, 1);
  assert.equal(context?.columnCount, 2);
  assert.ok(context?.activeCell.from < context?.activeCell.to);
});

test('moveMarkdownTableSelection moves to next cell and appends row at table end', () => {
  const markdown = [
    '| 이름 | 상태 |',
    '| --- | --- |',
    '| 작업 | 진행 |',
  ].join('\n');

  const cursor = markdown.indexOf('진행');
  const moved = moveMarkdownTableSelection(markdown, cursor, 'next');

  assert.ok(moved);
  assert.match(moved.text, /\|\s+\|\s+\|$/m);
});

test('moveMarkdownTableSelection moves backward with shift-tab semantics', () => {
  const markdown = [
    '| 이름 | 상태 |',
    '| --- | --- |',
    '| 작업 | 진행 |',
  ].join('\n');

  const cursor = markdown.indexOf('진행');
  const moved = moveMarkdownTableSelection(markdown, cursor, 'prev');

  assert.ok(moved);
  assert.match(moved.text, /\| 작업\s+\| 진행\s+\|/);
  assert.equal(typeof moved.cursor, 'number');
});

test('addMarkdownTableRow inserts a blank row below current row', () => {
  const markdown = [
    '| 이름 | 상태 |',
    '| --- | --- |',
    '| 작업 | 진행 |',
  ].join('\n');

  const cursor = markdown.indexOf('작업');
  const updated = addMarkdownTableRow(markdown, cursor);

  assert.ok(updated);
  assert.equal(updated.text.split('\n').length, 4);
  assert.match(updated.text, /\|\s*\|\s*\|$/m);
});

test('addMarkdownTableColumn inserts a blank column to every row', () => {
  const markdown = [
    '| 이름 | 상태 |',
    '| --- | --- |',
    '| 작업 | 진행 |',
  ].join('\n');

  const cursor = markdown.indexOf('상태');
  const updated = addMarkdownTableColumn(markdown, cursor);

  assert.ok(updated);
  assert.equal(updated.text.split('\n')[0].split('|').length - 2, 3);
  assert.match(updated.text, /\| 작업\s+\| 진행\s+\|\s+\|/m);
});

test('clearMarkdownTableCell removes current cell contents but preserves structure', () => {
  const markdown = [
    '| 이름 | 상태 |',
    '| --- | --- |',
    '| 작업 | 진행 |',
  ].join('\n');

  const cursor = markdown.indexOf('진행');
  const updated = clearMarkdownTableCell(markdown, cursor);

  assert.ok(updated);
  assert.match(updated.text, /\| 작업\s+\|\s+\|/m);
});

test('deleteMarkdownTableRow removes current row but keeps at least one body row', () => {
  const markdown = [
    '| 이름 | 상태 |',
    '| --- | --- |',
    '| 작업 | 진행 |',
    '| 검수 | 완료 |',
  ].join('\n');

  const cursor = markdown.indexOf('검수');
  const updated = deleteMarkdownTableRow(markdown, cursor);

  assert.ok(updated);
  assert.ok(!updated.text.includes('검수'));
  assert.ok(updated.text.includes('작업'));
});

test('deleteMarkdownTableColumn removes current column but keeps at least two columns', () => {
  const markdown = [
    '| 이름 | 상태 | 담당 |',
    '| --- | --- | --- |',
    '| 작업 | 진행 | AI팀 |',
  ].join('\n');

  const cursor = markdown.indexOf('진행');
  const updated = deleteMarkdownTableColumn(markdown, cursor);

  assert.ok(updated);
  assert.ok(!updated.text.includes('상태'));
  assert.equal(updated.text.split('\n')[0].split('|').length - 2, 2);
  assert.ok(updated.text.includes('담당'));
});

test('getMarkdownTableContextByStartLine resolves table without cursor', () => {
  const markdown = [
    '문단',
    '| 이름 | 상태 |',
    '| --- | --- |',
    '| 작업 | 진행 |',
  ].join('\n');

  const context = getMarkdownTableContextByStartLine(markdown, 1);
  assert.equal(context?.columnCount, 2);
  assert.equal(context?.editableRows.length, 2);
});

test('table row and column operations work by table start line and indices', () => {
  const markdown = [
    '| 이름 | 상태 |',
    '| --- | --- |',
    '| 작업 | 진행 |',
  ].join('\n');

  const rowAdded = addMarkdownTableRowAt(markdown, 0, 1);
  assert.ok(rowAdded?.text.split('\n').length === 4);

  const colAdded = addMarkdownTableColumnAt(markdown, 0, 0);
  assert.equal(colAdded?.text.split('\n')[0].split('|').length - 2, 3);

  const rowDeleted = deleteMarkdownTableRowAt(`${markdown}\n| 검수 | 완료 |`, 0, 2);
  assert.ok(!rowDeleted?.text.includes('검수'));

  const colDeleted = deleteMarkdownTableColumnAt('| 이름 | 상태 | 담당 |\n| --- | --- | --- |\n| 작업 | 진행 | AI팀 |', 0, 1);
  assert.ok(!colDeleted?.text.includes('상태'));
});
