import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProjectMovePlan } from './projectMove.js';

test('moving an item to a new parent only changes the moved item parent and reindexes both sibling sets', () => {
  const plan = buildProjectMovePlan({
    allItems: [
      { id: 'a', project_id: 'p1', parent_item_id: null, order_index: 0 },
      { id: 'b', project_id: 'p1', parent_item_id: null, order_index: 1 },
      { id: 'c', project_id: 'p1', parent_item_id: null, order_index: 2 },
      { id: 'child-1', project_id: 'p1', parent_item_id: 'b', order_index: 0 },
    ],
    sourceProjectId: 'p1',
    targetProjectId: 'p1',
    itemId: 'c',
    targetIndex: 1,
    targetParentId: 'b',
  });

  assert.deepEqual(plan.updates, [
    { id: 'a', updates: { order_index: 0 } },
    { id: 'b', updates: { order_index: 1 } },
    { id: 'child-1', updates: { project_id: 'p1', order_index: 0 } },
    { id: 'c', updates: { project_id: 'p1', order_index: 1, parent_item_id: 'b' } },
  ]);
});

test('moving an item across projects reindexes source and target levels', () => {
  const plan = buildProjectMovePlan({
    allItems: [
      { id: 'a', project_id: 'p1', parent_item_id: null, order_index: 0 },
      { id: 'b', project_id: 'p1', parent_item_id: null, order_index: 1 },
      { id: 'x', project_id: 'p2', parent_item_id: null, order_index: 0 },
    ],
    sourceProjectId: 'p1',
    targetProjectId: 'p2',
    itemId: 'b',
    targetIndex: 1,
    targetParentId: null,
  });

  assert.deepEqual(plan.updates, [
    { id: 'a', updates: { order_index: 0 } },
    { id: 'x', updates: { project_id: 'p2', order_index: 0 } },
    { id: 'b', updates: { project_id: 'p2', order_index: 1, parent_item_id: null } },
  ]);
});
