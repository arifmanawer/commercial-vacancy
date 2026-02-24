import { createBrowserClient } from '@supabase/ssr';

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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const res = await fetch(`${apiUrl}/api/users`, {
    headers: { 'X-User-Id': session.user.id },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.user;
}
