import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalIndex = line.indexOf('=');
    if (equalIndex === -1) continue;

    const key = line.slice(0, equalIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = line.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith('\'') && value.endsWith('\''))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT_DIR, '.env'));
loadEnvFile(path.join(ROOT_DIR, '.env.local'));

const app = express();
const PORT = 3001;
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || `http://localhost:${PORT}/api/github/connect/callback`;
const GITHUB_STATE_SECRET =
  process.env.GITHUB_STATE_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'roadmap-dev-github-state-secret';
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';
const TICKET_KEY_PREFIX = process.env.TICKET_KEY_PREFIX || 'QZR';

const supabaseAuthClient = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const supabaseAdminClient = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// CORS 설정 (React 앱에서 접근 가능하도록)
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:1234', 'https://roadmap.ai-quazar.uk'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json({
  verify: (req, _res, buffer) => {
    req.rawBody = buffer;
  },
}));

function requireServerConfig(res) {
  if (!supabaseAuthClient || !supabaseAdminClient) {
    res.status(500).json({ error: 'Supabase server configuration is missing.' });
    return false;
  }

  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    res.status(500).json({ error: 'GitHub OAuth server configuration is missing.' });
    return false;
  }

  return true;
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

async function getAuthenticatedUser(req) {
  if (!supabaseAuthClient) {
    throw new Error('Supabase auth client is not configured');
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return null;
  }

  const { data, error } = await supabaseAuthClient.auth.getUser(token);
  if (error) {
    return null;
  }

  return data.user ?? null;
}

async function requireAuthenticatedUser(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }
  return user;
}

async function fetchGitHubJson(url, token, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'roadmap-github-integration',
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data?.message || `GitHub API request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

async function getStoredGitHubConnection(userId) {
  const { data, error } = await supabaseAdminClient
    .from('user_github_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getExistingGitHubIssueForItem(itemId) {
  const { data, error } = await supabaseAdminClient
    .from('item_github_issues')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0] || null;
}

async function getGitHubIssueRecord(repoFullName, issueNumber) {
  const { data, error } = await supabaseAdminClient
    .from('item_github_issues')
    .select('*')
    .eq('repo_full_name', repoFullName)
    .eq('issue_number', issueNumber)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function mapRoadmapStatusToGitHubState(status) {
  return status === 'done' ? 'closed' : 'open';
}

function mapGitHubStateToRoadmapStatus(state) {
  return state === 'closed' ? 'done' : 'in-progress';
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
  const tables = ['items', 'roadmap_items'];

  for (const table of tables) {
    const { data, error } = await supabaseAdminClient
      .from(table)
      .select('id, title, content, description, assignees, tags, status, is_ticket, ticket_key, ticket_number, ticket_created_at')
      .eq('id', itemId)
      .maybeSingle();

    if (error) {
      if (isMissingTicketSchemaError(error)) {
        throw createHttpError(500, '티켓 컬럼이 아직 DB에 적용되지 않았습니다. items와 roadmap_items에 ticket 컬럼을 먼저 추가해주세요.');
      }
      throw error;
    }

    if (data) {
      return { table, item: data };
    }
  }

  return null;
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

async function ensureItemTicket(itemRecord) {
  const { table, item } = itemRecord;

  if (item.ticket_key && item.ticket_number) {
    return {
      is_ticket: true,
      ticket_key: item.ticket_key,
      ticket_number: item.ticket_number,
      ticket_created_at: item.ticket_created_at,
    };
  }

  const ticketNumber = await allocateTicketNumber();
  const ticketKey = `${TICKET_KEY_PREFIX}-${ticketNumber}`;
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

  if (latestError) {
    throw latestError;
  }

  if (!latest?.ticket_key || !latest?.ticket_number) {
    throw createHttpError(500, '티켓 발급에 실패했습니다.');
  }

  return latest;
}

async function ensureItemStatusForIssue(itemRecord) {
  const { table, item } = itemRecord;
  const currentStatus = item.status || 'none';

  if (currentStatus !== 'none') {
    return currentStatus;
  }

  const { data, error } = await supabaseAdminClient
    .from(table)
    .update({ status: 'in-progress' })
    .eq('id', item.id)
    .or('status.is.null,status.eq.none')
    .select('status')
    .maybeSingle();

  if (error) {
    throw error;
  }

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

function parseGitHubScopes(scopeValue) {
  return String(scopeValue || '')
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function hasGitHubScope(connection, expectedScope) {
  return parseGitHubScopes(connection?.scope).includes(expectedScope);
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

app.get('/api/github/connect/start', async (req, res) => {
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

app.get('/api/github/connect/callback', async (req, res) => {
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

    if (error) {
      throw error;
    }

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

app.get('/api/github/status', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const connection = await getStoredGitHubConnection(user.id);
    if (!connection) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      githubLogin: connection.github_login,
      githubUserId: connection.github_user_id,
      scope: connection.scope,
    });
  } catch (error) {
    console.error('GitHub status error:', error);
    res.status(500).json({ error: 'GitHub 연결 상태를 불러오지 못했습니다.' });
  }
});

app.get('/api/github/repos', async (req, res) => {
  try {
    if (!requireServerConfig(res)) return;

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const connection = await getStoredGitHubConnection(user.id);
    if (!connection?.access_token) {
      return res.status(400).json({ error: 'GitHub 계정이 연결되어 있지 않습니다.' });
    }

    if (!hasGitHubScope(connection, 'repo') && !hasGitHubScope(connection, 'public_repo')) {
      return res.status(403).json({
        error: '현재 GitHub 연결에 레포 접근 권한이 없습니다. 프로필에서 GitHub를 재연결해주세요.',
      });
    }

    const repos = await fetchGitHubJson('https://api.github.com/user/repos?per_page=100&sort=updated', connection.access_token);
    const filteredRepos = (Array.isArray(repos) ? repos : [])
      .filter((repo) => repo?.permissions?.push || repo?.permissions?.triage || repo?.permissions?.maintain || repo?.permissions?.admin)
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

app.post('/api/github/issues', async (req, res) => {
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

    const itemRecord = await findItemRecordById(itemId);
    if (!itemRecord) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }

    const { item } = itemRecord;
    const ticket = await ensureItemTicket(itemRecord);

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

    const itemStatus = await ensureItemStatusForIssue(itemRecord);
    const titleBase = item.title || item.content || '제목 없음';
    const title = `[${ticket.ticket_key}] ${titleBase}`;
    const body = buildIssueBody(item, ticket);
    const issue = await fetchGitHubJson(`https://api.github.com/repos/${repoFullName}/issues`, connection.access_token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    });

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

    if (error) {
      throw error;
    }

    res.json({
      issue: {
        ...data,
        ticket_key: ticket.ticket_key,
        ticket_number: ticket.ticket_number,
      },
      ticket,
      itemStatus,
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

app.post('/api/github/issues/sync-status', async (req, res) => {
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

    if (error) {
      throw error;
    }

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

app.post('/api/github/webhooks', async (req, res) => {
  try {
    if (!supabaseAdminClient) {
      return res.status(500).json({ error: 'Supabase server configuration is missing.' });
    }

    verifyGitHubWebhookSignature(req);

    const event = req.headers['x-github-event'];
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

      if (updateError) {
        throw updateError;
      }
    }

    const { error: issueUpdateError } = await supabaseAdminClient
      .from('item_github_issues')
      .update({
        issue_state_snapshot: issuePayload.state,
        issue_title_snapshot: issuePayload.title,
      })
      .eq('id', issueRecord.id);

    if (issueUpdateError) {
      throw issueUpdateError;
    }

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

// 업로드 디렉토리 설정
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');

// 업로드 디렉토리가 없으면 생성
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 정적 파일 서빙 (업로드된 파일 접근)
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// 파일 타입 검증
const ALLOWED_FILE_TYPES = {
  // 이미지
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  // PDF
  'application/pdf': ['.pdf'],
  // MS Office 문서
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.ms-powerpoint': ['.ppt']
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Multer 설정 (메모리 저장소 사용 - 파일 검증 후 직접 저장)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

// 파일명 sanitize (안전한 파일명으로 변환)
function sanitizeFilename(filename) {
  // 파일명에서 위험한 문자 제거, 한글과 영문, 숫자, 하이픈, 언더스코어만 허용
  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);
  
  // 특수문자 제거 및 공백을 언더스코어로 변환
  const sanitized = basename
    .replace(/[^\w\sㄱ-힣.-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100); // 파일명 길이 제한
  
  return sanitized + ext;
}

// 파일 타입 검증 함수
function isAllowedFileType(mimetype, filename) {
  const ext = path.extname(filename).toLowerCase();
  const allowedExtensions = ALLOWED_FILE_TYPES[mimetype];
  
  if (!allowedExtensions) {
    return false;
  }
  
  return allowedExtensions.includes(ext);
}

// 파일 업로드 API
app.post('/upload/:itemId', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 제공되지 않았습니다.' });
    }

    const { itemId } = req.params;
    const file = req.file;

    // multer는 multipart 파일명을 latin1로 디코딩 → UTF-8 한글 깨짐 방지
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    // 파일 타입 검증
    if (!isAllowedFileType(file.mimetype, originalName)) {
      return res.status(400).json({
        error: '지원하지 않는 파일 형식입니다. (이미지, PDF, DOCX만 허용)'
      });
    }

    // 파일 크기 검증 (multer limits에서도 체크하지만 명시적으로 한번 더)
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: `파일 크기가 너무 큽니다. (최대 ${MAX_FILE_SIZE / 1024 / 1024}MB)`
      });
    }

    // 아이템별 디렉토리 생성
    const itemDir = path.join(UPLOAD_DIR, itemId);
    if (!fs.existsSync(itemDir)) {
      fs.mkdirSync(itemDir, { recursive: true });
    }

    // 파일명 생성 (타임스탬프 + sanitized 원본 파일명)
    const timestamp = Date.now();
    const sanitizedName = sanitizeFilename(originalName);
    const filename = `${timestamp}_${sanitizedName}`;
    const filepath = path.join(itemDir, filename);

    // 파일 저장
    fs.writeFileSync(filepath, file.buffer);

    // 파일 URL 반환
    const fileUrl = `/uploads/${itemId}/${filename}`;

    res.json({
      success: true,
      url: fileUrl,
      filename: filename,
      originalName: originalName,
      mimetype: file.mimetype,
      size: file.size
    });

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: '파일 업로드 중 오류가 발생했습니다.' });
  }
});

// 파일 삭제 API
app.delete('/uploads/:itemId/:filename', async (req, res) => {
  try {
    const { itemId, filename } = req.params;

    // 파일 경로 생성
    const filepath = path.join(UPLOAD_DIR, itemId, filename);

    // 파일 존재 확인
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }

    // 파일 삭제
    fs.unlinkSync(filepath);

    // 디렉토리가 비어있으면 삭제
    const itemDir = path.join(UPLOAD_DIR, itemId);
    const files = fs.readdirSync(itemDir);
    if (files.length === 0) {
      fs.rmdirSync(itemDir);
    }

    res.json({ success: true, message: '파일이 삭제되었습니다.' });

  } catch (error) {
    console.error('File delete error:', error);
    res.status(500).json({ error: '파일 삭제 중 오류가 발생했습니다.' });
  }
});

// 아이템 전체 파일 삭제 API (아이템 삭제 시 사용)
app.delete('/uploads/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const itemDir = path.join(UPLOAD_DIR, itemId);

    if (!fs.existsSync(itemDir)) {
      return res.status(404).json({ error: '폴더를 찾을 수 없습니다.' });
    }

    // 디렉토리 및 모든 파일 삭제
    fs.rmSync(itemDir, { recursive: true, force: true });

    res.json({ success: true, message: '모든 파일이 삭제되었습니다.' });

  } catch (error) {
    console.error('Directory delete error:', error);
    res.status(500).json({ error: '폴더 삭제 중 오류가 발생했습니다.' });
  }
});

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'File server is running' });
});

// ─── AI 요약 ────────────────────────────────────────────────────────────────

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL || 'qwen2.5:14b';

/**
 * HTML에서 텍스트 블록을 순서대로 추출
 * h1~h4, p, li 태그를 하나의 블록으로 취급
 */
function extractTextBlocks(html) {
  if (!html) return [];
  const blockRegex = /<(h[1-4]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  const blocks = [];
  let match;
  while ((match = blockRegex.exec(html)) !== null) {
    // 내부 HTML 태그 제거 후 공백 정리
    const text = match[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (text.length > 10) blocks.push(text);
  }
  return blocks;
}

app.post('/api/summarize', async (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: '요약할 내용이 없습니다.' });
  }

  const blocks = extractTextBlocks(content);

  if (blocks.length === 0) {
    return res.status(400).json({ error: '요약할 텍스트가 충분하지 않습니다.' });
  }

  // 각 블록에 번호 부여 → Ollama에 전달
  const numberedContent = blocks
    .map((text, i) => `[${i + 1}] ${text}`)
    .join('\n\n');

  const prompt = `다음은 업무 문서의 내용입니다. 각 섹션에는 [번호]가 붙어 있습니다.

이 문서를 3~5개의 핵심 포인트로 요약하세요.
각 요약 포인트 끝에 해당 내용의 출처 번호를 [1], [2] 형태로 반드시 붙이세요.
한국어로 간결하게 작성하세요.

문서 내용:
${numberedContent}

아래 JSON 형식으로만 응답하세요. JSON 외 텍스트는 쓰지 마세요:
{
  "summary": [
    "핵심 포인트 1 [1]",
    "핵심 포인트 2 [2][3]"
  ]
}`;

  try {
    // Ollama 서버 상태 먼저 확인 (3초 타임아웃)
    const healthCheck = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);

    if (!healthCheck?.ok) {
      return res.status(503).json({
        error: 'Ollama 서버에 연결할 수 없습니다. 로컬 LLM이 실행 중인지 확인해주세요.',
        code: 'OLLAMA_UNAVAILABLE',
      });
    }

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: '당신은 업무 문서 요약 전문가입니다. JSON 형식으로만 응답합니다.' },
          { role: 'user', content: prompt },
        ],
        stream: false,
        options: { temperature: 0.3, num_predict: 1024 },
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`Ollama 응답 오류: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.message?.content || '';

    // JSON 파싱
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON 형식 응답 없음');

    const parsed = JSON.parse(jsonMatch[0]);

    res.json({
      summary: parsed.summary || [],
      blocks,                            // 인용 tooltip 용도
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Summarize error:', error);
    if (error.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Ollama 응답 시간이 초과되었습니다 (60초).' });
    }
    res.status(500).json({ error: `요약 생성 실패: ${error.message}` });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`\n📁 File server is running on http://localhost:${PORT}`);
  console.log(`📂 Upload directory: ${UPLOAD_DIR}`);
  console.log(`✅ Ready to accept file uploads\n`);
});
