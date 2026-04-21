import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing in .env file');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

let authReadQueue = Promise.resolve();

function runSerializedAuthRead(readFn) {
  const next = authReadQueue.then(readFn, readFn);
  authReadQueue = next.catch(() => {});
  return next;
}

const wrapAuthReadMethod = (methodName) => {
  const original = supabase.auth[methodName].bind(supabase.auth);
  supabase.auth[methodName] = (...args) => runSerializedAuthRead(() => original(...args));
};

wrapAuthReadMethod('getSession');
wrapAuthReadMethod('getUser');
