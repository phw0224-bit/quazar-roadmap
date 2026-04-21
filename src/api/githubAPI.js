import { supabase } from '../lib/supabase';

const SERVER_URL = '';

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('User not authenticated');
  }
  return token;
}

async function serverRequest(path, init = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    const preview = text
      ? text.replace(/\s+/g, ' ').slice(0, 140)
      : 'empty response';
    throw new Error(
      response.ok
        ? `GitHub API 응답을 해석하지 못했습니다. 서버 응답이 JSON이 아닙니다: ${preview}`
        : `GitHub API 요청이 실패했습니다. 서버 응답이 JSON이 아닙니다: ${preview}`
    );
  }

  if (!response.ok) {
    throw new Error(data?.error || 'GitHub 요청 처리에 실패했습니다.');
  }

  return data;
}

export async function getGitHubStatus() {
  return serverRequest('/api/github/status', { method: 'GET' });
}

export async function startGitHubConnect() {
  const data = await serverRequest('/api/github/connect/start', { method: 'GET' });
  if (!data?.url) {
    throw new Error('GitHub 연결 URL을 받지 못했습니다.');
  }
  window.location.href = data.url;
}

export async function startGitHubAppInstall() {
  const data = await serverRequest('/api/github/app/install/start', { method: 'GET' });
  if (!data?.url) {
    throw new Error('GitHub App 설치 URL을 받지 못했습니다.');
  }
  window.location.href = data.url;
}

export async function getGitHubRepos() {
  const data = await serverRequest('/api/github/repos', { method: 'GET' });
  return data?.repos || [];
}

export async function getGitHubRepositoryDashboardList() {
  const data = await serverRequest('/api/github/dashboard/repositories', { method: 'GET' });
  return data?.repositories || [];
}

export async function getGitHubRepositoryDashboardOverview(repoFullName) {
  const search = new URLSearchParams({ repoFullName });
  return serverRequest(`/api/github/dashboard/repository/overview?${search.toString()}`, { method: 'GET' });
}

export async function getGitHubRepositorySettings(repoFullName) {
  const search = new URLSearchParams({ repoFullName });
  const data = await serverRequest(`/api/github/dashboard/repository/settings?${search.toString()}`, { method: 'GET' });
  return data?.settings || null;
}

export async function saveGitHubRepositorySettings(repoFullName, ticketPrefix) {
  const data = await serverRequest('/api/github/dashboard/repository/settings', {
    method: 'PUT',
    body: JSON.stringify({ repoFullName, ticketPrefix }),
  });
  return data?.settings || null;
}

export async function getGitHubRepositoryDashboardEntities(repoFullName, type) {
  const search = new URLSearchParams({ repoFullName, type });
  return serverRequest(`/api/github/dashboard/repository/entities?${search.toString()}`, { method: 'GET' });
}

export async function linkGitHubRepositoryEntityToItem({ repoFullName, type, number, itemId }) {
  return serverRequest('/api/github/dashboard/repository/link', {
    method: 'POST',
    body: JSON.stringify({ repoFullName, type, number, itemId }),
  });
}

export async function createGitHubIssue(itemId, repoFullName) {
  return serverRequest('/api/github/issues', {
    method: 'POST',
    body: JSON.stringify({ itemId, repoFullName }),
  });
}

export async function syncGitHubIssueStatus(itemId, status) {
  return serverRequest('/api/github/issues/sync-status', {
    method: 'POST',
    body: JSON.stringify({ itemId, status }),
  });
}

export async function getItemGitHubIssues(itemId) {
  const { data, error } = await supabase
    .from('item_github_issues')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
