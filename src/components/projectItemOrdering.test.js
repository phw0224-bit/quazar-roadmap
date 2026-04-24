import test from 'node:test';
import assert from 'node:assert/strict';

import { sortProjectItemsByCompletion } from './projectItemOrdering.js';

test('sortProjectItemsByCompletion keeps incomplete items above completed items', () => {
  const sorted = sortProjectItemsByCompletion([
    { id: 'done-1', status: 'done', order_index: 0 },
    { id: 'todo-1', status: 'todo', order_index: 1 },
    { id: 'done-2', status: 'done', order_index: 2 },
    { id: 'progress-1', status: 'in-progress', order_index: 3 },
  ]);

  assert.deepEqual(sorted.map((item) => item.id), ['todo-1', 'progress-1', 'done-1', 'done-2']);
});

test('sortProjectItemsByCompletion preserves order_index within the same completion group', () => {
  const sorted = sortProjectItemsByCompletion([
    { id: 'todo-2', status: 'todo', order_index: 4 },
    { id: 'todo-1', status: 'todo', order_index: 1 },
    { id: 'done-2', status: 'done', order_index: 8 },
    { id: 'done-1', status: 'done', order_index: 2 },
  ]);

  assert.deepEqual(sorted.map((item) => item.id), ['todo-1', 'todo-2', 'done-1', 'done-2']);
});
