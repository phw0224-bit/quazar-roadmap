import test from 'node:test';
import assert from 'node:assert/strict';

import { getInitialDescriptionMode } from './itemDescriptionMode.js';

function withMockWindow(windowLike, callback) {
  const originalWindow = globalThis.window;
  globalThis.window = windowLike;
  try {
    callback();
  } finally {
    globalThis.window = originalWindow;
  }
}

test('read only items always start in preview mode', () => {
  assert.equal(getInitialDescriptionMode({ isReadOnly: true, description: '' }), 'preview');
  assert.equal(getInitialDescriptionMode({ isReadOnly: true, description: '내용' }), 'preview');
});

test('editable items use split mode on desktop when no saved preference exists', () => {
  withMockWindow({
    localStorage: { getItem: () => null },
    matchMedia: () => ({ matches: true }),
  }, () => {
    assert.equal(getInitialDescriptionMode({ isReadOnly: false, description: '' }), 'split');
    assert.equal(getInitialDescriptionMode({ isReadOnly: false, description: '내용' }), 'split');
  });
});

test('editable items fall back to live mode on narrow screens', () => {
  withMockWindow({
    localStorage: { getItem: () => null },
    matchMedia: () => ({ matches: false }),
  }, () => {
    assert.equal(getInitialDescriptionMode({ isReadOnly: false, description: '' }), 'live');
    assert.equal(getInitialDescriptionMode({ isReadOnly: false, description: '<p>내용</p>' }), 'live');
  });
});

test('saved mode wins over viewport-based default', () => {
  withMockWindow({
    localStorage: { getItem: () => 'preview' },
    matchMedia: () => ({ matches: true }),
  }, () => {
    assert.equal(getInitialDescriptionMode({ isReadOnly: false, description: '내용' }), 'preview');
  });
});
