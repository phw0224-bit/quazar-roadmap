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
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

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

export async function getGitHubRepos() {
  const data = await serverRequest('/api/github/repos', { method: 'GET' });
  return data?.repos || [];
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
