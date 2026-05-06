import { supabase } from "./supabaseClient";

let cachedToken: string | null = null;
let cachedExpiry: number = 0;
let inflightSessionPromise: ReturnType<typeof supabase.auth.getSession> | null = null;

export function getApiUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  // If unset, fall back to relative requests (e.g. `/api/...`) so
  // environments can proxy/rewrite without hardcoding ports.
  return (url || "").replace(/\/+$/, "");
}

/**
 * Some production proxies/CDNs strip custom headers like `X-User-Id`.
 * Backend supports `?user_id=` as a fallback; this helper appends it.
 */
export function withApiUserId(url: string, userId: string | null | undefined) {
  if (!userId) return url;
  try {
    const isAbsolute = /^https?:\/\//i.test(url);
    const base =
      isAbsolute
        ? undefined
        : typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost";
    const u = new URL(url, base);
    u.searchParams.set("user_id", userId);
    if (isAbsolute) return u.toString();
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    const join = url.includes("?") ? "&" : "?";
    return `${url}${join}user_id=${encodeURIComponent(userId)}`;
  }
}

export function setCachedToken(token: string | null, expiresAt: number) {
  cachedToken = token;
  cachedExpiry = expiresAt * 1000; // Supabase `expires_at` is seconds
}

export function clearCachedToken() {
  cachedToken = null;
  cachedExpiry = 0;
}

export async function getAuthHeaders(): Promise<HeadersInit> {
  // Use cached token when it is valid beyond the 60s buffer.
  if (cachedToken && cachedExpiry > Date.now() + 60_000) {
    return {
      Authorization: `Bearer ${cachedToken}`,
      "Content-Type": "application/json",
    };
  }

  // Cache miss: dedupe parallel calls to avoid Supabase auth Web Lock contention.
  if (!inflightSessionPromise) {
    inflightSessionPromise = supabase.auth.getSession();
  }
  const {
    data: { session },
  } = await inflightSessionPromise.finally(() => {
    inflightSessionPromise = null;
  });

  if (!session?.access_token || !session.expires_at) {
    clearCachedToken();
    return {};
  }

  setCachedToken(session.access_token, session.expires_at);

  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

