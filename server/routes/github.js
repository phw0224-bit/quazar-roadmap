import { Router } from 'express';
import crypto from 'crypto';
import { TAG_CATALOG_BY_NAME } from '../../src/lib/tagCatalog.js';
import { createSupabaseUserClient, supabaseAdminClient } from '../lib/supabase.js';
import {
  getBearerToken,
  isGitHubAppAuthConfigured,
  isGitHubAppConfigured,
  requireAuthenticatedUser,
  requireServerConfig,
} from '../lib/auth.js';
import {
  GITHUB_APP_ID,
  GITHUB_APP_INSTALL_REDIRECT_URI,
  GITHUB_APP_PRIVATE_KEY,
  GITHUB_APP_SLUG,
  APP_BASE_URL,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_REDIRECT_URI,
  GITHUB_STATE_SECRET,
  GITHUB_WEBHOOK_SECRET,
  TICKET_KEY_PREFIX,
} from '../lib/config.js';

const router = Router();
const dashboardCache = new Map();
const gitHubResponseCache = new Map();
const DASHBOARD_LIST_TTL_MS = 2 * 60 * 1000;
const DASHBOARD_DETAIL_TTL_MS = 60 * 1000;
const GITHUB_RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000;
const GITHUB_PULL_REQUESTS_SCHEMA_ERROR_MESSAGE = 'PR 연결 테이블이 아직 DB에 적용되지 않았습니다. docs/GITHUB_PULL_REQUESTS_2026-05-21.sql을 Supabase에 먼저 적용해주세요.';

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getCachedDashboardValue(key) {
  const entry = dashboardCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    dashboardCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedDashboardValue(key, value, ttlMs) {
  dashboardCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
  return value;
}

function clearDashboardCacheForRepository(userId, repoFullName) {
  for (const key of dashboardCache.keys()) {
    if (key.includes(`:${userId}:${repoFullName}`)) {
      dashboardCache.delete(key);
    }
  }
}

function buildGitHubResponseCacheKey(url, token) {
  const tokenHash = crypto.createHash('sha1').update(String(token || '')).digest('hex');
  return `${tokenHash}:${url}`;
}

function getCachedGitHubResponse(key) {
  const entry = gitHubResponseCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    gitHubResponseCache.delete(key);
    return null;
  }
  return entry;
}

function setCachedGitHubResponse(key, etag, data) {
  if (!etag) return;
  gitHubResponseCache.set(key, {
    etag,
    data,
    expiresAt: Date.now() + GITHUB_RESPONSE_CACHE_TTL_MS,
  });
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function encodeState(payload) {
  const json = JSON.stringify(payload);
  const base64 = Buffer.from(json, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', GITHUB_STATE_SECRET).update(base64).digest('base64url');
  return `${base64}.${sig}`;
}

function decodeState(rawState) {
  if (!rawState || !rawState.includes('.')) {
    throw new Error('Invalid OAuth state');
  }

  const [base64, providedSig] = rawState.split('.');
  const expectedSig = crypto.createHmac('sha256', GITHUB_STATE_SECRET).update(base64).digest('base64url');

  if (providedSig !== expectedSig) {
    throw new Error('OAuth state signature mismatch');
  }

  return JSON.parse(Buffer.from(base64, 'base64url').toString('utf8'));
}

async function fetchGitHubJson(url, token, init = {}) {
  const method = String(init.method || 'GET').toUpperCase();
  const cacheKey = method === 'GET' ? buildGitHubResponseCacheKey(url, token) : null;
  const cachedResponse = cacheKey ? getCachedGitHubResponse(cacheKey) : null;
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2026-03-10',
      'User-Agent': 'roadmap-github-integration',
      ...(cachedResponse?.etag ? { 'If-None-Match': cachedResponse.etag } : {}),
      ...(init.headers || {}),
    },
  });

  if (response.status === 304 && cachedResponse) {
    return cachedResponse.data;
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    const rateLimitReset = response.headers.get('x-ratelimit-reset');
    let message = data?.message || `GitHub API request failed (${response.status})`;

    if ((response.status === 403 || response.status === 429) && rateLimitRemaining === '0') {
      const resetAt = rateLimitReset
        ? new Date(Number(rateLimitReset) * 1000).toISOString()
        : null;
      message = resetAt
        ? `GitHub API rate limit exceeded. 잠시 후 다시 시도해주세요. resetAt=${resetAt}`
        : 'GitHub API rate limit exceeded. 잠시 후 다시 시도해주세요.';
    }

    // 422 Validation Failed 에러는 errors 배열의 상세 정보 포함
    if (response.status === 422 && data?.errors?.length > 0) {
      const firstError = data.errors[0];
      const fieldInfo = firstError.field ? ` (${firstError.field})` : '';
      message = `${message} - ${firstError.message}${fieldInfo}`;
    }

    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  if (cacheKey) {
    setCachedGitHubResponse(cacheKey, response.headers.get('etag'), data);
  }

  return data;
}

async function getStoredGitHubConnection(userId, client = supabaseAdminClient) {
  if (!client) {
    throw new Error('Supabase client is not configured');
  }

  const { data, error } = await client
    .from('user_github_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function canWriteRepo(repo) {
  return Boolean(
    repo?.permissions?.push ||
    repo?.permissions?.triage ||
    repo?.permissions?.maintain ||
    repo?.permissions?.admin
  );
}

function canCreateBranch(repo) {
  return Boolean(
    repo?.permissions?.push ||
    repo?.permissions?.maintain ||
    repo?.permissions?.admin
  );
}

async function requireGitHubRepoConnection(userId) {
  const connection = await getStoredGitHubConnection(userId);
  if (!connection?.access_token) {
    throw createHttpError(400, 'GitHub 계정이 연결되어 있지 않습니다.');
  }

  if (!hasGitHubScope(connection, 'repo') && !hasGitHubScope(connection, 'public_repo')) {
    throw createHttpError(403, '현재 GitHub 연결에 레포 접근 권한이 없습니다. 프로필에서 GitHub를 재연결해주세요.');
  }

  return connection;
}

async function getExistingGitHubIssueForItem(itemId) {
  const { data, error } = await supabaseAdminClient
    .from('item_github_issues')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

function isMissingGitHubPullRequestSchemaError(error) {
  return (
    error?.code === '42P01'
    || error?.code === '42703'
    || error?.message?.includes('item_github_pull_requests')
    || error?.message?.includes('pull_number')
  );
}

async function getExistingGitHubPullRequestsForItem(itemId) {
  const { data, error } = await supabaseAdminClient
    .from('item_github_pull_requests')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingGitHubPullRequestSchemaError(error)) {
      throw createHttpError(500, GITHUB_PULL_REQUESTS_SCHEMA_ERROR_MESSAGE);
    }
    throw error;
  }
  return data || [];
}

async function getGitHubPullRequestRecord(repoFullName, pullNumber) {
  const { data, error } = await supabaseAdminClient
    .from('item_github_pull_requests')
    .select('*')
    .eq('repo_full_name', repoFullName)
    .eq('pull_number', pullNumber)
    .maybeSingle();

  if (error) {
    if (isMissingGitHubPullRequestSchemaError(error)) {
      throw createHttpError(500, GITHUB_PULL_REQUESTS_SCHEMA_ERROR_MESSAGE);
    }
    throw error;
  }
  return data;
}

async function getGitHubIssueRecord(repoFullName, issueNumber) {
  const { data, error } = await supabaseAdminClient
    .from('item_github_issues')
    .select('*')
    .eq('repo_full_name', repoFullName)
    .eq('issue_number', issueNumber)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function mapRoadmapStatusToGitHubState(status) {
  return status === 'done' ? 'closed' : 'open';
}

function mapGitHubStateToRoadmapStatus(state) {
  return state === 'closed' ? 'done' : 'in-progress';
}

function normalizeOptionalText(value) {
  const trimmed = `${value || ''}`.trim();
  return trimmed || null;
}

function normalizeGitHubReviewState(state) {
  const normalizedState = `${state || ''}`.trim().toLowerCase();
  if (normalizedState === 'approved') return 'Approve';
  if (normalizedState === 'changes_requested') return 'Request changes';
  if (normalizedState === 'commented') return 'Comment';
  return normalizedState || 'Review';
}

function truncateGitHubReviewBody(body, maxLength = 280) {
  const normalized = `${body || ''}`.replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildGitHubReviewCommentContent({ reviewerName, reviewStateLabel, reviewBody, reviewUrl }) {
  const lines = [
    '## GitHub PR Review',
    '',
    `**${reviewerName || 'GitHub Reviewer'}** · ${reviewStateLabel || 'Review'}`,
  ];

  const excerpt = truncateGitHubReviewBody(reviewBody);
  if (excerpt) {
    lines.push('', excerpt);
  }

  if (reviewUrl) {
    lines.push('', `[원문 보기](${reviewUrl})`);
  }

  return lines.join('\n');
}

function verifyGitHubWebhookSignature(req) {
  if (!GITHUB_WEBHOOK_SECRET) {
    throw createHttpError(500, 'GITHUB_WEBHOOK_SECRET is not configured.');
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!signature || typeof signature !== 'string') {
    throw createHttpError(401, 'GitHub webhook signature is missing.');
  }

  const digest = crypto
    .createHmac('sha256', GITHUB_WEBHOOK_SECRET)
    .update(req.rawBody || Buffer.from(''))
    .digest('hex');
  const expected = `sha256=${digest}`;

  if (signature.length !== expected.length) {
    throw createHttpError(401, 'GitHub webhook signature is invalid.');
  }

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );

  if (!isValid) {
    throw createHttpError(401, 'GitHub webhook signature is invalid.');
  }
}

function isMissingTicketSchemaError(error) {
  return error?.code === '42703' || error?.message?.includes('ticket_key');
}

async function findItemRecordById(itemId) {
  const tables = [
    { name: 'items' },
    { name: 'roadmap_items', mainOnly: true },
  ];

  for (const table of tables) {
    let query = supabaseAdminClient
      .from(table.name)
      .select('id, title, content, description, board_type, assignees, assignee_user_ids, tags, status, is_ticket, ticket_key, ticket_number, ticket_created_at, created_by')
      .eq('id', itemId);

    if (table.mainOnly) {
      query = query.eq('board_type', 'main');
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      if (isMissingTicketSchemaError(error)) {
        throw createHttpError(500, '티켓 컬럼이 아직 DB에 적용되지 않았습니다. items와 roadmap_items에 ticket 컬럼을 먼저 추가해주세요.');
      }
      throw error;
    }

    if (data) return { table: table.name, item: data };
  }

  return null;
}

function normalizeUuidList(values = []) {
  const seen = new Set();

  return (Array.isArray(values) ? values : [])
    .map((value) => `${value || ''}`.trim())
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

async function insertGitHubReviewSystemComment({
  pullRequestRecord,
  itemRecord,
  repository,
  pullRequest,
  review,
}) {
  const sourceEventId = normalizeOptionalText(
    review?.node_id
    || review?.id
    || `${repository?.full_name || ''}:${pullRequest?.number || ''}:${review?.submitted_at || review?.state || ''}`
  );

  if (!sourceEventId) {
    throw createHttpError(400, 'Webhook payload is missing review event identity.');
  }

  const { data: existingComment, error: existingCommentError } = await supabaseAdminClient
    .from('comments')
    .select('id')
    .eq('source', 'github_review')
    .eq('source_event_id', sourceEventId)
    .maybeSingle();

  if (existingCommentError) throw existingCommentError;
  if (existingComment?.id) {
    return {
      inserted: false,
      sourceEventId,
      reviewStateLabel: normalizeGitHubReviewState(review?.state),
      reviewerDisplayName: normalizeOptionalText(review?.user?.name) || normalizeOptionalText(review?.user?.login) || 'GitHub Reviewer',
    };
  }

  const reviewerLogin = normalizeOptionalText(review?.user?.login);
  const reviewerDisplayName = normalizeOptionalText(review?.user?.name) || reviewerLogin || 'GitHub Reviewer';
  const reviewUrl = normalizeOptionalText(review?.html_url) || normalizeOptionalText(pullRequest?.html_url);
  const reviewStateLabel = normalizeGitHubReviewState(review?.state);
  const reviewBody = normalizeOptionalText(review?.body);
  const fallbackUserId = pullRequestRecord?.created_by || itemRecord?.item?.created_by || null;

  const { error } = await supabaseAdminClient
    .from('comments')
    .insert([{
      item_id: pullRequestRecord.item_id,
      user_id: fallbackUserId,
      content: buildGitHubReviewCommentContent({
        reviewerName: reviewerDisplayName,
        reviewStateLabel,
        reviewBody,
        reviewUrl,
      }),
      tags: ['github-review'],
      source: 'github_review',
      source_event_id: sourceEventId,
      source_url: reviewUrl,
      source_metadata: {
        reviewer_login: reviewerLogin,
        reviewer_name: reviewerDisplayName,
        review_state: normalizeOptionalText(review?.state),
        review_state_label: reviewStateLabel,
        review_submitted_at: normalizeOptionalText(review?.submitted_at),
        review_id: review?.id || null,
        review_body_excerpt: truncateGitHubReviewBody(reviewBody),
        repo_full_name: normalizeOptionalText(repository?.full_name),
        pull_number: pullRequest?.number || null,
        pull_title: normalizeOptionalText(pullRequest?.title),
        pull_url: normalizeOptionalText(pullRequest?.html_url),
      },
    }]);

  if (error) throw error;
  return {
    inserted: true,
    sourceEventId,
    reviewerDisplayName,
    reviewStateLabel,
  };
}

async function insertGitHubReviewNotifications({
  itemRecord,
  pullRequestRecord,
  review,
  repository,
  sourceEventId,
  reviewerDisplayName,
  reviewStateLabel,
}) {
  const item = itemRecord?.item;
  if (!item?.id) return 0;

  const recipientUserIds = normalizeUuidList([
    ...(item.assignee_user_ids || []),
    item.created_by,
  ]);

  if (recipientUserIds.length === 0) {
    return 0;
  }

  const { data: existingNotification, error: existingNotificationError } = await supabaseAdminClient
    .from('notifications')
    .select('id')
    .eq('type', 'github_review_submitted')
    .eq('entity_table', itemRecord.table)
    .eq('entity_id', item.id)
    .contains('payload', { source_event_id: sourceEventId })
    .limit(1);

  if (existingNotificationError) throw existingNotificationError;
  if ((existingNotification || []).length > 0) {
    return 0;
  }

  const notifications = recipientUserIds.map((recipientUserId) => ({
    recipient_user_id: recipientUserId,
    actor_user_id: null,
    type: 'github_review_submitted',
    entity_table: itemRecord.table,
    entity_id: item.id,
    parent_entity_table: 'items',
    parent_entity_id: pullRequestRecord.item_id,
    payload: {
      entity_title: normalizeOptionalText(item.title),
      board_type: normalizeOptionalText(item.board_type),
      reviewer_name: reviewerDisplayName,
      review_state_label: reviewStateLabel,
      review_url: normalizeOptionalText(review?.html_url),
      repo_full_name: normalizeOptionalText(repository?.full_name),
      pull_number: pullRequestRecord.pull_number || null,
      source_event_id: sourceEventId,
    },
  }));

  const { error } = await supabaseAdminClient
    .from('notifications')
    .insert(notifications);

  if (error) throw error;
  return notifications.length;
}

async function allocateTicketNumber() {
  const { data, error } = await supabaseAdminClient.rpc('allocate_ticket_number');
  if (error) {
    if (error.code === '42883') {
      throw createHttpError(500, 'allocate_ticket_number 함수가 없습니다. DB에 티켓 번호 발급 함수를 먼저 추가해주세요.');
    }
    throw error;
  }

  const ticketNumber = Number(data);
  if (!Number.isFinite(ticketNumber) || ticketNumber <= 0) {
    throw createHttpError(500, '유효한 티켓 번호를 발급받지 못했습니다.');
  }

  return ticketNumber;
}

function normalizeTicketPrefix(prefix) {
  return String(prefix || '').trim().toUpperCase();
}

function assertValidTicketPrefix(prefix) {
  const normalized = normalizeTicketPrefix(prefix);
  if (!/^[A-Z0-9]{2,8}$/.test(normalized)) {
    throw createHttpError(400, '티켓 약어는 대문자 영문/숫자 2~8자여야 합니다.');
  }
  return normalized;
}

async function getRepositorySettings(repoFullName) {
  const { data, error } = await supabaseAdminClient
    .from('github_repository_settings')
    .select('*')
    .eq('repo_full_name', repoFullName)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function saveRepositorySettings({ repoFullName, ticketPrefix, userId }) {
  const normalizedPrefix = assertValidTicketPrefix(ticketPrefix);
  const existingSettings = await getRepositorySettings(repoFullName);

  if (existingSettings?.prefix_locked) {
    throw createHttpError(409, '이미 티켓이 발급된 레포지토리라 티켓 약어를 변경할 수 없습니다.');
  }

  const { data, error } = await supabaseAdminClient
    .from('github_repository_settings')
    .upsert(
      {
        repo_full_name: repoFullName,
        ticket_prefix: normalizedPrefix,
        created_by: existingSettings?.created_by || userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'repo_full_name' }
    )
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw createHttpError(409, '이미 다른 레포지토리에서 사용 중인 티켓 약어입니다.');
    }
    throw error;
  }

  return data;
}

async function lockRepositoryTicketPrefix(repoFullName) {
  const { error } = await supabaseAdminClient.rpc('lock_github_repository_ticket_prefix', {
    target_repo_full_name: repoFullName,
  });

  if (error) throw error;
}

async function allocateRepositoryTicketNumber(repoTicketScope) {
  const { data, error } = await supabaseAdminClient.rpc('allocate_repo_ticket_number', {
    p_repo_key: repoTicketScope,
  });

  if (error) {
    if (error.code === '42883' || error.code === 'PGRST202') {
      throw createHttpError(500, 'allocate_repo_ticket_number 함수가 없습니다. docs/GITHUB_REPO_TICKETS_2026-04-21.sql을 Supabase에 적용해주세요.');
    }
    throw error;
  }

  const ticketNumber = Number(data);
  if (!Number.isFinite(ticketNumber) || ticketNumber <= 0) {
    throw createHttpError(500, '유효한 레포별 티켓 번호를 발급받지 못했습니다.');
  }

  return ticketNumber;
}

function buildTicketKey(ticketNumber, ticketPrefix = null) {
  if (!ticketPrefix) return `${TICKET_KEY_PREFIX}-${ticketNumber}`;
  return `${TICKET_KEY_PREFIX}-${ticketPrefix}-${ticketNumber}`;
}

async function ensureItemTicket(itemRecord, ticketPrefix = null) {
  const { table, item } = itemRecord;

  if (item.ticket_key && item.ticket_number) {
    return {
      is_ticket: true,
      ticket_key: item.ticket_key,
      ticket_number: item.ticket_number,
      ticket_created_at: item.ticket_created_at,
    };
  }

  const normalizedTicketPrefix = ticketPrefix ? assertValidTicketPrefix(ticketPrefix) : null;
  const ticketNumber = normalizedTicketPrefix
    ? await allocateRepositoryTicketNumber(normalizedTicketPrefix)
    : await allocateTicketNumber();
  const ticketKey = buildTicketKey(ticketNumber, normalizedTicketPrefix);
  const ticketCreatedAt = new Date().toISOString();

  const { data, error } = await supabaseAdminClient
    .from(table)
    .update({
      is_ticket: true,
      ticket_key: ticketKey,
      ticket_number: ticketNumber,
      ticket_created_at: ticketCreatedAt,
    })
    .eq('id', item.id)
    .is('ticket_key', null)
    .select('is_ticket, ticket_key, ticket_number, ticket_created_at')
    .maybeSingle();

  if (error) {
    if (isMissingTicketSchemaError(error)) {
      throw createHttpError(500, '티켓 컬럼이 아직 DB에 적용되지 않았습니다. items와 roadmap_items에 ticket 컬럼을 먼저 추가해주세요.');
    }
    throw error;
  }

  if (data?.ticket_key && data?.ticket_number) {
    return data;
  }

  const { data: latest, error: latestError } = await supabaseAdminClient
    .from(table)
    .select('is_ticket, ticket_key, ticket_number, ticket_created_at')
    .eq('id', item.id)
    .single();

  if (latestError) throw latestError;

  if (!latest?.ticket_key || !latest?.ticket_number) {
    throw createHttpError(500, '티켓 발급에 실패했습니다.');
  }

  return latest;
}

async function ensureItemStatusForIssue(itemRecord) {
  const { table, item } = itemRecord;
  const currentStatus = item.status || 'none';

  if (currentStatus !== 'none') return currentStatus;

  const { data, error } = await supabaseAdminClient
    .from(table)
    .update({ status: 'in-progress' })
    .eq('id', item.id)
    .or('status.is.null,status.eq.none')
    .select('status')
    .maybeSingle();

  if (error) throw error;
  return data?.status || 'in-progress';
}

function buildIssueBody(item, ticket) {
  const title = item.title || item.content || '제목 없음';
  const description = String(item.description || '').trim();
  const assignees = Array.isArray(item.assignees) && item.assignees.length > 0
    ? item.assignees.join(', ')
    : '없음';
  const tags = Array.isArray(item.tags) && item.tags.length > 0
    ? item.tags.map((tag) => `#${tag}`).join(', ')
    : '없음';

  return [
    'Quazar Roadmap 아이템에서 생성된 이슈입니다.',
    '',
    `티켓: ${ticket.ticket_key}`,
    `제목: ${title}`,
    `담당자: ${assignees}`,
    `태그: ${tags}`,
    '',
    '설명:',
    description || '(설명 없음)',
    '',
    `Roadmap Item ID: ${item.id}`,
  ].join('\n');
}

function buildPullRequestBody({ item, issue, ticket }) {
  const title = String(item?.title || item?.content || '제목 없음').trim();
  const description = String(item?.description || '').trim();
  const descriptionPreview = description
    ? description.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').slice(0, 500)
    : '여기에 왜 이 PR이 필요했는지, PR을 통해 무엇이 바뀌는지에 대해서 설명해 주세요';
  const ticketKey = String(ticket?.ticket_key || item?.ticket_key || '').trim();

  return [
    '## 💡 Motivation and Context',
    ticketKey ? `- 티켓: ${ticketKey}` : null,
    title ? `- 아이템: ${title}` : null,
    `- ${descriptionPreview}`,
    '',
    '<br>',
    '',
    '## 🔨 Modified',
    '> 여기에 무엇이 크게 바뀌었는지 설명해 주세요',
    '  - _여기에 세부 변경사항을 설명해주세요_',
    '',
    '<br>',
    '',
    '## 🌟 What Changed',
    '- _여기에 PR 이후 추가로 해야 할 일에 대해서 설명해 주세요_',
    '',
    '<br>',
    '',
    '---',
    '',
    '',
    '### 📋 커밋 전 체크리스트',
    '- [ ] 단위 테스트',
    '- [ ] 수동 테스트',
    '- [ ] 로컬 확인',
    '',
    '<br>',
    '',
    '### 🤟🏻 PR로 완료된 이슈',
    `closes #${issue.number}`,
  ].filter((line) => line !== null).join('\n');
}

function parseGitHubScopes(scopeValue) {
  return String(scopeValue || '')
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function hasGitHubScope(connection, expectedScope) {
  return parseGitHubScopes(connection?.scope).includes(expectedScope);
}

function normalizeGitHubAppInstallations(payload) {
  const installations = Array.isArray(payload?.installations)
    ? payload.installations
    : Array.isArray(payload)
      ? payload
      : [];

  return installations.filter((installation) => installation && typeof installation === 'object');
}

function encodeBase64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function createGitHubAppJwt() {
  if (!isGitHubAppAuthConfigured()) {
    throw createHttpError(500, 'GitHub App private key server configuration is missing.');
  }

  const issuedAt = Math.floor(Date.now() / 1000) - 60;
  const expiresAt = issuedAt + 9 * 60;
  const header = encodeBase64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const payload = encodeBase64UrlJson({
    iat: issuedAt,
    exp: expiresAt,
    iss: GITHUB_APP_ID,
  });
  const signingInput = `${header}.${payload}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput, 'utf8'), GITHUB_APP_PRIVATE_KEY);

  return `${signingInput}.${signature.toString('base64url')}`;
}

async function fetchGitHubAppJson(url, init = {}) {
  return fetchGitHubJson(url, createGitHubAppJwt(), init);
}

async function getGitHubAppInstallations() {
  if (!isGitHubAppConfigured() || !isGitHubAppAuthConfigured()) return [];

  const payload = await fetchGitHubAppJson(
    'https://api.github.com/app/installations?per_page=100'
  );
  return normalizeGitHubAppInstallations(payload);
}

async function createGitHubInstallationToken(installationId) {
  const payload = await fetchGitHubAppJson(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  );

  if (!payload?.token) {
    throw createHttpError(500, 'GitHub App installation token을 발급받지 못했습니다.');
  }

  return payload.token;
}

async function getGitHubAppInstalledRepoIndex() {
  const repoIndex = new Map();
  const installations = await getGitHubAppInstallations();

  for (const installation of installations) {
    const installationId = installation?.id;
    if (!installationId) continue;

    const installationToken = await createGitHubInstallationToken(installationId);
    const payload = await fetchGitHubJson(
      'https://api.github.com/installation/repositories?per_page=100',
      installationToken
    );
    const repositories = Array.isArray(payload?.repositories) ? payload.repositories : [];

    for (const repo of repositories) {
      if (!repo?.full_name) continue;
      repoIndex.set(repo.full_name, {
        installationId,
        accountLogin: installation?.account?.login || null,
      });
    }
  }

  return { installations, repoIndex };
}

async function listAccessibleGitHubRepos(connection, { requireWrite = false } = {}) {
  const repos = await fetchGitHubJson(
    'https://api.github.com/user/repos?per_page=100&sort=updated',
    connection.access_token
  );

  let filteredRepos = (Array.isArray(repos) ? repos : []).filter((repo) => {
    if (requireWrite) return canWriteRepo(repo);
    return Boolean(repo?.permissions?.pull || canWriteRepo(repo));
  });

  if (isGitHubAppConfigured()) {
    if (!isGitHubAppAuthConfigured()) {
      throw createHttpError(500, 'GitHub App private key server configuration is missing.');
    }

    const { repoIndex } = await getGitHubAppInstalledRepoIndex();
    filteredRepos = filteredRepos.filter((repo) => repoIndex.has(repo.full_name));
  }

  return filteredRepos;
}

function buildRoadmapLink(item) {
  if (!item?.id) return null;
  return {
    id: item.id,
    title: item.title || item.content || '제목 없음',
    boardType: item.board_type || 'main',
    status: item.status || 'none',
    ticketKey: item.ticket_key || null,
  };
}

async function fetchRoadmapItemsByIds(itemIds) {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return new Map();
  }

  const normalizedIds = [...new Set(itemIds.map((id) => String(id || '')).filter(Boolean))];
  const itemMap = new Map();

  for (const table of [{ name: 'items' }, { name: 'roadmap_items', mainOnly: true }]) {
    let query = supabaseAdminClient
      .from(table.name)
      .select('id, title, content, board_type, status, ticket_key')
      .in('id', normalizedIds);

    if (table.mainOnly) {
      query = query.eq('board_type', 'main');
    }

    const { data, error } = await query;

    if (error) {
      if (isMissingTicketSchemaError(error)) continue;
      throw error;
    }

    for (const item of data || []) {
      if (!itemMap.has(item.id)) {
        itemMap.set(item.id, buildRoadmapLink(item));
      }
    }
  }

  return itemMap;
}

async function fetchRoadmapItemsByTicketKeys(ticketKeys) {
  if (!Array.isArray(ticketKeys) || ticketKeys.length === 0) {
    return new Map();
  }

  const normalizedKeys = [...new Set(ticketKeys.map((key) => String(key || '').trim()).filter(Boolean))];
  const ticketMap = new Map();

  for (const table of [{ name: 'items' }, { name: 'roadmap_items', mainOnly: true }]) {
    let query = supabaseAdminClient
      .from(table.name)
      .select('id, title, content, board_type, status, ticket_key')
      .in('ticket_key', normalizedKeys);

    if (table.mainOnly) {
      query = query.eq('board_type', 'main');
    }

    const { data, error } = await query;

    if (error) {
      if (isMissingTicketSchemaError(error)) continue;
      throw error;
    }

    for (const item of data || []) {
      if (!ticketMap.has(item.ticket_key)) {
        ticketMap.set(item.ticket_key, buildRoadmapLink(item));
      }
    }
  }

  return ticketMap;
}

async function fetchLinkedIssueMap(repoFullName, issueNumbers) {
  if (!Array.isArray(issueNumbers) || issueNumbers.length === 0) {
    return new Map();
  }

  const normalizedNumbers = [...new Set(issueNumbers.map((number) => Number(number)).filter(Number.isFinite))];
  const { data, error } = await supabaseAdminClient
    .from('item_github_issues')
    .select('item_id, issue_number')
    .eq('repo_full_name', repoFullName)
    .in('issue_number', normalizedNumbers);

  if (error) throw error;

  const itemIdMap = new Map();
  const itemIds = [];

  for (const record of data || []) {
    itemIdMap.set(record.issue_number, record.item_id);
    itemIds.push(record.item_id);
  }

  const itemsById = await fetchRoadmapItemsByIds(itemIds);
  return new Map(
    [...itemIdMap.entries()]
      .map(([issueNumber, itemId]) => [issueNumber, itemsById.get(itemId) || null])
  );
}

async function upsertGitHubIssueLink({ itemId, repoFullName, issuePayload, userId }) {
  const existingRecord = await getGitHubIssueRecord(repoFullName, issuePayload.number);
  const record = {
    item_id: itemId,
    repo_full_name: repoFullName,
    issue_number: issuePayload.number,
    issue_url: issuePayload.html_url,
    github_issue_id: issuePayload.id,
    issue_title_snapshot: issuePayload.title,
    issue_state_snapshot: issuePayload.state,
  };

  if (existingRecord) {
    const { data, error } = await supabaseAdminClient
      .from('item_github_issues')
      .update(record)
      .eq('id', existingRecord.id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabaseAdminClient
    .from('item_github_issues')
    .insert({
      ...record,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function upsertGitHubPullRequestLink({ itemId, repoFullName, pullRequestPayload, userId }) {
  const existingRecord = await getGitHubPullRequestRecord(repoFullName, pullRequestPayload.number);
  const record = {
    item_id: itemId,
    repo_full_name: repoFullName,
    pull_number: pullRequestPayload.number,
    pull_url: pullRequestPayload.html_url,
    github_pull_request_id: pullRequestPayload.id,
    pull_title_snapshot: pullRequestPayload.title,
    pull_state_snapshot: pullRequestPayload.merged_at ? 'merged' : (pullRequestPayload.state || 'open'),
    head_ref: pullRequestPayload.head?.ref || null,
    base_ref: pullRequestPayload.base?.ref || null,
    is_draft: Boolean(pullRequestPayload.draft),
  };

  if (existingRecord) {
    const { data, error } = await supabaseAdminClient
      .from('item_github_pull_requests')
      .update(record)
      .eq('id', existingRecord.id)
      .select('*')
      .single();

    if (error) {
      if (isMissingGitHubPullRequestSchemaError(error)) {
        throw createHttpError(500, GITHUB_PULL_REQUESTS_SCHEMA_ERROR_MESSAGE);
      }
      throw error;
    }
    return data;
  }

  const { data, error } = await supabaseAdminClient
    .from('item_github_pull_requests')
    .insert({
      ...record,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) {
    if (isMissingGitHubPullRequestSchemaError(error)) {
      throw createHttpError(500, GITHUB_PULL_REQUESTS_SCHEMA_ERROR_MESSAGE);
    }
    throw error;
  }
  return data;
}

function extractTicketKeysFromText(...values) {
  const pattern = new RegExp(
    `\\b${escapeRegex(TICKET_KEY_PREFIX)}-(?:[A-Z0-9][A-Z0-9-]*-)?\\d+\\b`,
    'g'
  );
  const ticketKeys = new Set();

  for (const value of values) {
    const matches = String(value || '').match(pattern);
    for (const match of matches || []) {
      ticketKeys.add(match);
    }
  }

  return [...ticketKeys];
}

function mapCommitSummary(commit) {
  if (!commit?.sha) return null;

  const message = String(commit.commit?.message || '').split('\n')[0] || commit.sha.slice(0, 7);
  const committedAt = commit.commit?.author?.date || commit.commit?.committer?.date || null;

  return {
    sha: commit.sha,
    shortSha: commit.sha.slice(0, 7),
    message,
    authorName: commit.author?.login || commit.commit?.author?.name || 'Unknown',
    committedAt,
    url: commit.html_url || null,
  };
}

function mapIssueSummary(issue, linkedItem = null) {
  if (!issue?.number) return null;

  return {
    id: issue.id,
    number: issue.number,
    title: issue.title || `Issue #${issue.number}`,
    state: issue.state || 'open',
    comments: issue.comments || 0,
    createdAt: issue.created_at || null,
    updatedAt: issue.updated_at || null,
    closedAt: issue.closed_at || null,
    url: issue.html_url || null,
    author: issue.user?.login || 'unknown',
    labels: Array.isArray(issue.labels)
      ? issue.labels.map((label) => ({
          id: label.id,
          name: label.name,
          color: label.color,
        }))
      : [],
    linkedItem,
  };
}

function mapPullRequestSummary(pr, linkedItem = null) {
  if (!pr?.number) return null;

  return {
    id: pr.id,
    number: pr.number,
    title: pr.title || `PR #${pr.number}`,
    state: pr.merged_at ? 'merged' : pr.state || 'open',
    draft: Boolean(pr.draft),
    comments: pr.comments || 0,
    reviewComments: pr.review_comments || 0,
    createdAt: pr.created_at || null,
    updatedAt: pr.updated_at || null,
    closedAt: pr.closed_at || null,
    mergedAt: pr.merged_at || null,
    url: pr.html_url || null,
    author: pr.user?.login || 'unknown',
    headRef: pr.head?.ref || null,
    baseRef: pr.base?.ref || null,
    requestedReviewers: Array.isArray(pr.requested_reviewers)
      ? pr.requested_reviewers.map((reviewer) => reviewer?.login).filter(Boolean)
      : [],
    linkedItem,
  };
}

function buildRepositoryActivity({ pulls = [], issues = [], commits = [] }) {
  const activity = [];

  for (const pr of pulls) {
    activity.push({
      type: 'pull_request',
      action: pr.state,
      title: pr.title,
      number: pr.number,
      actor: pr.author,
      at: pr.mergedAt || pr.updatedAt || pr.createdAt,
      url: pr.url,
      linkedItem: pr.linkedItem || null,
    });
  }

  for (const issue of issues) {
    activity.push({
      type: 'issue',
      action: issue.state,
      title: issue.title,
      number: issue.number,
      actor: issue.author,
      at: issue.closedAt || issue.updatedAt || issue.createdAt,
      url: issue.url,
      linkedItem: issue.linkedItem || null,
    });
  }

  for (const commit of commits) {
    activity.push({
      type: 'commit',
      action: 'pushed',
      title: commit.message,
      sha: commit.shortSha,
      actor: commit.authorName,
      at: commit.committedAt,
      url: commit.url,
      linkedItem: null,
    });
  }

  return activity
    .filter((entry) => entry.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 25);
}

function getLinkedItemsFromEntities(entities) {
  return [
    ...new Map(
      entities
        .map((entity) => entity?.linkedItem)
        .filter(Boolean)
        .map((item) => [item.id, item])
    ).values(),
  ];
}

async function mapPullsWithLinks(rawPulls) {
  const prTicketKeys = rawPulls.flatMap((pr) => extractTicketKeysFromText(pr.title, pr.body));
  const itemsByTicketKey = await fetchRoadmapItemsByTicketKeys(prTicketKeys);

  return rawPulls
    .map((pr) => {
      const ticketKey = extractTicketKeysFromText(pr.title, pr.body)[0] || null;
      return mapPullRequestSummary(pr, ticketKey ? itemsByTicketKey.get(ticketKey) || null : null);
    })
    .filter(Boolean);
}

async function mapIssuesWithLinks(repoFullName, rawIssues) {
  const linkedIssueMap = await fetchLinkedIssueMap(
    repoFullName,
    rawIssues.map((issue) => issue.number)
  );

  return rawIssues
    .map((issue) => mapIssueSummary(issue, linkedIssueMap.get(issue.number) || null))
    .filter(Boolean);
}

function normalizeGitHubLabels(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(
    tags.map((tag) => String(tag || '').trim()).filter(Boolean)
  )];
}

async function ensureGitHubLabel(repoFullName, labelName, token) {
  const preset = TAG_CATALOG_BY_NAME.get(labelName);
  const description = String(preset?.description || '').trim().slice(0, 100) || undefined;

  try {
    await fetchGitHubJson(`https://api.github.com/repos/${repoFullName}/labels`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: labelName,
        color: preset?.color || '64748b',
        ...(description ? { description } : {}),
      }),
    });
  } catch (error) {
    if (error.status === 422) return;
    throw error;
  }
}

async function addGitHubIssueLabels(repoFullName, issueNumber, labels, token) {
  const normalizedLabels = normalizeGitHubLabels(labels);
  if (normalizedLabels.length === 0) return [];

  const appliedLabels = await fetchGitHubJson(
    `https://api.github.com/repos/${repoFullName}/issues/${issueNumber}/labels`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labels: normalizedLabels }),
    }
  );

  return Array.isArray(appliedLabels) ? appliedLabels : [];
}

function parseRepoFullName(repoFullName) {
  const [owner, repo] = String(repoFullName || '').split('/');
  if (!owner || !repo) {
    throw createHttpError(400, '유효한 repoFullName이 필요합니다.');
  }

  return { owner, repo };
}

async function fetchGitHubGraphql(token, query, variables = {}) {
  const payload = await fetchGitHubJson('https://api.github.com/graphql', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    const error = new Error(payload.errors[0]?.message || 'GitHub GraphQL 요청 처리에 실패했습니다.');
    error.status = 422;
    error.payload = payload;
    throw error;
  }

  return payload?.data ?? null;
}

function mapLinkedBranchSummary({ linkedBranch, repoUrl }) {
  const branchName = linkedBranch?.ref?.name || null;
  if (!linkedBranch?.id || !branchName) return null;

  return {
    linkedBranchId: linkedBranch.id,
    branchName,
    branchUrl: repoUrl ? `${repoUrl}/tree/${encodeURIComponent(branchName)}` : null,
  };
}

function mapRepositoryBranchSummary(branchName, repoUrl) {
  if (!branchName) return null;
  return {
    linkedBranchId: null,
    branchName,
    branchUrl: repoUrl ? `${repoUrl}/tree/${encodeURIComponent(branchName)}` : null,
  };
}

function branchMatchesTicketKey(branchName, ticketKey) {
  const normalizedBranch = String(branchName || '').trim().toLowerCase();
  const normalizedTicket = String(ticketKey || '').trim().toLowerCase();
  if (!normalizedBranch || !normalizedTicket) return false;
  return normalizedBranch === normalizedTicket || normalizedBranch.startsWith(`${normalizedTicket}-`);
}

function pickPreferredTicketBranch(branches, ticketKey) {
  if (!Array.isArray(branches) || branches.length === 0 || !ticketKey) return null;

  const exactMatch = branches.find((branch) => (
    String(branch?.branchName || '').trim().toLowerCase() === String(ticketKey).trim().toLowerCase()
  ));
  if (exactMatch) return exactMatch;

  return branches.find((branch) => branchMatchesTicketKey(branch?.branchName, ticketKey)) || null;
}

function ensurePullRequestClosingLine(body, issueNumber) {
  const closingLine = `closes #${issueNumber}`;
  const normalizedBody = String(body || '').trimEnd();
  const hasClosingLine = new RegExp(`\\b(?:close|closes|closed|fix|fixes|fixed)\\s+#${Number(issueNumber)}\\b`, 'i')
    .test(normalizedBody);

  if (hasClosingLine) return normalizedBody;
  if (!normalizedBody) return closingLine;
  return `${normalizedBody}\n\n${closingLine}`;
}

async function findOpenPullRequestByHead(token, repoFullName, branchName) {
  const { owner } = parseRepoFullName(repoFullName);
  const pulls = await fetchGitHubJson(
    `https://api.github.com/repos/${repoFullName}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branchName}`)}&per_page=10`,
    token
  );
  const normalizedBranch = String(branchName || '').trim();
  return (Array.isArray(pulls) ? pulls : []).find((pull) => (
    String(pull?.head?.ref || '').trim() === normalizedBranch
  )) || null;
}

async function getGitHubIssueBranchState(token, repoFullName, issueNumber) {
  const { owner, repo } = parseRepoFullName(repoFullName);
  const data = await fetchGitHubGraphql(
    token,
    `
      query GetIssueLinkedBranch($owner: String!, $repo: String!, $issueNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          url
          issue(number: $issueNumber) {
            id
            linkedBranches(first: 10) {
              totalCount
              nodes {
                id
                ref {
                  name
                }
              }
            }
          }
        }
      }
    `,
    { owner, repo, issueNumber: Number(issueNumber) }
  );

  const issue = data?.repository?.issue;
  if (!issue?.id) {
    throw createHttpError(404, 'GitHub 이슈를 찾을 수 없습니다.');
  }

  const branches = (issue.linkedBranches?.nodes || [])
    .map((linkedBranch) => mapLinkedBranchSummary({
      linkedBranch,
      repoUrl: data?.repository?.url || `https://github.com/${repoFullName}`,
    }))
    .filter(Boolean);

  return {
    issueId: issue.id,
    totalCount: issue.linkedBranches?.totalCount || 0,
    branch: branches[0] || null,
    branches,
  };
}

async function findRepositoryBranchByTicketKey(token, repoFullName, ticketKey, repoUrl = null) {
  const normalizedTicketKey = String(ticketKey || '').trim();
  if (!normalizedTicketKey) return null;

  const candidates = [...new Set([normalizedTicketKey, normalizedTicketKey.toLowerCase()])];
  const matchedBranches = [];

  for (const candidate of candidates) {
    const refs = await fetchGitHubJson(
      `https://api.github.com/repos/${repoFullName}/git/matching-refs/heads/${encodeURIComponent(candidate)}`,
      token
    );
    for (const ref of Array.isArray(refs) ? refs : []) {
      const branchName = String(ref?.ref || '').replace(/^refs\/heads\//, '');
      if (!branchMatchesTicketKey(branchName, normalizedTicketKey)) continue;
      matchedBranches.push(mapRepositoryBranchSummary(
        branchName,
        repoUrl || `https://github.com/${repoFullName}`
      ));
    }
  }

  return pickPreferredTicketBranch(
    [...new Map(matchedBranches.map((branch) => [branch.branchName, branch])).values()],
    normalizedTicketKey
  );
}

async function createGitHubIssueLinkedBranch({ token, repoFullName, issueNumber, branchName }) {
  const { owner, repo } = parseRepoFullName(repoFullName);
  const repoData = await fetchGitHubGraphql(
    token,
    `
      query PrepareLinkedBranch($owner: String!, $repo: String!, $issueNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          id
          url
          issue(number: $issueNumber) {
            id
            linkedBranches(first: 10) {
              totalCount
              nodes {
                id
                ref {
                  name
                }
              }
            }
          }
          ref(qualifiedName: "refs/heads/dev") {
            target {
              ... on Commit {
                oid
              }
            }
          }
        }
      }
    `,
    { owner, repo, issueNumber: Number(issueNumber) }
  );

  const repository = repoData?.repository;
  const issue = repository?.issue;
  const baseOid = repository?.ref?.target?.oid || null;
  if (!repository?.id || !issue?.id || !baseOid) {
    throw createHttpError(409, 'dev 브랜치를 찾지 못해 linked branch를 생성할 수 없습니다.');
  }

  const existingBranch = issue.linkedBranches?.nodes?.find(
    (candidate) => candidate?.ref?.name === branchName
  ) || issue.linkedBranches?.nodes?.[0] || null;

  if (existingBranch) {
    return {
      created: false,
      branch: mapLinkedBranchSummary({
        linkedBranch: existingBranch,
        repoUrl: repository.url || `https://github.com/${repoFullName}`,
      }),
      totalCount: issue.linkedBranches?.totalCount || 1,
    };
  }

  const mutationData = await fetchGitHubGraphql(
    token,
    `
      mutation CreateLinkedBranch(
        $issueId: ID!
        $repositoryId: ID!
        $name: String!
        $oid: GitObjectID!
      ) {
        createLinkedBranch(
          input: {
            issueId: $issueId
            repositoryId: $repositoryId
            name: $name
            oid: $oid
          }
        ) {
          linkedBranch {
            id
            ref {
              name
            }
          }
        }
      }
    `,
    {
      issueId: issue.id,
      repositoryId: repository.id,
      name: branchName,
      oid: baseOid,
    }
  );

  return {
    created: true,
    branch: mapLinkedBranchSummary({
      linkedBranch: mutationData?.createLinkedBranch?.linkedBranch,
      repoUrl: repository.url || `https://github.com/${repoFullName}`,
    }),
    totalCount: (issue.linkedBranches?.totalCount || 0) + 1,
  };
}

function buildGitHubApiErrorMessage(error) {
  const base = error?.message || 'GitHub 요청 처리에 실패했습니다.';
  const detail = error?.payload?.errors;

  if (!Array.isArray(detail) || detail.length === 0) {
    return base;
  }

  const summary = detail
    .map((item) => item?.message || item?.code || item?.field)
    .filter(Boolean)
    .join(', ');

  return summary ? `${base} (${summary})` : base;
}

// ─── 라우트 ──────────────────────────────────────────────────────────────────

router.get('/connect/start', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const state = encodeState({
      userId: user.id,
      issuedAt: Date.now(),
      nonce: crypto.randomUUID(),
    });

    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: GITHUB_REDIRECT_URI,
      scope: 'repo read:user read:org',
      state,
    });

    res.json({
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    });
  } catch (error) {
    console.error('GitHub connect start error:', error);
    res.status(500).json({ error: 'GitHub 연결 시작에 실패했습니다.' });
  }
});

router.get('/connect/callback', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).send('Missing OAuth callback parameters.');
    }

    const decodedState = decodeState(String(state));
    if (!decodedState?.userId) {
      return res.status(400).send('Invalid OAuth state payload.');
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'GitHub token exchange failed');
    }

    const profile = await fetchGitHubJson('https://api.github.com/user', tokenData.access_token);

    const { error } = await supabaseAdminClient
      .from('user_github_connections')
      .upsert(
        {
          user_id: decodedState.userId,
          github_user_id: profile.id,
          github_login: profile.login,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          token_expires_at: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
            : null,
          scope: tokenData.scope || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) throw error;

    const redirectUrl = new URL(APP_BASE_URL);
    redirectUrl.searchParams.set('github_connected', '1');
    res.redirect(302, redirectUrl.toString());
  } catch (error) {
    console.error('GitHub callback error:', error);
    const redirectUrl = new URL(APP_BASE_URL);
    redirectUrl.searchParams.set('github_error', '1');
    res.redirect(302, redirectUrl.toString());
  }
});

router.get('/app/install/start', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;
    if (!isGitHubAppConfigured()) {
      return res.status(500).json({ error: 'GitHub App server configuration is missing.' });
    }

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const state = encodeState({
      flow: 'github-app-install',
      userId: user.id,
      issuedAt: Date.now(),
      nonce: crypto.randomUUID(),
    });

    const params = new URLSearchParams({ state });
    const appInstallUrl = `https://github.com/apps/${encodeURIComponent(GITHUB_APP_SLUG)}/installations/new?${params.toString()}`;
    res.json({ url: appInstallUrl });
  } catch (error) {
    console.error('GitHub App install start error:', error);
    res.status(500).json({ error: 'GitHub App 설치를 시작하지 못했습니다.' });
  }
});

router.get('/app/install/callback', async (req, res) => {
  try {
    if (!isGitHubAppConfigured()) {
      return res.status(500).send('GitHub App server configuration is missing.');
    }

    const { installation_id: installationId, setup_action: setupAction, state } = req.query;
    if (!installationId || !setupAction) {
      return res.status(400).send('Missing GitHub App installation callback parameters.');
    }

    if (state) {
      // Validate signed state to prevent open redirect abuse.
      decodeState(String(state));
    }

    const redirectUrl = new URL(APP_BASE_URL);
    redirectUrl.searchParams.set('github_app_installed', '1');
    redirectUrl.searchParams.set('github_app_installation_id', String(installationId));
    if (setupAction) {
      redirectUrl.searchParams.set('github_app_setup_action', String(setupAction));
    }
    res.redirect(302, redirectUrl.toString());
  } catch (error) {
    console.error('GitHub App install callback error:', error);
    const redirectUrl = new URL(APP_BASE_URL);
    redirectUrl.searchParams.set('github_app_error', '1');
    res.redirect(302, redirectUrl.toString());
  }
});

router.get('/status', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const accessToken = getBearerToken(req);
    const userClient = createSupabaseUserClient(accessToken);
    if (!userClient) {
      return res.status(500).json({ error: 'Supabase user client is not configured.' });
    }

    const connection = await getStoredGitHubConnection(user.id, userClient);
    const appConfigured = isGitHubAppConfigured();
    const appAuthConfigured = isGitHubAppAuthConfigured();

    if (!connection) {
      return res.json({
        connected: false,
        app: {
          configured: appConfigured,
          authConfigured: appAuthConfigured,
          slug: GITHUB_APP_SLUG || null,
          installRedirectUri: appConfigured ? GITHUB_APP_INSTALL_REDIRECT_URI : null,
          installed: false,
          installationCount: 0,
        },
      });
    }

    let appInstallations = [];
    if (appConfigured && appAuthConfigured && connection.access_token) {
      const repos = await fetchGitHubJson(
        'https://api.github.com/user/repos?per_page=100&sort=updated',
        connection.access_token
      );
      const userRepoNames = new Set(
        (Array.isArray(repos) ? repos : [])
          .map((repo) => repo?.full_name)
          .filter(Boolean)
      );
      const { repoIndex } = await getGitHubAppInstalledRepoIndex();
      const matchedInstallationIds = new Set();

      for (const repoFullName of userRepoNames) {
        const installation = repoIndex.get(repoFullName);
        if (installation?.installationId) {
          matchedInstallationIds.add(installation.installationId);
        }
      }

      appInstallations = [...matchedInstallationIds];
    }

    res.json({
      connected: true,
      githubLogin: connection.github_login,
      githubUserId: connection.github_user_id,
      scope: connection.scope,
      app: {
        configured: appConfigured,
        authConfigured: appAuthConfigured,
        slug: GITHUB_APP_SLUG || null,
        installRedirectUri: appConfigured ? GITHUB_APP_INSTALL_REDIRECT_URI : null,
        installed: appInstallations.length > 0,
        installationCount: appInstallations.length,
      },
    });
  } catch (error) {
    console.error('GitHub status error:', error);
    res.status(500).json({ error: 'GitHub 연결 상태를 불러오지 못했습니다.' });
  }
});

router.get('/repos', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const connection = await requireGitHubRepoConnection(user.id);
    const repos = await listAccessibleGitHubRepos(connection, { requireWrite: true });
    const filteredRepos = repos
      .map((repo) => ({
        id: repo.id,
        full_name: repo.full_name,
        owner: repo.owner?.login,
        name: repo.name,
        private: repo.private,
        permissions: repo.permissions || {},
      }));

    res.json({ repos: filteredRepos });
  } catch (error) {
    console.error('GitHub repos error:', error);
    res.status(error.status || 500).json({ error: error.message || '레포 목록을 불러오지 못했습니다.' });
  }
});

router.get('/dashboard/repositories', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const cacheKey = `dashboard:list:${user.id}`;
    const cached = getCachedDashboardValue(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const connection = await requireGitHubRepoConnection(user.id);
    const repos = await listAccessibleGitHubRepos(connection, { requireWrite: false });
    const payload = {
      repositories: repos.map((repo) => ({
        id: repo.id,
        fullName: repo.full_name,
        name: repo.name,
        owner: repo.owner?.login || '',
        private: Boolean(repo.private),
        description: repo.description || '',
        htmlUrl: repo.html_url || null,
        defaultBranch: repo.default_branch || 'main',
        updatedAt: repo.updated_at || null,
        pushedAt: repo.pushed_at || null,
        latestCommit: null,
        openPullRequests: null,
        openIssues: Number(repo.open_issues_count) || 0,
        lastSyncedAt: new Date().toISOString(),
      })),
    };

    res.json(setCachedDashboardValue(cacheKey, payload, DASHBOARD_LIST_TTL_MS));
  } catch (error) {
    console.error('GitHub dashboard repositories error:', error);
    res.status(error.status || 500).json({ error: error.message || '레포지토리 대시보드를 불러오지 못했습니다.' });
  }
});

router.get('/dashboard/repository/overview', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const repoFullName = String(req.query?.repoFullName || '').trim();
    if (!repoFullName || !repoFullName.includes('/')) {
      return res.status(400).json({ error: 'repoFullName 쿼리가 필요합니다.' });
    }

    const cacheKey = `dashboard:overview:${user.id}:${repoFullName}`;
    const cached = getCachedDashboardValue(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const connection = await requireGitHubRepoConnection(user.id);
    const repos = await listAccessibleGitHubRepos(connection, { requireWrite: false });
    const repo = repos.find((candidate) => candidate.full_name === repoFullName);

    if (!repo) {
      return res.status(404).json({ error: '접근 가능한 레포지토리를 찾지 못했습니다.' });
    }

    const repositorySettings = await getRepositorySettings(repoFullName);
    const [
      repoMeta,
      pullsPayload,
      issuesPayload,
    ] = await Promise.all([
      fetchGitHubJson(`https://api.github.com/repos/${repoFullName}`, connection.access_token),
      fetchGitHubJson(
        `https://api.github.com/repos/${repoFullName}/pulls?state=all&sort=updated&direction=desc&per_page=8`,
        connection.access_token
      ),
      fetchGitHubJson(
        `https://api.github.com/repos/${repoFullName}/issues?state=all&sort=updated&direction=desc&per_page=8`,
        connection.access_token
      ),
    ]);

    const rawPulls = Array.isArray(pullsPayload) ? pullsPayload : [];
    const rawIssues = (Array.isArray(issuesPayload) ? issuesPayload : []).filter((issue) => !issue?.pull_request);
    const [pulls, issues] = await Promise.all([
      mapPullsWithLinks(rawPulls),
      mapIssuesWithLinks(repoFullName, rawIssues),
    ]);
    const linkedItems = getLinkedItemsFromEntities([...pulls, ...issues]);

    const payload = {
      repository: {
        id: repoMeta.id,
        fullName: repoMeta.full_name,
        name: repoMeta.name,
        owner: repoMeta.owner?.login || '',
        private: Boolean(repoMeta.private),
        description: repoMeta.description || '',
        htmlUrl: repoMeta.html_url || null,
        defaultBranch: repoMeta.default_branch || repo.default_branch || 'main',
        updatedAt: repoMeta.updated_at || null,
        pushedAt: repoMeta.pushed_at || null,
      },
      summary: {
        openPullRequests: pulls.filter((pr) => pr.state === 'open').length,
        openIssues: issues.filter((issue) => issue.state === 'open').length,
        linkedItems: linkedItems.length,
        latestCommitAt: repoMeta.pushed_at || null,
        lastSyncedAt: new Date().toISOString(),
      },
      repositorySettings,
      overviewPulls: pulls,
      overviewIssues: issues,
      activity: buildRepositoryActivity({ pulls, issues }),
      linkedItems,
    };

    res.json(setCachedDashboardValue(cacheKey, payload, DASHBOARD_DETAIL_TTL_MS));
  } catch (error) {
    console.error('GitHub dashboard repository overview error:', error);
    res.status(error.status || 500).json({ error: error.message || '레포지토리 개요를 불러오지 못했습니다.' });
  }
});

router.get('/dashboard/repository/settings', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const repoFullName = String(req.query?.repoFullName || '').trim();
    if (!repoFullName || !repoFullName.includes('/')) {
      return res.status(400).json({ error: 'repoFullName 쿼리가 필요합니다.' });
    }

    const connection = await requireGitHubRepoConnection(user.id);
    const repos = await listAccessibleGitHubRepos(connection, { requireWrite: false });
    if (!repos.some((repo) => repo.full_name === repoFullName)) {
      return res.status(404).json({ error: '접근 가능한 레포지토리를 찾지 못했습니다.' });
    }

    const settings = await getRepositorySettings(repoFullName);
    res.json({ settings });
  } catch (error) {
    console.error('GitHub repository settings get error:', error);
    res.status(error.status || 500).json({ error: error.message || '레포지토리 설정을 불러오지 못했습니다.' });
  }
});

router.put('/dashboard/repository/settings', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const { repoFullName, ticketPrefix } = req.body || {};
    if (!repoFullName || !String(repoFullName).includes('/')) {
      return res.status(400).json({ error: 'repoFullName이 필요합니다.' });
    }

    const connection = await requireGitHubRepoConnection(user.id);
    const repos = await listAccessibleGitHubRepos(connection, { requireWrite: false });
    if (!repos.some((repo) => repo.full_name === repoFullName)) {
      return res.status(404).json({ error: '접근 가능한 레포지토리를 찾지 못했습니다.' });
    }

    const settings = await saveRepositorySettings({
      repoFullName,
      ticketPrefix,
      userId: user.id,
    });
    clearDashboardCacheForRepository(user.id, repoFullName);

    res.json({ settings });
  } catch (error) {
    console.error('GitHub repository settings save error:', error);
    res.status(error.status || 500).json({ error: error.message || '레포지토리 설정을 저장하지 못했습니다.' });
  }
});

router.get('/dashboard/repository/entities', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const repoFullName = String(req.query?.repoFullName || '').trim();
    const type = String(req.query?.type || '').trim();
    if (!repoFullName || !repoFullName.includes('/')) {
      return res.status(400).json({ error: 'repoFullName 쿼리가 필요합니다.' });
    }
    if (!['pulls', 'issues', 'commits'].includes(type)) {
      return res.status(400).json({ error: 'type은 pulls, issues, commits 중 하나여야 합니다.' });
    }

    const cacheKey = `dashboard:entities:${user.id}:${repoFullName}:${type}`;
    const cached = getCachedDashboardValue(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const connection = await requireGitHubRepoConnection(user.id);
    const repos = await listAccessibleGitHubRepos(connection, { requireWrite: false });
    const repo = repos.find((candidate) => candidate.full_name === repoFullName);
    if (!repo) {
      return res.status(404).json({ error: '접근 가능한 레포지토리를 찾지 못했습니다.' });
    }

    let items = [];

    if (type === 'pulls') {
      const pullsPayload = await fetchGitHubJson(
        `https://api.github.com/repos/${repoFullName}/pulls?state=all&sort=updated&direction=desc&per_page=20`,
        connection.access_token
      );
      items = await mapPullsWithLinks(Array.isArray(pullsPayload) ? pullsPayload : []);
    } else if (type === 'issues') {
      const issuesPayload = await fetchGitHubJson(
        `https://api.github.com/repos/${repoFullName}/issues?state=all&sort=updated&direction=desc&per_page=20`,
        connection.access_token
      );
      const rawIssues = (Array.isArray(issuesPayload) ? issuesPayload : []).filter((issue) => !issue?.pull_request);
      items = await mapIssuesWithLinks(repoFullName, rawIssues);
    } else {
      const commitsPayload = await fetchGitHubJson(
        `https://api.github.com/repos/${repoFullName}/commits?per_page=20&sha=${encodeURIComponent(repo.default_branch)}`,
        connection.access_token
      );
      items = (Array.isArray(commitsPayload) ? commitsPayload : []).map(mapCommitSummary).filter(Boolean);
    }

    const payload = {
      type,
      items,
      lastSyncedAt: new Date().toISOString(),
    };

    res.json(setCachedDashboardValue(cacheKey, payload, DASHBOARD_DETAIL_TTL_MS));
  } catch (error) {
    console.error('GitHub dashboard repository entities error:', error);
    res.status(error.status || 500).json({ error: error.message || '레포지토리 상세 목록을 불러오지 못했습니다.' });
  }
});

router.post('/dashboard/repository/link', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const { repoFullName, type, number, itemId } = req.body || {};
    const issueNumber = Number(number);

    if (!repoFullName || !String(repoFullName).includes('/') || !type || !Number.isFinite(issueNumber) || !itemId) {
      return res.status(400).json({ error: 'repoFullName, type, number, itemId가 필요합니다.' });
    }

    if (!['pulls', 'issues'].includes(type)) {
      return res.status(400).json({ error: 'type은 pulls 또는 issues여야 합니다.' });
    }

    const itemRecord = await findItemRecordById(itemId);
    if (!itemRecord) {
      return res.status(404).json({ error: '연결할 로드맵 아이템을 찾을 수 없습니다.' });
    }

    const connection = await requireGitHubRepoConnection(user.id);
    const repos = await listAccessibleGitHubRepos(connection, { requireWrite: false });
    const repo = repos.find((candidate) => candidate.full_name === repoFullName);

    if (!repo) {
      return res.status(404).json({ error: '접근 가능한 레포지토리를 찾지 못했습니다.' });
    }

    const issuePayload = await fetchGitHubJson(
      `https://api.github.com/repos/${repoFullName}/issues/${issueNumber}`,
      connection.access_token
    );
    const isPullRequest = Boolean(issuePayload?.pull_request);

    if (type === 'pulls' && !isPullRequest) {
      return res.status(400).json({ error: '선택한 번호는 PR이 아닙니다.' });
    }

    if (type === 'issues' && isPullRequest) {
      return res.status(400).json({ error: '선택한 번호는 이슈가 아니라 PR입니다.' });
    }

    const linkRecord = await upsertGitHubIssueLink({
      itemId,
      repoFullName,
      issuePayload,
      userId: user.id,
    });

    clearDashboardCacheForRepository(user.id, repoFullName);

    res.json({
      link: linkRecord,
      linkedItem: buildRoadmapLink(itemRecord.item),
    });
  } catch (error) {
    console.error('GitHub dashboard repository link error:', error);
    res.status(error.status || 500).json({ error: error.message || 'GitHub 항목을 로드맵 아이템에 연결하지 못했습니다.' });
  }
});

router.post('/issues', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const { itemId, repoFullName } = req.body || {};
    if (!itemId || !repoFullName) {
      return res.status(400).json({ error: 'itemId와 repoFullName이 필요합니다.' });
    }

    const existingIssue = await getExistingGitHubIssueForItem(itemId);
    if (existingIssue) {
      return res.status(409).json({
        error: '이 아이템에는 이미 GitHub 이슈가 연결되어 있습니다.',
        issue: existingIssue,
      });
    }

    const connection = await getStoredGitHubConnection(user.id);
    if (!connection?.access_token) {
      return res.status(400).json({ error: 'GitHub 계정이 연결되어 있지 않습니다.' });
    }

    if (!hasGitHubScope(connection, 'repo') && !hasGitHubScope(connection, 'public_repo')) {
      return res.status(403).json({
        error: '현재 GitHub 연결에 이슈 생성 권한이 없습니다. 프로필에서 GitHub를 재연결해주세요.',
      });
    }

    if (isGitHubAppConfigured()) {
      if (!isGitHubAppAuthConfigured()) {
        return res.status(500).json({
          error: 'GitHub App private key server configuration is missing.',
        });
      }

      const { repoIndex } = await getGitHubAppInstalledRepoIndex();
      if (repoIndex.size === 0) {
        return res.status(403).json({
          error: 'GitHub App 설치가 필요합니다. 프로필에서 GitHub App을 설치한 뒤 다시 시도해주세요.',
        });
      }

      if (!repoIndex.has(repoFullName)) {
        return res.status(403).json({
          error: '선택한 레포에 GitHub App이 설치되어 있지 않습니다. 해당 레포에 앱을 설치한 뒤 다시 시도해주세요.',
        });
      }
    }

    const itemRecord = await findItemRecordById(itemId);
    if (!itemRecord) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }

    const { item } = itemRecord;

    const repo = await fetchGitHubJson(`https://api.github.com/repos/${repoFullName}`, connection.access_token);
    const canWriteIssues = Boolean(
      repo?.permissions?.push ||
      repo?.permissions?.triage ||
      repo?.permissions?.maintain ||
      repo?.permissions?.admin
    );

    if (repo?.archived) {
      throw createHttpError(409, '보관된 레포에는 이슈를 생성할 수 없습니다.');
    }

    if (!repo?.has_issues) {
      throw createHttpError(400, '이 레포는 GitHub Issues가 비활성화되어 있습니다.');
    }

    if (!canWriteIssues) {
      throw createHttpError(403, '선택한 레포에 이슈를 생성할 권한이 없습니다.');
    }

    const repositorySettings = await getRepositorySettings(repoFullName);
    if (!repositorySettings?.ticket_prefix) {
      throw createHttpError(400, '이 레포지토리의 티켓 약어가 설정되지 않았습니다. 레포지토리 화면에서 티켓 약어를 먼저 설정해주세요.');
    }

    const ticket = await ensureItemTicket(itemRecord, repositorySettings.ticket_prefix);
    const itemStatus = await ensureItemStatusForIssue(itemRecord);
    const labelNames = normalizeGitHubLabels(item.tags);

    if (labelNames.length > 0) {
      for (const labelName of labelNames) {
        await ensureGitHubLabel(repoFullName, labelName, connection.access_token);
      }
    }

    const titleBase = item.title || item.content || '제목 없음';
    const title = `[${ticket.ticket_key}] ${titleBase}`;
    const body = buildIssueBody(item, ticket);
    const issue = await fetchGitHubJson(`https://api.github.com/repos/${repoFullName}/issues`, connection.access_token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body,
        ...(labelNames.length > 0 ? { labels: labelNames } : {}),
      }),
    });
    let appliedLabels = Array.isArray(issue.labels) ? issue.labels : [];
    let labelSync = {
      requested: labelNames,
      applied: appliedLabels.map((label) => label?.name).filter(Boolean),
      success: true,
      message: '',
    };

    if (labelNames.length > 0) {
      try {
        appliedLabels = await addGitHubIssueLabels(
          repoFullName,
          issue.number,
          labelNames,
          connection.access_token
        );
        labelSync = {
          requested: labelNames,
          applied: appliedLabels.map((label) => label?.name).filter(Boolean),
          success: true,
          message: '',
        };
      } catch (labelError) {
        labelSync = {
          requested: labelNames,
          applied: appliedLabels.map((label) => label?.name).filter(Boolean),
          success: false,
          message: buildGitHubApiErrorMessage(labelError),
        };
      }
    }

    const record = {
      item_id: itemId,
      repo_full_name: repoFullName,
      issue_number: issue.number,
      issue_url: issue.html_url,
      github_issue_id: issue.id,
      issue_title_snapshot: issue.title,
      issue_state_snapshot: issue.state,
      created_by: user.id,
    };

    const { data, error } = await supabaseAdminClient
      .from('item_github_issues')
      .insert(record)
      .select('*')
      .single();

    if (error) throw error;
    await lockRepositoryTicketPrefix(repoFullName);

    res.json({
      issue: {
        ...data,
        ticket_key: ticket.ticket_key,
        ticket_number: ticket.ticket_number,
        labels: appliedLabels,
      },
      ticket,
      repositorySettings: {
        ...repositorySettings,
        prefix_locked: true,
      },
      itemStatus,
      labelSync,
    });
  } catch (error) {
    console.error('GitHub issue create error:', error);
    if (error.status === 403) {
      const message = error.message || '';
      const needsReconnect =
        message.includes('Resource not accessible by integration') ||
        message.includes('Must have admin rights to Repository') ||
        message.includes('SAML') ||
        message.includes('SSO');

      return res.status(403).json({
        error: needsReconnect
          ? 'GitHub이 현재 레포 접근을 거부했습니다. 조직 SSO 승인 또는 GitHub 재연결 후 다시 시도해주세요.'
          : message || '선택한 레포에 이슈를 생성할 권한이 없습니다.',
      });
    }

    res.status(error.status || 500).json({ error: error.message || 'GitHub 이슈 생성에 실패했습니다.' });
  }
});

router.get('/issues/:issueNumber/branch', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const issueNumber = Number(req.params.issueNumber);
    const repoFullName = String(req.query.repoFullName || '').trim();
    if (!Number.isFinite(issueNumber) || !repoFullName) {
      return res.status(400).json({ error: 'issueNumber와 repoFullName이 필요합니다.' });
    }

    const connection = await requireGitHubRepoConnection(user.id);
    const branchState = await getGitHubIssueBranchState(connection.access_token, repoFullName, issueNumber);

    res.json({
      issueNumber,
      repoFullName,
      hasLinkedBranch: Boolean(branchState.branch),
      linkedBranch: branchState.branch,
      linkedBranchCount: branchState.totalCount,
    });
  } catch (error) {
    console.error('GitHub issue branch get error:', error);
    res.status(error.status || 500).json({ error: error.message || 'GitHub linked branch 정보를 불러오지 못했습니다.' });
  }
});

router.post('/issues/:issueNumber/branch', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const issueNumber = Number(req.params.issueNumber);
    const { itemId, repoFullName } = req.body || {};
    if (!Number.isFinite(issueNumber) || !itemId || !repoFullName) {
      return res.status(400).json({ error: 'itemId, issueNumber, repoFullName이 필요합니다.' });
    }

    const issueRecord = await getGitHubIssueRecord(repoFullName, issueNumber);
    if (!issueRecord || issueRecord.item_id !== itemId) {
      return res.status(404).json({ error: '이 아이템에 연결된 GitHub 이슈를 찾을 수 없습니다.' });
    }

    const itemRecord = await findItemRecordById(itemId);
    if (!itemRecord) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }

    const branchName = String(itemRecord.item?.ticket_key || '').trim();
    if (!branchName) {
      return res.status(409).json({ error: '티켓 키가 없어 브랜치를 생성할 수 없습니다. 먼저 GitHub 이슈를 생성해주세요.' });
    }

    const connection = await requireGitHubRepoConnection(user.id);
    const repo = await fetchGitHubJson(`https://api.github.com/repos/${repoFullName}`, connection.access_token);

    if (repo?.archived) {
      throw createHttpError(409, '보관된 레포에는 브랜치를 생성할 수 없습니다.');
    }

    if (!canCreateBranch(repo)) {
      throw createHttpError(403, '선택한 레포에 브랜치를 생성할 권한이 없습니다.');
    }

    const result = await createGitHubIssueLinkedBranch({
      token: connection.access_token,
      repoFullName,
      issueNumber,
      branchName,
    });

    res.json({
      issueNumber,
      repoFullName,
      linkedBranchId: result.branch?.linkedBranchId || null,
      branchName: result.branch?.branchName || branchName,
      branchUrl: result.branch?.branchUrl || `${repo.html_url}/tree/${encodeURIComponent(branchName)}`,
      hasLinkedBranch: Boolean(result.branch),
      created: result.created,
      linkedBranchCount: result.totalCount,
      linkedBranch: result.branch,
    });
  } catch (error) {
    console.error('GitHub issue branch create error:', error);
    res.status(error.status || 500).json({ error: error.message || 'GitHub linked branch 생성에 실패했습니다.' });
  }
});

router.get('/items/:itemId/branch', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const itemId = String(req.params.itemId || '').trim();
    if (!itemId) {
      return res.status(400).json({ error: 'itemId가 필요합니다.' });
    }

    const issueRecord = await getExistingGitHubIssueForItem(itemId);
    if (!issueRecord) {
      return res.json({
        hasLinkedIssue: false,
        hasLinkedBranch: false,
        linkedBranch: null,
        discoveredBranch: null,
        branch: null,
        branchSource: null,
        issue: null,
      });
    }

    const itemRecord = await findItemRecordById(itemId);
    if (!itemRecord) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }

    // DB 캐시 확인 (즉시 응답)
    const cachedBranchName = itemRecord.item?.github_linked_branch_name;
    const cachedBranchUrl = itemRecord.item?.github_linked_branch_url;
    const cachedBranchSource = itemRecord.item?.github_branch_source || null;
    
    if (cachedBranchName) {
      res.json({
        hasLinkedIssue: true,
        issue: {
          itemId,
          repoFullName: issueRecord.repo_full_name,
          issueNumber: issueRecord.issue_number,
          issueUrl: issueRecord.issue_url,
        },
        hasLinkedBranch: true,
        linkedBranch: {
          branchName: cachedBranchName,
          branchUrl: cachedBranchUrl,
        },
        discoveredBranch: null,
        branch: {
          branchName: cachedBranchName,
          branchUrl: cachedBranchUrl,
        },
        branchSource: cachedBranchSource,
        fromCache: true,
      });

      // 백그라운드에서 API 호출로 최신 정보 갱신 (비동기)
      setImmediate(async () => {
        try {
          const connection = await requireGitHubRepoConnection(user.id);
          const ticketKey = String(itemRecord.item?.ticket_key || '').trim();
          const branchState = await getGitHubIssueBranchState(
            connection.access_token,
            issueRecord.repo_full_name,
            issueRecord.issue_number
          );
          const matchedLinkedBranch = pickPreferredTicketBranch(branchState.branches, ticketKey);
          const discoveredBranch = await findRepositoryBranchByTicketKey(
            connection.access_token,
            issueRecord.repo_full_name,
            ticketKey
          );
          const primaryBranch = matchedLinkedBranch || discoveredBranch || branchState.branch || null;
          
          // 변경 사항이 있으면 DB 업데이트
          if (primaryBranch && primaryBranch.branchName !== cachedBranchName) {
            await supabaseAdminClient
              .from('items')
              .update({
                github_linked_branch_name: primaryBranch.branchName,
                github_linked_branch_url: primaryBranch.branchUrl,
                github_branch_source: matchedLinkedBranch ? 'linked' : discoveredBranch ? 'discovered' : 'linked-fallback',
                github_branch_updated_at: new Date().toISOString(),
              })
              .eq('id', itemId);
          }
        } catch (bgError) {
          console.warn('Background branch refresh failed:', bgError.message);
        }
      });
      return;
    }

    // 캐시 없으면 API 호출 (초기 로드)
    const ticketKey = String(itemRecord.item?.ticket_key || '').trim();
    const connection = await requireGitHubRepoConnection(user.id);
    const branchState = await getGitHubIssueBranchState(
      connection.access_token,
      issueRecord.repo_full_name,
      issueRecord.issue_number
    );
    const matchedLinkedBranch = pickPreferredTicketBranch(branchState.branches, ticketKey);
    const discoveredBranch = await findRepositoryBranchByTicketKey(
      connection.access_token,
      issueRecord.repo_full_name,
      ticketKey
    );
    const primaryBranch = matchedLinkedBranch || discoveredBranch || branchState.branch || null;
    const branchSource = matchedLinkedBranch
      ? 'linked'
      : discoveredBranch
        ? 'discovered'
        : branchState.branch
          ? 'linked-fallback'
          : null;

    // DB에 저장
    if (primaryBranch) {
      await supabaseAdminClient
        .from('items')
        .update({
          github_linked_branch_name: primaryBranch.branchName,
          github_linked_branch_url: primaryBranch.branchUrl,
          github_branch_source: branchSource,
          github_branch_updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);
    }

    res.json({
      hasLinkedIssue: true,
      issue: {
        itemId,
        repoFullName: issueRecord.repo_full_name,
        issueNumber: issueRecord.issue_number,
        issueUrl: issueRecord.issue_url,
      },
      hasLinkedBranch: Boolean(matchedLinkedBranch || branchState.branch),
      linkedBranch: matchedLinkedBranch || branchState.branch || null,
      discoveredBranch,
      branch: primaryBranch,
      branchSource,
      linkedBranchCount: branchState.totalCount,
      fromCache: false,
    });
  } catch (error) {
    console.error('GitHub item branch get error:', error);
    res.status(error.status || 500).json({ error: error.message || 'GitHub linked branch 정보를 불러오지 못했습니다.' });
  }
});

router.post('/items/:itemId/branch', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const itemId = String(req.params.itemId || '').trim();
    if (!itemId) {
      return res.status(400).json({ error: 'itemId가 필요합니다.' });
    }

    const issueRecord = await getExistingGitHubIssueForItem(itemId);
    if (!issueRecord) {
      return res.status(404).json({ error: '이 아이템에 연결된 GitHub 이슈를 찾을 수 없습니다.' });
    }

    const itemRecord = await findItemRecordById(itemId);
    if (!itemRecord) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }

    const branchName = String(itemRecord.item?.ticket_key || '').trim();
    if (!branchName) {
      return res.status(409).json({ error: '티켓 키가 없어 브랜치를 생성할 수 없습니다. 먼저 GitHub 이슈를 생성해주세요.' });
    }

    const connection = await requireGitHubRepoConnection(user.id);
    const repo = await fetchGitHubJson(
      `https://api.github.com/repos/${issueRecord.repo_full_name}`,
      connection.access_token
    );

    if (repo?.archived) {
      throw createHttpError(409, '보관된 레포에는 브랜치를 생성할 수 없습니다.');
    }

    if (!canCreateBranch(repo)) {
      throw createHttpError(403, '선택한 레포에 브랜치를 생성할 권한이 없습니다.');
    }

    const branchState = await getGitHubIssueBranchState(
      connection.access_token,
      issueRecord.repo_full_name,
      issueRecord.issue_number
    );
    const matchedLinkedBranch = pickPreferredTicketBranch(branchState.branches, branchName);
    if (matchedLinkedBranch) {
      return res.json({
        itemId,
        issueNumber: issueRecord.issue_number,
        repoFullName: issueRecord.repo_full_name,
        issueUrl: issueRecord.issue_url,
        linkedBranchId: matchedLinkedBranch.linkedBranchId,
        branchName: matchedLinkedBranch.branchName,
        branchUrl: matchedLinkedBranch.branchUrl,
        hasLinkedIssue: true,
        hasLinkedBranch: true,
        created: false,
        linkedBranchCount: branchState.totalCount,
        linkedBranch: matchedLinkedBranch,
        discoveredBranch: null,
        branch: matchedLinkedBranch,
        branchSource: 'linked',
      });
    }

    const discoveredBranch = await findRepositoryBranchByTicketKey(
      connection.access_token,
      issueRecord.repo_full_name,
      branchName,
      repo.html_url
    );
    if (discoveredBranch) {
      return res.json({
        itemId,
        issueNumber: issueRecord.issue_number,
        repoFullName: issueRecord.repo_full_name,
        issueUrl: issueRecord.issue_url,
        linkedBranchId: null,
        branchName: discoveredBranch.branchName,
        branchUrl: discoveredBranch.branchUrl,
        hasLinkedIssue: true,
        hasLinkedBranch: false,
        created: false,
        linkedBranchCount: branchState.totalCount,
        linkedBranch: null,
        discoveredBranch,
        branch: discoveredBranch,
        branchSource: 'discovered',
      });
    }

    const result = await createGitHubIssueLinkedBranch({
      token: connection.access_token,
      repoFullName: issueRecord.repo_full_name,
      issueNumber: issueRecord.issue_number,
      branchName,
    });

    // DB에 branch 정보 저장
    if (result.branch) {
      await supabaseAdminClient
        .from('items')
        .update({
          github_linked_branch_name: result.branch.branchName,
          github_linked_branch_url: result.branch.branchUrl,
          github_branch_source: 'linked',
          github_branch_updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);
    }

    res.json({
      itemId,
      issueNumber: issueRecord.issue_number,
      repoFullName: issueRecord.repo_full_name,
      issueUrl: issueRecord.issue_url,
      linkedBranchId: result.branch?.linkedBranchId || null,
      branchName: result.branch?.branchName || branchName,
      branchUrl: result.branch?.branchUrl || `${repo.html_url}/tree/${encodeURIComponent(branchName)}`,
      hasLinkedIssue: true,
      hasLinkedBranch: Boolean(result.branch),
      created: result.created,
      linkedBranchCount: result.totalCount,
      linkedBranch: result.branch,
      discoveredBranch: null,
      branch: result.branch,
      branchSource: 'linked',
    });
  } catch (error) {
    console.error('GitHub item branch create error:', error);
    res.status(error.status || 500).json({ error: error.message || 'GitHub linked branch 생성에 실패했습니다.' });
  }
});

router.get('/items/:itemId/pull-requests', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const itemId = String(req.params.itemId || '').trim();
    if (!itemId) {
      return res.status(400).json({ error: 'itemId가 필요합니다.' });
    }

    await requireGitHubRepoConnection(user.id);
    const pullRequests = await getExistingGitHubPullRequestsForItem(itemId);
    res.json({ pullRequests });
  } catch (error) {
    console.error('GitHub item pull requests get error:', error);
    res.status(error.status || 500).json({ error: error.message || 'GitHub PR 정보를 불러오지 못했습니다.' });
  }
});

router.post('/items/:itemId/pull-request/prepare', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const itemId = String(req.params.itemId || '').trim();
    if (!itemId) {
      return res.status(400).json({ error: 'itemId가 필요합니다.' });
    }

    const issueRecord = await getExistingGitHubIssueForItem(itemId);
    if (!issueRecord) {
      return res.status(404).json({ error: '이 아이템에 연결된 GitHub 이슈를 찾을 수 없습니다.' });
    }

    const itemRecord = await findItemRecordById(itemId);
    if (!itemRecord) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }

    const ticket = await ensureItemTicket(itemRecord);
    const connection = await requireGitHubRepoConnection(user.id);
    const repo = await fetchGitHubJson(
      `https://api.github.com/repos/${issueRecord.repo_full_name}`,
      connection.access_token
    );

    if (repo?.archived) {
      throw createHttpError(409, '보관된 레포에는 PR을 생성할 수 없습니다.');
    }

    if (!canWriteRepo(repo)) {
      throw createHttpError(403, '선택한 레포에 PR을 생성할 권한이 없습니다.');
    }

    const branchState = await getGitHubIssueBranchState(
      connection.access_token,
      issueRecord.repo_full_name,
      issueRecord.issue_number
    );
    const ticketKey = String(ticket?.ticket_key || itemRecord.item?.ticket_key || '').trim();
    const matchedLinkedBranch = pickPreferredTicketBranch(branchState.branches, ticketKey);
    const discoveredBranch = await findRepositoryBranchByTicketKey(
      connection.access_token,
      issueRecord.repo_full_name,
      ticketKey,
      repo.html_url
    );
    const branch = matchedLinkedBranch || discoveredBranch || branchState.branch || null;

    if (!branch?.branchName) {
      throw createHttpError(409, '연결된 브랜치가 없어 PR 초안을 만들 수 없습니다. 먼저 브랜치를 생성해주세요.');
    }

    let existingPullRequest = (await getExistingGitHubPullRequestsForItem(itemId))
      .find((pullRequest) => String(pullRequest.head_ref || '').trim() === branch.branchName)
      || null;

    const openPullRequest = await findOpenPullRequestByHead(
      connection.access_token,
      issueRecord.repo_full_name,
      branch.branchName
    );

    if (openPullRequest) {
      existingPullRequest = await upsertGitHubPullRequestLink({
        itemId,
        repoFullName: issueRecord.repo_full_name,
        pullRequestPayload: openPullRequest,
        userId: user.id,
      });
    }

    const defaultTitle = `[${ticket.ticket_key}] ${itemRecord.item.title || itemRecord.item.content || '제목 없음'}`;
    const defaultBody = buildPullRequestBody({
      item: itemRecord.item,
      issue: { number: issueRecord.issue_number },
      ticket,
    });

    res.json({
      itemId,
      repoFullName: issueRecord.repo_full_name,
      issue: {
        issueNumber: issueRecord.issue_number,
        issueUrl: issueRecord.issue_url,
      },
      ticket,
      branch,
      baseBranch: repo.default_branch || 'main',
      defaultTitle,
      defaultBody,
      draft: true,
      existingPullRequest,
    });
  } catch (error) {
    console.error('GitHub item pull request prepare error:', error);
    res.status(error.status || 500).json({ error: error.message || 'GitHub PR 초안을 준비하지 못했습니다.' });
  }
});

router.post('/items/:itemId/pull-request', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const itemId = String(req.params.itemId || '').trim();
    if (!itemId) {
      return res.status(400).json({ error: 'itemId가 필요합니다.' });
    }

    const issueRecord = await getExistingGitHubIssueForItem(itemId);
    if (!issueRecord) {
      return res.status(404).json({ error: '이 아이템에 연결된 GitHub 이슈를 찾을 수 없습니다.' });
    }

    const itemRecord = await findItemRecordById(itemId);
    if (!itemRecord) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }

    const ticket = await ensureItemTicket(itemRecord);
    const connection = await requireGitHubRepoConnection(user.id);
    const repo = await fetchGitHubJson(
      `https://api.github.com/repos/${issueRecord.repo_full_name}`,
      connection.access_token
    );

    if (repo?.archived) {
      throw createHttpError(409, '보관된 레포에는 PR을 생성할 수 없습니다.');
    }

    if (!canWriteRepo(repo)) {
      throw createHttpError(403, '선택한 레포에 PR을 생성할 권한이 없습니다.');
    }

    const branchInfo = await getGitHubIssueBranchState(
      connection.access_token,
      issueRecord.repo_full_name,
      issueRecord.issue_number
    );
    const ticketKey = String(ticket?.ticket_key || itemRecord.item?.ticket_key || '').trim();
    const matchedLinkedBranch = pickPreferredTicketBranch(branchInfo.branches, ticketKey);
    const discoveredBranch = await findRepositoryBranchByTicketKey(
      connection.access_token,
      issueRecord.repo_full_name,
      ticketKey,
      repo.html_url
    );
    const branch = matchedLinkedBranch || discoveredBranch || branchInfo.branch || null;

    if (!branch?.branchName) {
      throw createHttpError(409, '연결된 브랜치가 없어 PR을 생성할 수 없습니다. 먼저 브랜치를 생성해주세요.');
    }

    const existingOpenPullRequest = await findOpenPullRequestByHead(
      connection.access_token,
      issueRecord.repo_full_name,
      branch.branchName
    );

    if (existingOpenPullRequest) {
      const linkedPullRequest = await upsertGitHubPullRequestLink({
        itemId,
        repoFullName: issueRecord.repo_full_name,
        pullRequestPayload: existingOpenPullRequest,
        userId: user.id,
      });

      return res.status(409).json({
        error: '같은 브랜치로 이미 열린 PR이 있습니다.',
        pullRequest: linkedPullRequest,
      });
    }

    const requestedTitle = String(req.body?.title || '').trim();
    const requestedBody = String(req.body?.body || '').trim();
    const baseBranch = String(req.body?.base || repo.default_branch || 'main').trim();
    const draft = Boolean(req.body?.draft);

    if (!requestedTitle) {
      return res.status(400).json({ error: 'PR 제목이 필요합니다.' });
    }

    if (!baseBranch) {
      return res.status(400).json({ error: 'base branch가 필요합니다.' });
    }

    const body = ensurePullRequestClosingLine(
      requestedBody || buildPullRequestBody({
        item: itemRecord.item,
        issue: { number: issueRecord.issue_number },
        ticket,
      }),
      issueRecord.issue_number
    );

    const createdPullRequest = await fetchGitHubJson(
      `https://api.github.com/repos/${issueRecord.repo_full_name}/pulls`,
      connection.access_token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: requestedTitle,
          body,
          head: branch.branchName,
          base: baseBranch,
          draft,
        }),
      }
    );

    const linkedPullRequest = await upsertGitHubPullRequestLink({
      itemId,
      repoFullName: issueRecord.repo_full_name,
      pullRequestPayload: createdPullRequest,
      userId: user.id,
    });

    res.json({
      itemId,
      repoFullName: issueRecord.repo_full_name,
      issue: {
        issueNumber: issueRecord.issue_number,
        issueUrl: issueRecord.issue_url,
      },
      branch,
      pullRequest: linkedPullRequest,
      body,
      created: true,
    });
  } catch (error) {
    console.error('GitHub item pull request create error:', error);
    res.status(error.status || 500).json({ error: error.message || 'GitHub PR 생성에 실패했습니다.' });
  }
});

router.post('/issues/sync-status', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const { itemId, status } = req.body || {};
    if (!itemId || !status) {
      return res.status(400).json({ error: 'itemId와 status가 필요합니다.' });
    }

    const issue = await getExistingGitHubIssueForItem(itemId);
    if (!issue) {
      return res.json({ synced: false, reason: 'no-linked-issue' });
    }

    const connection = await getStoredGitHubConnection(user.id);
    if (!connection?.access_token) {
      return res.status(400).json({ error: 'GitHub 계정이 연결되어 있지 않습니다.' });
    }

    const targetState = mapRoadmapStatusToGitHubState(status);
    if (issue.issue_state_snapshot === targetState) {
      return res.json({ synced: true, state: targetState, skipped: true });
    }

    const syncedIssue = await fetchGitHubJson(
      `https://api.github.com/repos/${issue.repo_full_name}/issues/${issue.issue_number}`,
      connection.access_token,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: targetState }),
      }
    );

    const { error } = await supabaseAdminClient
      .from('item_github_issues')
      .update({
        issue_state_snapshot: syncedIssue.state,
        issue_title_snapshot: syncedIssue.title,
      })
      .eq('id', issue.id);

    if (error) throw error;

    res.json({
      synced: true,
      state: syncedIssue.state,
      issue: {
        id: issue.id,
        repo_full_name: issue.repo_full_name,
        issue_number: issue.issue_number,
        issue_url: issue.issue_url,
      },
    });
  } catch (error) {
    console.error('GitHub issue status sync error:', error);
    res.status(error.status || 500).json({ error: error.message || 'GitHub 이슈 상태 동기화에 실패했습니다.' });
  }
});

router.post('/webhooks', async (req, res) => {
  try {
    if (!supabaseAdminClient) {
      return res.status(500).json({ error: 'Supabase server configuration is missing.' });
    }

    verifyGitHubWebhookSignature(req);

    const event = req.headers['x-github-event'];
    if (event === 'pull_request_review') {
      const action = req.body?.action;
      if (action !== 'submitted') {
        return res.status(200).json({ handled: false, reason: 'unsupported-action' });
      }

      const repository = req.body?.repository;
      const pullRequest = req.body?.pull_request;
      const review = req.body?.review;
      const repoFullName = repository?.full_name;
      const pullNumber = pullRequest?.number;
      if (!repoFullName || !pullNumber || !review) {
        return res.status(400).json({ error: 'Webhook payload is missing pull request review information.' });
      }

      const pullRequestRecord = await getGitHubPullRequestRecord(repoFullName, pullNumber);
      if (!pullRequestRecord) {
        return res.status(200).json({ handled: false, reason: 'untracked-pull-request' });
      }

      const itemRecord = await findItemRecordById(pullRequestRecord.item_id);
      if (!itemRecord) {
        return res.status(404).json({ error: 'Linked roadmap item was not found.' });
      }

      const commentResult = await insertGitHubReviewSystemComment({
        pullRequestRecord,
        itemRecord,
        repository,
        pullRequest,
        review,
      });

      let insertedNotifications = 0;
      if (commentResult.inserted) {
        insertedNotifications = await insertGitHubReviewNotifications({
          itemRecord,
          pullRequestRecord,
          review,
          repository,
          sourceEventId: commentResult.sourceEventId,
          reviewerDisplayName: commentResult.reviewerDisplayName,
          reviewStateLabel: commentResult.reviewStateLabel,
        });
      }

      return res.status(200).json({
        handled: true,
        itemId: pullRequestRecord.item_id,
        pullNumber,
        reviewId: review?.id || null,
        insertedComment: commentResult.inserted,
        insertedNotifications,
      });
    }

    if (event !== 'issues') {
      return res.status(200).json({ handled: false, reason: 'unsupported-event' });
    }

    const action = req.body?.action;
    if (action !== 'closed' && action !== 'reopened') {
      return res.status(200).json({ handled: false, reason: 'unsupported-action' });
    }

    const issuePayload = req.body?.issue;
    const repository = req.body?.repository;
    const repoFullName = repository?.full_name;
    const issueNumber = issuePayload?.number;
    if (!repoFullName || !issueNumber) {
      return res.status(400).json({ error: 'Webhook payload is missing repository or issue information.' });
    }

    const issueRecord = await getGitHubIssueRecord(repoFullName, issueNumber);
    if (!issueRecord) {
      return res.status(200).json({ handled: false, reason: 'untracked-issue' });
    }

    const itemRecord = await findItemRecordById(issueRecord.item_id);
    if (!itemRecord) {
      return res.status(404).json({ error: 'Linked roadmap item was not found.' });
    }

    const targetStatus = mapGitHubStateToRoadmapStatus(issuePayload.state);
    const currentStatus = itemRecord.item.status || 'none';

    if (currentStatus !== targetStatus) {
      const { error: updateError } = await supabaseAdminClient
        .from(itemRecord.table)
        .update({ status: targetStatus })
        .eq('id', itemRecord.item.id);

      if (updateError) throw updateError;
    }

    const { error: issueUpdateError } = await supabaseAdminClient
      .from('item_github_issues')
      .update({
        issue_state_snapshot: issuePayload.state,
        issue_title_snapshot: issuePayload.title,
      })
      .eq('id', issueRecord.id);

    if (issueUpdateError) throw issueUpdateError;

    res.status(200).json({
      handled: true,
      itemId: issueRecord.item_id,
      status: targetStatus,
    });
  } catch (error) {
    console.error('GitHub webhook error:', error);
    res.status(error.status || 500).json({ error: error.message || 'GitHub webhook 처리에 실패했습니다.' });
  }
});

export const githubRouter = router;
