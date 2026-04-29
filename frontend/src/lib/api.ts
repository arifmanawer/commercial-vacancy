export function getApiUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  // If unset, fall back to relative requests (e.g. `/api/...`) so
  // environments can proxy/rewrite without hardcoding ports.
  return (url || "").replace(/\/+$/, "");
}

