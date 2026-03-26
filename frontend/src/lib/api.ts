export function getApiUrl() {
  const url =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:5000`
      : "http://localhost:5000");
  const resolved = url.replace(/\/+$/, ""); // strip trailing slash

  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/732c440c-88ac-4208-979e-9aee3e11d0cd", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "e74c3e",
    },
    body: JSON.stringify({
      sessionId: "e74c3e",
      location: "frontend/src/lib/api.ts:getApiUrl",
      message: "Resolved API base URL",
      hypothesisId: "H1_WRONG_API_URL_PORT_OR_BASE",
      data: {
        hasEnv: Boolean(process.env.NEXT_PUBLIC_API_URL),
        includesPort5000: /:5000/.test(resolved),
        includesPort3001: /:3001/.test(resolved),
        resolved,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return resolved;
}

