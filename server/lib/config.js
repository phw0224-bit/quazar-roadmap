import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..', '..');

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
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT_DIR, '.env'));
loadEnvFile(path.join(ROOT_DIR, '.env.local'));

export const PORT = 3001;
export const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';
export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
// Prefer the publishable key used by the browser bundle so server auth uses the same Supabase project key.
export const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.SUPABASE_ANON_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
export const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || `http://localhost:${PORT}/api/github/connect/callback`;
export const GITHUB_APP_ID = process.env.GITHUB_APP_ID || '';
export const GITHUB_APP_SLUG = process.env.GITHUB_APP_SLUG || '';
const gitHubAppPrivateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH
  ? path.resolve(ROOT_DIR, process.env.GITHUB_APP_PRIVATE_KEY_PATH)
  : null;
const gitHubAppPrivateKeyRaw = process.env.GITHUB_APP_PRIVATE_KEY
  || (gitHubAppPrivateKeyPath && fs.existsSync(gitHubAppPrivateKeyPath)
    ? fs.readFileSync(gitHubAppPrivateKeyPath, 'utf8')
    : '');
export const GITHUB_APP_PRIVATE_KEY = gitHubAppPrivateKeyRaw
  ? gitHubAppPrivateKeyRaw.replace(/\\n/g, '\n').trim()
  : '';
export const GITHUB_APP_INSTALL_REDIRECT_URI =
  process.env.GITHUB_APP_INSTALL_REDIRECT_URI || `http://localhost:${PORT}/api/github/app/install/callback`;
export const GITHUB_STATE_SECRET =
  process.env.GITHUB_STATE_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'roadmap-dev-github-state-secret';
export const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';
export const TICKET_KEY_PREFIX = process.env.TICKET_KEY_PREFIX || 'QZR';
export const GOOGLE_CHAT_DEV_REQUEST_WEBHOOK_URL = process.env.GOOGLE_CHAT_DEV_REQUEST_WEBHOOK_URL || '';
