import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROJECT_MENU_SURFACE_CLASS,
  getProjectMenuPosition,
} from './projectColumnMenu.js';

test('project menu uses a fixed opaque surface above the board', () => {
  assert.match(PROJECT_MENU_SURFACE_CLASS, /\bfixed\b/);
  assert.match(PROJECT_MENU_SURFACE_CLASS, /\bbg-white\b/);
  assert.match(PROJECT_MENU_SURFACE_CLASS, /\bdark:bg-bg-elevated\b/);
  assert.match(PROJECT_MENU_SURFACE_CLASS, /\bpointer-events-auto\b/);
});

test('getProjectMenuPosition aligns menu to the trigger right edge', () => {
  const position = getProjectMenuPosition(
    { top: 80, right: 320, bottom: 116 },
    { menuWidth: 180, menuHeight: 200, viewportWidth: 1440, viewportHeight: 900 },
  );

  assert.deepEqual(position, {
    left: 140,
    top: 124,
    transformOrigin: 'top right',
  });
});

test('getProjectMenuPosition clamps horizontally and flips upward when needed', () => {
  const position = getProjectMenuPosition(
    { top: 620, right: 170, bottom: 656 },
    { menuWidth: 180, menuHeight: 220, viewportWidth: 320, viewportHeight: 720 },
  );

  assert.deepEqual(position, {
    left: 12,
    top: 392,
    transformOrigin: 'bottom right',
  });
});
