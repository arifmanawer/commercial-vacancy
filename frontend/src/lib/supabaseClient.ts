import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { withApiUserId } from './api';
import { debugFetch } from './debugFetch';

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
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

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
  const res = await debugFetch(withApiUserId(`${apiUrl}/api/users`, session.user.id), {
    headers: { 'X-User-Id': session.user.id },
  }, { label: "users.me.lookup", userId: session.user.id });
  if (!res.ok) return null;
  const json = await res.json();
  return json.user;
}
