import { supabaseAuthClient, supabaseAdminClient } from './supabase.js';
import {
  GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY,
  GITHUB_APP_SLUG,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
} from './config.js';

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

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
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    console.warn('[auth] Missing Bearer token on authenticated request');
    return null;
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    console.warn('[auth] Failed to decode JWT token');
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    console.warn('[auth] JWT token expired', { exp: payload.exp, now });
    return null;
  }

  return {
    id: payload.sub,
    email: payload.email,
    user_metadata: payload.user_metadata || {},
    app_metadata: payload.app_metadata || {},
  };
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
