type Level = "info" | "warn" | "error";

function enabled() {
  return process.env.NEXT_PUBLIC_DEBUG === "1";
}

function log(level: Level, event: string, meta?: Record<string, unknown>) {
  if (level !== "error" && !enabled()) return;
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  // eslint-disable-next-line no-console
  fn(`[debug:${level}] ${event}`, meta ?? {});
}

export const clientDebug = {
  info(event: string, meta?: Record<string, unknown>) {
    log("info", event, meta);
  },
  warn(event: string, meta?: Record<string, unknown>) {
    log("warn", event, meta);
  },
  error(event: string, meta?: Record<string, unknown>) {
    log("error", event, meta);
  },
};

