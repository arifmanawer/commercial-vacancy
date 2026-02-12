import { createClient } from '@supabase/supabase-js';

/**
 * Supabase browser client for use in Client Components.
 * Uses anon key only - safe to expose; RLS and Supabase Auth enforce security.
 * Service role key must NEVER be used here (client bundle is public).
 *
 * NEXT_PUBLIC_ prefix ensures these vars are available in the browser at build time.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env'
  );
}

/** Singleton Supabase client for auth and database in Client Components */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Example: Sign in with email/password (use in Client Component)
 *
 * const { data, error } = await supabase.auth.signInWithPassword({ email, password });
 * if (data.session) { ... }
 */
// (Usage shown in signin/page.tsx)

/**
 * Example: Get current session (use in Client Component)
 * Returns the active session or null if not logged in.
 */
export async function getCurrentSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

/**
 * Fetch current user from backend API (uses Supabase - no JWT).
 * Backend looks up user in Supabase by user_id from session.
 */
export async function fetchCurrentUserFromApi() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const res = await fetch(`${apiUrl}/api/users`, {
    headers: { 'X-User-Id': session.user.id },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.user;
}
