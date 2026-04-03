import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EDITOR_COMMANDS,
  buildToggleSnippet,
  filterEditorCommands,
  getSlashCommandContext,
  getWikiLinkContext,
  rankWikiLinkItems,
} from './editorCommands.js';

test('buildToggleSnippet emits canonical toggle markdown', () => {
  assert.equal(
    buildToggleSnippet('toggle'),
    '> [!toggle] 제목\n> 내용\n',
  );
  assert.equal(
    buildToggleSnippet('note'),
    '> [!toggle-note] 제목\n> 내용\n',
  );
});

test('filterEditorCommands returns full list for empty query', () => {
  assert.equal(filterEditorCommands('').length, EDITOR_COMMANDS.length);
});

test('filterEditorCommands matches by id and keyword', () => {
  assert.deepEqual(
    filterEditorCommands('toggle-h2').map((command) => command.id),
    ['toggle-h2'],
  );

  assert.ok(
    filterEditorCommands('wiki').some((command) => command.id === 'link-page'),
  );

  assert.ok(
    filterEditorCommands('위키').some((command) => command.id === 'link-page'),
  );

  assert.ok(
    filterEditorCommands('new-page').some((command) => command.id === 'page'),
  );
});

test('getSlashCommandContext resolves slash query at line end', () => {
  const context = getSlashCommandContext('첫 줄\n/toggle', 12);

  assert.deepEqual(context, {
    from: 4,
    to: 12,
    query: 'toggle',
    text: '/toggle',
  });
});

test('getSlashCommandContext supports leading whitespace before slash', () => {
  const input = '  /todo';
  const context = getSlashCommandContext(input, input.length);

  assert.deepEqual(context, {
    from: 2,
    to: 7,
    query: 'todo',
    text: '/todo',
  });
});

test('getSlashCommandContext returns null when slash is in middle of token', () => {
  assert.equal(getSlashCommandContext('abc/toggle', 10), null);
});

test('getWikiLinkContext resolves open wiki link query at cursor', () => {
  const input = '문서 링크 [[사용';
  const context = getWikiLinkContext(input, input.length);

  assert.deepEqual(context, {
    from: 6,
    to: input.length,
    query: '사용',
    text: '[[사용',
  });
});

test('getWikiLinkContext returns null for closed wiki links', () => {
  assert.equal(getWikiLinkContext('[[문서|abc]] 뒤', 11), null);
});

test('rankWikiLinkItems prioritizes exact match then recent items', () => {
  const items = [
    { id: '1', title: '사용자 인증', created_at: '2026-04-01T10:00:00Z' },
    { id: '2', title: '사용자', created_at: '2026-04-02T10:00:00Z' },
    { id: '3', title: '사용자 가이드', created_at: '2026-04-03T10:00:00Z' },
    { id: '4', title: '인증 사용자', created_at: '2026-04-04T10:00:00Z' },
  ];

  assert.deepEqual(
    rankWikiLinkItems(items, '사용자').map((item) => item.id),
    ['2', '3', '1', '4'],
  );
});
