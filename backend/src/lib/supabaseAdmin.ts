import { createClient } from '@supabase/supabase-js';

/**
 * Supabase admin client
 * Use for: admin queries, validating JWTs, server-only data access.
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Missing Supabase admin env vars. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env'
  );
}

/** Admin client - server-side only. Validates JWTs and performs privileged operations. */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
