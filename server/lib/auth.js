import { supabaseAuthClient, supabaseAdminClient } from './supabase.js';
import {
  GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY,
  GITHUB_APP_SLUG,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
} from './config.js';

export function requireServerConfig(res) {
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

export function isGitHubAppConfigured() {
  return Boolean(GITHUB_APP_SLUG);
}

export function isGitHubAppAuthConfigured() {
  return Boolean(GITHUB_APP_ID && GITHUB_APP_PRIVATE_KEY);
}

export async function getAuthenticatedUser(req) {
  if (!supabaseAuthClient) {
    throw new Error('Supabase auth client is not configured');
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    console.warn('[auth] Missing Bearer token on authenticated request');
    return null;
  }

  const { data, error } = await supabaseAuthClient.auth.getUser(token);
  if (error) {
    console.warn('[auth] Supabase auth.getUser failed', {
      message: error.message,
      status: error.status,
      code: error.code,
      tokenLength: token.length,
    });
    return null;
  }

  return data.user ?? null;
}

export function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

export async function requireAuthenticatedUser(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    console.warn('[auth] Authentication required response sent', {
      path: req.originalUrl,
      method: req.method,
    });
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }
  return user;
}
