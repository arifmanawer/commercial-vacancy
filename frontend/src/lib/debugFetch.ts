type DebugLevel = "info" | "warn" | "error";

function isEnabled() {
  // Default off in production. Turn on with NEXT_PUBLIC_API_DEBUG=1.
  return process.env.NEXT_PUBLIC_API_DEBUG === "1";
}

function emit(level: DebugLevel, message: string, meta?: Record<string, unknown>) {
  if (level !== "error" && !isEnabled()) return;
  // eslint-disable-next-line no-console
  (level === "error" ? console.error : level === "warn" ? console.warn : console.info)(
    message,
    meta ?? {},
  );
}

export async function debugFetch(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  opts?: {
    label?: string;
    userId?: string | null;
  },
) {
  const label = opts?.label ?? "fetch";
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : "[request]";
  const method = (init?.method || "GET").toUpperCase();
  const startedAt = Date.now();

  emit("info", `[api:info] ${label}.start`, { method, url, userId: opts?.userId ?? null });

  try {
    const res = await fetch(input, init);
    const elapsedMs = Date.now() - startedAt;

    // Best-effort: try to capture error payloads without consuming the body for callers that need it.
    let errorPreview: unknown = null;
    if (!res.ok) {
      try {
        const cloned = res.clone();
        const text = await cloned.text();
        errorPreview = text.slice(0, 500);
      } catch {
        errorPreview = null;
      }
    }

    emit(res.ok ? "info" : "warn", `[api:${res.ok ? "info" : "warn"}] ${label}.done`, {
      method,
      url,
      status: res.status,
      ok: res.ok,
      elapsedMs,
      userId: opts?.userId ?? null,
      ...(errorPreview ? { errorPreview } : {}),
    });

    return res;
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    emit("error", `[api:error] ${label}.error`, {
      method,
      url,
      elapsedMs,
      userId: opts?.userId ?? null,
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

