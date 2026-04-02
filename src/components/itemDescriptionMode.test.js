import test from 'node:test';
import assert from 'node:assert/strict';

import { getInitialDescriptionMode } from './itemDescriptionMode.js';

test('read only items always start in preview mode', () => {
  assert.equal(getInitialDescriptionMode({ isReadOnly: true, description: '' }), 'preview');
  assert.equal(getInitialDescriptionMode({ isReadOnly: true, description: '내용' }), 'preview');
});

test('editable items with empty content start in live mode', () => {
  assert.equal(getInitialDescriptionMode({ isReadOnly: false, description: '' }), 'live');
  assert.equal(getInitialDescriptionMode({ isReadOnly: false, description: '   \n\t ' }), 'live');
});

test('editable items with content start in preview mode', () => {
  assert.equal(getInitialDescriptionMode({ isReadOnly: false, description: '내용' }), 'preview');
  assert.equal(getInitialDescriptionMode({ isReadOnly: false, description: '<p>내용</p>' }), 'preview');
});
