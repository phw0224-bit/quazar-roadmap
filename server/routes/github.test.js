import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGitHubReviewNotificationPayload,
  resolveGitHubReviewUrl,
  resolveMcpGitHubActorUserIdFromItemRecord,
} from './github.js';

test('resolveGitHubReviewUrl prefers direct review html_url', () => {
  const url = resolveGitHubReviewUrl({
    repository: { full_name: 'acme/roadmap', html_url: 'https://github.com/acme/roadmap' },
    pullRequest: { number: 12, html_url: 'https://github.com/acme/roadmap/pull/12' },
    review: { id: 345, html_url: 'https://github.com/acme/roadmap/pull/12#pullrequestreview-345' },
  });

  assert.equal(url, 'https://github.com/acme/roadmap/pull/12#pullrequestreview-345');
});

test('resolveGitHubReviewUrl falls back to review _links html href', () => {
  const url = resolveGitHubReviewUrl({
    repository: { full_name: 'acme/roadmap' },
    pullRequest: { number: 12, html_url: 'https://github.com/acme/roadmap/pull/12' },
    review: {
      id: 345,
      _links: {
        html: {
          href: 'https://github.com/acme/roadmap/pull/12#pullrequestreview-345',
        },
      },
    },
  });

  assert.equal(url, 'https://github.com/acme/roadmap/pull/12#pullrequestreview-345');
});

test('resolveGitHubReviewUrl builds canonical review anchor when webhook payload omits html_url', () => {
  const url = resolveGitHubReviewUrl({
    repository: { full_name: 'acme/roadmap' },
    pullRequest: { number: 12, html_url: 'https://github.com/acme/roadmap/pull/12' },
    review: { id: 345 },
  });

  assert.equal(url, 'https://github.com/acme/roadmap/pull/12#pullrequestreview-345');
});

test('resolveGitHubReviewUrl ignores api urls and falls back to browser-safe pull request url', () => {
  const url = resolveGitHubReviewUrl({
    repository: { full_name: 'acme/roadmap' },
    pullRequest: { number: 12, html_url: 'https://github.com/acme/roadmap/pull/12' },
    review: { id: 345, html_url: 'https://api.github.com/repos/acme/roadmap/pulls/12/reviews/345' },
  });

  assert.equal(url, 'https://github.com/acme/roadmap/pull/12#pullrequestreview-345');
});

test('buildGitHubReviewNotificationPayload includes browser-safe review url for webhook notifications', () => {
  const payload = buildGitHubReviewNotificationPayload({
    item: { title: '리뷰 대상', board_type: '개발팀' },
    repository: { full_name: 'acme/roadmap' },
    pullRequest: { number: 12, html_url: 'https://github.com/acme/roadmap/pull/12' },
    pullRequestRecord: { pull_number: 12 },
    review: { id: 345 },
    sourceEventId: 'evt-123',
    reviewerDisplayName: 'octocat',
    reviewStateLabel: 'Approved',
  });

  assert.deepEqual(payload, {
    entity_title: '리뷰 대상',
    board_type: '개발팀',
    reviewer_name: 'octocat',
    review_state_label: 'Approved',
    review_url: 'https://github.com/acme/roadmap/pull/12#pullrequestreview-345',
    repo_full_name: 'acme/roadmap',
    pull_number: 12,
    source_event_id: 'evt-123',
  });
});

test('resolveMcpGitHubActorUserIdFromItemRecord prefers created_by', () => {
  const userId = resolveMcpGitHubActorUserIdFromItemRecord({
    item: {
      created_by: 'user-created',
      assignee_user_ids: ['user-assignee-1', 'user-assignee-2'],
    },
  });

  assert.equal(userId, 'user-created');
});

test('resolveMcpGitHubActorUserIdFromItemRecord falls back to first assignee user id', () => {
  const userId = resolveMcpGitHubActorUserIdFromItemRecord({
    item: {
      created_by: null,
      assignee_user_ids: ['', 'user-assignee-2', 'user-assignee-3'],
    },
  });

  assert.equal(userId, 'user-assignee-2');
});

test('resolveMcpGitHubActorUserIdFromItemRecord returns null without actor candidates', () => {
  const userId = resolveMcpGitHubActorUserIdFromItemRecord({
    item: {
      created_by: null,
      assignee_user_ids: [],
    },
  });

  assert.equal(userId, null);
});
