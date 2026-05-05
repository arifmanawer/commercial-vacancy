import { getApiUrl, withApiUserId } from "./api";
import { supabase } from "./supabaseClient";

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
  (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      await fetch(withApiUserId(`${getApiUrl()}/api/auth-events`, userId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Silently ignore if backend is down
    }
  })();
}

export { logAuthEvent };
