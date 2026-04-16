import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  clampSidebarWidth,
} from './layoutStateUtils.js';

test('clampSidebarWidth keeps value within min/max bounds', () => {
  assert.equal(clampSidebarWidth(100), SIDEBAR_MIN_WIDTH);
  assert.equal(clampSidebarWidth(300), 300);
  assert.equal(clampSidebarWidth(999), SIDEBAR_MAX_WIDTH);
});

test('clampSidebarWidth falls back for invalid values', () => {
  assert.equal(clampSidebarWidth(Number.NaN), SIDEBAR_DEFAULT_WIDTH);
  assert.equal(clampSidebarWidth(Infinity), SIDEBAR_DEFAULT_WIDTH);
});
