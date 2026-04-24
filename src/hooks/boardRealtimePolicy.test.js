import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldRefetchBoardForEntryChange } from './boardRealtimePolicy.js';

test('refetches when a new entry is inserted', () => {
  assert.equal(shouldRefetchBoardForEntryChange({ eventType: 'INSERT' }), true);
});

test('refetches when an entry is deleted', () => {
  assert.equal(shouldRefetchBoardForEntryChange({ eventType: 'DELETE' }), true);
});

test('does not refetch for entry updates to protect in-progress document editing', () => {
  assert.equal(shouldRefetchBoardForEntryChange({ eventType: 'UPDATE' }), false);
});

test('does not refetch for unknown events', () => {
  assert.equal(shouldRefetchBoardForEntryChange({ eventType: 'TRUNCATE' }), false);
  assert.equal(shouldRefetchBoardForEntryChange(null), false);
});
