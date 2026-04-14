import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDropTypeFromRelativeY,
  getRelativeY,
} from './sidebarDropZones.js';

test('drop classifier uses 25/50/25 zones', () => {
  assert.equal(getDropTypeFromRelativeY(0.1), 'before');
  assert.equal(getDropTypeFromRelativeY(0.5), 'inside');
  assert.equal(getDropTypeFromRelativeY(0.9), 'after');
});

test('relativeY uses the translated drag rect center instead of the activator pointer', () => {
  const relativeY = getRelativeY({
    overRect: { top: 100, height: 100 },
    draggedRect: { top: 140, height: 20 },
    fallbackY: 101,
  });

  assert.equal(relativeY, 0.5);
});
