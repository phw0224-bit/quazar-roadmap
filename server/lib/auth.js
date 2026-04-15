import { supabaseAuthClient, supabaseAdminClient } from './supabase.js';
import {
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

export async function getAuthenticatedUser(req) {
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

export async function requireAuthenticatedUser(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }
  return user;
}
