type DebugLevel = "info" | "warn" | "error";

function isEnabled() {
  // Default off in production. Turn on with NEXT_PUBLIC_AUTH_DEBUG=1.
  return process.env.NEXT_PUBLIC_AUTH_DEBUG === "1";
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function emit(level: DebugLevel, event: string, details?: Record<string, unknown>) {
  // Always show errors; gate info/warn behind env flag.
  if (level !== "error" && !isEnabled()) return;
  const payload = details ? safeJson(details) : "";
  const prefix = `[auth:${level}]`;
  // eslint-disable-next-line no-console
  (level === "error" ? console.error : level === "warn" ? console.warn : console.info)(
    `${prefix} ${event}`,
    details ? details : payload,
  );
}

export const authDebug = {
  info(event: string, details?: Record<string, unknown>) {
    emit("info", event, details);
  },
  warn(event: string, details?: Record<string, unknown>) {
    emit("warn", event, details);
  },
  error(event: string, details?: Record<string, unknown>) {
    emit("error", event, details);
  },
};

