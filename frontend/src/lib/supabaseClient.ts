import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getAuthHeaders, withApiUserId } from './api';
import { debugFetch } from './debugFetch';
import { clientDebug } from './clientDebug';

/**
 * Supabase browser client for use in Client Components.
 * Uses cookies so middleware can read the session on server requests.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env'
  );
}

/** Singleton Supabase client - stores auth in cookies for SSR/middleware */
async function supabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : '[request]';
  const startedAt = Date.now();
  const method = (init?.method || 'GET').toUpperCase();

  const timeoutMs = Number(process.env.NEXT_PUBLIC_SUPABASE_FETCH_TIMEOUT_MS || '15000');
  const controller = new AbortController();
  const signal = init?.signal;

  // If caller already provided a signal, propagate abort into our controller.
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const t = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...(init ?? {}), signal: controller.signal });
    const elapsedMs = Date.now() - startedAt;
    if (!res.ok) {
      clientDebug.warn('supabase.fetch.not_ok', { method, url, status: res.status, elapsedMs });
    } else {
      clientDebug.info('supabase.fetch.ok', { method, url, status: res.status, elapsedMs });
    }
    return res;
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    clientDebug.error('supabase.fetch.error', {
      method,
      url,
      elapsedMs,
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    window.clearTimeout(t);
  }
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: supabaseFetch,
  },
});

/**
 * Public, non-auth Supabase client.
 *
 * Why this exists:
 * - Supabase auth persistence uses the browser Web Locks API to serialize token
 *   reads/writes across tabs.
 * - During Stripe redirects/3DS flows, users can end up with multiple tabs
 *   landing back on the app simultaneously, causing lock contention and timeouts
 *   like: "Acquiring an exclusive Navigator LockManager lock ... timed out".
 * - Public browsing should continue to work even if auth storage is wedged.
 *
 * This client never reads/writes session state and therefore avoids auth locks.
 * Use it for public reads (e.g. listings browse/detail).
 */
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    // Ensure this client never contends for the same Web Lock/storage keys as the
    // authenticated browser client. This avoids "multiple GoTrueClient" lock churn
    // during multi-tab Stripe/3DS redirects.
    storageKey: 'sb-public',
  },
});


export async function getCurrentSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

/**
 * Backend looks up user in Supabase by user_id from session.
 */
export async function fetchCurrentUserFromApi() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL?.trim() || '').replace(/\/+$/, '');
  const authHeaders = await getAuthHeaders();
  const res = await debugFetch(
    `${apiUrl}/api/users`,
    { headers: { ...authHeaders } },
    { label: "users.me.lookup", userId: session.user.id }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.user;
}
