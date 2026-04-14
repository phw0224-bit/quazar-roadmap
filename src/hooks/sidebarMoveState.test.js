import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applySidebarItemMove,
  applySidebarProjectMove,
  cloneProjectsSnapshot,
} from './sidebarMoveState.js';

function makeProjects() {
  return [
    {
      id: 'p1',
      section_id: 's1',
      order_index: 0,
      items: [
        { id: 'a', project_id: 'p1', parent_item_id: null, order_index: 0 },
        { id: 'b', project_id: 'p1', parent_item_id: null, order_index: 1 },
        { id: 'child-1', project_id: 'p1', parent_item_id: 'b', order_index: 0 },
      ],
    },
    {
      id: 'p2',
      section_id: 's2',
      order_index: 0,
      items: [
        { id: 'x', project_id: 'p2', parent_item_id: null, order_index: 0 },
      ],
    },
    {
      id: 'p3',
      section_id: 's2',
      order_index: 1,
      items: [],
    },
  ];
}

test('applySidebarItemMove reorders within same parent level', () => {
  const next = applySidebarItemMove(makeProjects(), {
    sourceProjectId: 'p1',
    targetProjectId: 'p1',
    itemId: 'b',
    targetIndex: 0,
    targetParentId: null,
  });

  const items = next.find((p) => p.id === 'p1').items
    .filter((i) => i.parent_item_id === null)
    .sort((a, b) => a.order_index - b.order_index)
    .map((i) => i.id);

  assert.deepEqual(items, ['b', 'a']);
});

test('applySidebarItemMove changes parent for inside drop and reindexes both levels', () => {
  const next = applySidebarItemMove(makeProjects(), {
    sourceProjectId: 'p1',
    targetProjectId: 'p1',
    itemId: 'a',
    targetIndex: 1,
    targetParentId: 'b',
  });

  const rootItems = next.find((p) => p.id === 'p1').items
    .filter((i) => i.parent_item_id === null)
    .sort((a, b) => a.order_index - b.order_index)
    .map((i) => i.id);
  const childItems = next.find((p) => p.id === 'p1').items
    .filter((i) => i.parent_item_id === 'b')
    .sort((a, b) => a.order_index - b.order_index)
    .map((i) => i.id);

  assert.deepEqual(rootItems, ['b']);
  assert.deepEqual(childItems, ['child-1', 'a']);
});

test('applySidebarItemMove supports cross-project move', () => {
  const next = applySidebarItemMove(makeProjects(), {
    sourceProjectId: 'p1',
    targetProjectId: 'p2',
    itemId: 'b',
    targetIndex: 1,
    targetParentId: null,
  });

  const p1Items = next.find((p) => p.id === 'p1').items
    .filter((i) => i.parent_item_id === null)
    .sort((a, b) => a.order_index - b.order_index)
    .map((i) => i.id);
  const p2Items = next.find((p) => p.id === 'p2').items
    .filter((i) => i.parent_item_id === null)
    .sort((a, b) => a.order_index - b.order_index)
    .map((i) => i.id);

  assert.deepEqual(p1Items, ['a']);
  assert.deepEqual(p2Items, ['x', 'b']);
});

test('applySidebarProjectMove supports section change and reindex', () => {
  const next = applySidebarProjectMove(makeProjects(), {
    projectId: 'p1',
    targetSectionId: 's2',
    targetIndex: 1,
  });

  const s1 = next
    .filter((p) => p.section_id === 's1')
    .sort((a, b) => a.order_index - b.order_index)
    .map((p) => `${p.id}:${p.order_index}`);
  const s2 = next
    .filter((p) => p.section_id === 's2')
    .sort((a, b) => a.order_index - b.order_index)
    .map((p) => `${p.id}:${p.order_index}`);

  assert.deepEqual(s1, []);
  assert.deepEqual(s2, ['p2:0', 'p1:1', 'p3:2']);
});

test('applySidebarProjectMove supports moving into board root (section_id=null)', () => {
  const next = applySidebarProjectMove(makeProjects(), {
    projectId: 'p1',
    targetSectionId: null,
    targetIndex: 0,
  });

  const standalone = next
    .filter((p) => p.section_id === null)
    .sort((a, b) => a.order_index - b.order_index)
    .map((p) => `${p.id}:${p.order_index}`);
  const s1 = next
    .filter((p) => p.section_id === 's1')
    .sort((a, b) => a.order_index - b.order_index)
    .map((p) => `${p.id}:${p.order_index}`);

  assert.deepEqual(standalone, ['p1:0']);
  assert.deepEqual(s1, []);
});

test('cloneProjectsSnapshot returns independent copy for rollback', () => {
  const projects = makeProjects();
  const snapshot = cloneProjectsSnapshot(projects);
  const moved = applySidebarItemMove(projects, {
    sourceProjectId: 'p1',
    targetProjectId: 'p1',
    itemId: 'b',
    targetIndex: 0,
    targetParentId: null,
  });

  const originalOrder = snapshot.find((p) => p.id === 'p1').items
    .filter((i) => i.parent_item_id === null)
    .sort((a, b) => a.order_index - b.order_index)
    .map((i) => i.id);
  const movedOrder = moved.find((p) => p.id === 'p1').items
    .filter((i) => i.parent_item_id === null)
    .sort((a, b) => a.order_index - b.order_index)
    .map((i) => i.id);

  assert.deepEqual(originalOrder, ['a', 'b']);
  assert.deepEqual(movedOrder, ['b', 'a']);
});
