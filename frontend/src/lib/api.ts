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

