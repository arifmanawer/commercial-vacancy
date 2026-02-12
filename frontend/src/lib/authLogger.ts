const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type AuthEvent = "signin" | "signup";

function logAuthEvent(
  event: AuthEvent,
  email: string,
  success: boolean,
  error?: string
) {
  const payload = {
    event,
    email,
    success,
    ...(error && { error }),
    timestamp: new Date().toISOString(),
  };

  // Console log for browser dev tools
  console.log(`[Auth] ${event} attempt:`, payload);

  // Fire-and-forget: send to backend for server-side logging
  fetch(`${API_URL}/api/auth-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Silently ignore if backend is down
  });
}

export { logAuthEvent };
