import test from 'node:test';
import assert from 'node:assert/strict';

import { sortProjectItemsByCompletion } from './projectItemOrdering.js';

test('sortProjectItemsByCompletion sorts by newest created_at regardless of completion state by default', () => {
  const sorted = sortProjectItemsByCompletion([
    { id: 'done-1', status: 'done', order_index: 0, created_at: '2026-06-20T10:00:00.000Z' },
    { id: 'todo-1', status: 'todo', order_index: 1, created_at: '2026-06-18T10:00:00.000Z' },
    { id: 'done-2', status: 'done', order_index: 2, created_at: '2026-06-22T10:00:00.000Z' },
    { id: 'progress-1', status: 'in-progress', order_index: 3, created_at: '2026-06-21T10:00:00.000Z' },
  ]);

  assert.deepEqual(sorted.map((item) => item.id), ['done-2', 'progress-1', 'done-1', 'todo-1']);
});

test('sortProjectItemsByCompletion shows newest items first across the full project list', () => {
  const sorted = sortProjectItemsByCompletion([
    { id: 'todo-2', status: 'todo', order_index: 4, created_at: '2026-06-22T10:00:00.000Z' },
    { id: 'todo-1', status: 'todo', order_index: 1, created_at: '2026-06-20T10:00:00.000Z' },
    { id: 'done-2', status: 'done', order_index: 8, created_at: '2026-06-21T10:00:00.000Z' },
    { id: 'done-1', status: 'done', order_index: 2, created_at: '2026-06-19T10:00:00.000Z' },
  ]);

  assert.deepEqual(sorted.map((item) => item.id), ['todo-2', 'done-2', 'todo-1', 'done-1']);
});

test('sortProjectItemsByCompletion falls back to descending order_index when created_at is missing', () => {
  const sorted = sortProjectItemsByCompletion([
    { id: 'todo-1', status: 'todo', order_index: 1 },
    { id: 'todo-3', status: 'todo', order_index: 3 },
    { id: 'todo-2', status: 'todo', order_index: 2 },
  ]);

  assert.deepEqual(sorted.map((item) => item.id), ['todo-3', 'todo-2', 'todo-1']);
});

test('sortProjectItemsByCompletion can disable completed grouping', () => {
  const sorted = sortProjectItemsByCompletion([
    { id: 'done-new', status: 'done', created_at: '2026-06-22T10:00:00.000Z' },
    { id: 'todo-old', status: 'todo', created_at: '2026-06-20T10:00:00.000Z' },
    { id: 'done-old', status: 'done', created_at: '2026-06-19T10:00:00.000Z' },
    { id: 'todo-new', status: 'todo', created_at: '2026-06-21T10:00:00.000Z' },
  ], { groupCompletedAtBottom: false });

  assert.deepEqual(sorted.map((item) => item.id), ['done-new', 'todo-new', 'todo-old', 'done-old']);
});

test('sortProjectItemsByCompletion can still group completed items at the bottom when requested', () => {
  const sorted = sortProjectItemsByCompletion([
    { id: 'done-new', status: 'done', created_at: '2026-06-22T10:00:00.000Z' },
    { id: 'todo-old', status: 'todo', created_at: '2026-06-20T10:00:00.000Z' },
    { id: 'done-old', status: 'done', created_at: '2026-06-19T10:00:00.000Z' },
    { id: 'todo-new', status: 'todo', created_at: '2026-06-21T10:00:00.000Z' },
  ], { groupCompletedAtBottom: true });

  assert.deepEqual(sorted.map((item) => item.id), ['todo-new', 'todo-old', 'done-new', 'done-old']);
});
