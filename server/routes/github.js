import { Router } from 'express';
import crypto from 'crypto';
import { TAG_CATALOG_BY_NAME } from '../../src/lib/tagCatalog.js';
import { supabaseAdminClient } from '../lib/supabase.js';
import {
  isGitHubAppConfigured,
  requireAuthenticatedUser,
  requireServerConfig,
} from '../lib/auth.js';
import {
  GITHUB_APP_ID,
  GITHUB_APP_INSTALL_REDIRECT_URI,
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

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
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

  if (error) throw error;
  return data;
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

    if (data) return { table, item: data };
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

  return installations.filter((installation) => {
    if (!installation || typeof installation !== 'object') return false;

    const slugMatches = GITHUB_APP_SLUG
      ? installation?.app_slug === GITHUB_APP_SLUG
      : true;
    const idMatches = GITHUB_APP_ID
      ? String(installation?.app_id || '') === String(GITHUB_APP_ID)
      : true;

    return slugMatches && idMatches;
  });
}

async function getGitHubAppInstallations(token) {
  if (!isGitHubAppConfigured()) return [];

  try {
    const payload = await fetchGitHubJson(
      'https://api.github.com/user/installations?per_page=100',
      token
    );
    return normalizeGitHubAppInstallations(payload);
  } catch (error) {
    if (error.status === 403 || error.status === 404) return [];
    throw error;
  }
}

async function getGitHubAppInstalledRepoSet(token, installations) {
  const repoSet = new Set();
  if (!Array.isArray(installations) || installations.length === 0) return repoSet;

  for (const installation of installations) {
    const installationId = installation?.id;
    if (!installationId) continue;

    const payload = await fetchGitHubJson(
      `https://api.github.com/user/installations/${installationId}/repositories?per_page=100`,
      token
    );
    const repositories = Array.isArray(payload?.repositories) ? payload.repositories : [];
    for (const repo of repositories) {
      if (repo?.full_name) repoSet.add(repo.full_name);
    }
  }

  return repoSet;
}

function normalizeGitHubLabels(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(
    tags.map((tag) => String(tag || '').trim()).filter(Boolean)
  )];
}

async function ensureGitHubLabel(repoFullName, labelName, token) {
  const preset = TAG_CATALOG_BY_NAME.get(labelName);

  try {
    await fetchGitHubJson(`https://api.github.com/repos/${repoFullName}/labels`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: labelName,
        color: preset?.color || '64748b',
        description: preset?.description || null,
      }),
    });
  } catch (error) {
    if (error.status === 422) return;
    throw error;
  }
}

async function syncGitHubIssueLabels(repoFullName, issueNumber, labels, token) {
  const normalizedLabels = normalizeGitHubLabels(labels);
  if (normalizedLabels.length === 0) return [];

  for (const labelName of normalizedLabels) {
    await ensureGitHubLabel(repoFullName, labelName, token);
  }

  const syncedLabels = await fetchGitHubJson(
    `https://api.github.com/repos/${repoFullName}/issues/${issueNumber}/labels`,
    token,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labels: normalizedLabels }),
    }
  );

  return Array.isArray(syncedLabels) ? syncedLabels : [];
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

    const connection = await getStoredGitHubConnection(user.id);
    const appConfigured = isGitHubAppConfigured();

    if (!connection) {
      return res.json({
        connected: false,
        app: {
          configured: appConfigured,
          slug: GITHUB_APP_SLUG || null,
          installRedirectUri: appConfigured ? GITHUB_APP_INSTALL_REDIRECT_URI : null,
          installed: false,
          installationCount: 0,
        },
      });
    }

    let appInstallations = [];
    if (appConfigured && connection.access_token) {
      appInstallations = await getGitHubAppInstallations(connection.access_token);
    }

    res.json({
      connected: true,
      githubLogin: connection.github_login,
      githubUserId: connection.github_user_id,
      scope: connection.scope,
      app: {
        configured: appConfigured,
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
    let filteredRepos = (Array.isArray(repos) ? repos : [])
      .filter((repo) => repo?.permissions?.push || repo?.permissions?.triage || repo?.permissions?.maintain || repo?.permissions?.admin)
      .map((repo) => ({
        id: repo.id,
        full_name: repo.full_name,
        owner: repo.owner?.login,
        name: repo.name,
        private: repo.private,
        permissions: repo.permissions || {},
      }));

    if (isGitHubAppConfigured()) {
      const appInstallations = await getGitHubAppInstallations(connection.access_token);
      const appInstalledRepoSet = await getGitHubAppInstalledRepoSet(connection.access_token, appInstallations);

      filteredRepos = filteredRepos.filter((repo) => appInstalledRepoSet.has(repo.full_name));
    }

    res.json({ repos: filteredRepos });
  } catch (error) {
    console.error('GitHub repos error:', error);
    res.status(error.status || 500).json({ error: error.message || '레포 목록을 불러오지 못했습니다.' });
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
      const appInstallations = await getGitHubAppInstallations(connection.access_token);
      if (appInstallations.length === 0) {
        return res.status(403).json({
          error: 'GitHub App 설치가 필요합니다. 프로필에서 GitHub App을 설치한 뒤 다시 시도해주세요.',
        });
      }

      const appInstalledRepoSet = await getGitHubAppInstalledRepoSet(connection.access_token, appInstallations);
      if (!appInstalledRepoSet.has(repoFullName)) {
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

    const labelNames = normalizeGitHubLabels(item.tags);
    let appliedLabels = [];

    if (labelNames.length > 0) {
      try {
        appliedLabels = await syncGitHubIssueLabels(
          repoFullName,
          issue.number,
          labelNames,
          connection.access_token
        );
      } catch (labelError) {
        console.warn('GitHub issue label sync warning:', {
          repoFullName,
          issueNumber: issue.number,
          message: labelError.message,
        });
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

    res.json({
      issue: {
        ...data,
        ticket_key: ticket.ticket_key,
        ticket_number: ticket.ticket_number,
        labels: appliedLabels,
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
