"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "@/types/database";

type AuthState = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLandlord: boolean;
  isContractor: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfileLocally: (updates: Partial<Profile>) => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

function isSupabaseAuthLockTimeout(err: unknown): boolean {
  const msg =
    typeof err === "string"
      ? err
      : (err as any)?.message
        ? String((err as any).message)
        : "";
  // Observed in production after Stripe/3DS flows when multiple tabs land on the app:
  // "Acquiring an exclusive Navigator LockManager lock 'lock:sb-...-auth-token' timed out..."
  return (
    msg.includes("Navigator LockManager") &&
    msg.toLowerCase().includes("lock") &&
    msg.toLowerCase().includes("timed out")
  );
}

function clearSupabaseAuthCookiesAndStorage() {
  if (typeof window === "undefined") return;

  // Cookies: Supabase auth cookies start with "sb-" and often include "-auth-token".
  // We aggressively clear any "sb-" cookies for this host.
  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (const c of cookies) {
    const eq = c.indexOf("=");
    const rawName = (eq >= 0 ? c.slice(0, eq) : c).trim();
    if (!rawName.startsWith("sb-")) continue;

    const name = rawName;
    const base = `${name}=; Max-Age=0; path=/`;
    // Clear common variants. Domain attribute must match to remove some cookies.
    document.cookie = base;
    document.cookie = `${base}; domain=${window.location.hostname}`;
    document.cookie = `${base}; domain=.${window.location.hostname}`;
  }

  try {
    // Supabase may store additional keys in localStorage/sessionStorage.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-")) localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("sb-")) sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isSessionFresh(s: Session | null, opts?: { bufferMs?: number }) {
  if (!s?.expires_at) return false;
  const bufferMs = opts?.bufferMs ?? 60_000;
  return s.expires_at * 1000 > Date.now() + bufferMs;
}

type AuthLeaderMsg =
  | { type: "claim"; tabId: string; ts: number }
  | { type: "leader"; tabId: string; ts: number };

/**
 * Supabase auth uses browser storage + Web Locks to coordinate cross-tab updates.
 * During Stripe/3DS flows, multiple tabs can land back on the app and briefly contend
 * for the auth lock. That should not force a logout; instead we retry reads for a bit.
 */
async function withAuthLockRetry<T>(
  fn: () => Promise<T>,
  opts?: { attempts?: number; baseDelayMs?: number },
) {
  const attempts = Math.max(1, opts?.attempts ?? 8);
  const baseDelayMs = Math.max(50, opts?.baseDelayMs ?? 120);

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isSupabaseAuthLockTimeout(err)) throw err;
      // Exponential backoff with a small cap to keep UX snappy.
      const delay = Math.min(1500, baseDelayMs * Math.pow(1.6, i));
      await sleep(delay);
    }
  }
  throw lastErr;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return data as Profile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLeader, setIsLeader] = useState(false);
  const isLeaderRef = useRef(false);
  const sessionRef = useRef<Session | null>(null);
  const authOpRef = useRef<Promise<unknown>>(Promise.resolve());
  /** Same-user profile loads from bootAuth + onAuthStateChange share one network round-trip. */
  const profileInflightRef = useRef<Map<string, Promise<Profile | null>>>(new Map());
  const profileResultCacheRef = useRef<{ userId: string; profile: Profile | null } | null>(null);

  // useEffect(() => {
  //   isLeaderRef.current = isLeader;
  // }, [isLeader]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const runAuthOp = useCallback(async <T,>(fn: () => Promise<T>) => {
    // Serialize *all* Supabase auth operations within this tab to avoid
    // self-inflicted LockManager contention.
    const prev = authOpRef.current;
    let resolveNext: (v: unknown) => void;
    authOpRef.current = new Promise((r) => {
      resolveNext = r;
    });
    try {
      await prev;
      return await fn();
    } finally {
      resolveNext!(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      return;
    }
    profileResultCacheRef.current = null;
    const p = await fetchProfile(user.id);
    setProfile(p);
  }, [user?.id]);

  const updateProfileLocally = useCallback((updates: Partial<Profile>) => {
    profileResultCacheRef.current = null;
    setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const resolveProfile = useCallback(
    async (userId: string) => {
      const cached = profileResultCacheRef.current;
      if (cached && cached.userId === userId) {
        return cached.profile;
      }
      const existing = profileInflightRef.current.get(userId);
      if (existing) return existing;

      const promise = (async () => {
        try {
          let p = await fetchProfile(userId);
          if (p) {
            profileResultCacheRef.current = { userId, profile: p };
            return p;
          }

          // On hard refresh in production, token refresh can lag briefly.
          try {
            if (isLeaderRef.current) {
              await runAuthOp(() =>
                withAuthLockRetry(() => supabase.auth.refreshSession(), { attempts: 5, baseDelayMs: 150 })
              );
            } else {
              await sleep(250);
            }
          } catch (err) {
            throw err;
          }
          p = await fetchProfile(userId);
          profileResultCacheRef.current = { userId, profile: p };
          return p;
        } finally {
          profileInflightRef.current.delete(userId);
        }
      })();

      profileInflightRef.current.set(userId, promise);
      return promise;
    },
    [runAuthOp],
  );

  useEffect(() => {
    let cancelled = false;
    const tabId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Math.random());

    let bc: BroadcastChannel | null = null;
    let claimTs = Date.now();
    let bestClaim: { ts: number; tabId: string } = { ts: claimTs, tabId };
    let lastLeaderBeatAt = 0;
    let leaderBeatInterval: number | null = null;
    let reelectTimer: number | null = null;
    let bootTimer: number | null = null;
    let visibleRefreshTimer: number | null = null;

    const becomeLeader = () => {
      if (cancelled) return;
      isLeaderRef.current = true;
      setIsLeader(true);
      // Heartbeat so followers can detect leader disappearance.
      if (leaderBeatInterval) window.clearInterval(leaderBeatInterval);
      leaderBeatInterval = window.setInterval(() => {
        try {
          bc?.postMessage({
            type: "leader",
            tabId,
            ts: Date.now(),
          } satisfies AuthLeaderMsg);
        } catch {
          // ignore
        }
      }, 1000);
    };

    const becomeFollower = () => {
      if (cancelled) return;
      isLeaderRef.current = false;
      setIsLeader(false);
      if (leaderBeatInterval) {
        window.clearInterval(leaderBeatInterval);
        leaderBeatInterval = null;
      }
    };

    const decideLeader = () => {
      if (cancelled) return;
      if (bestClaim.tabId === tabId) becomeLeader();
      else becomeFollower();
    };

    const startElection = () => {
      claimTs = Date.now();
      bestClaim = { ts: claimTs, tabId };
      try {
        bc?.postMessage({
          type: "claim",
          tabId,
          ts: claimTs,
        } satisfies AuthLeaderMsg);
      } catch {
        // ignore
      }
      // Give a short window for other tabs to send claims; earliest wins.
      window.setTimeout(decideLeader, 200);
    };

    const scheduleReelection = () => {
      if (reelectTimer) window.clearTimeout(reelectTimer);
      reelectTimer = window.setTimeout(() => {
        startElection();
      }, 1500);
    };

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      bc = new BroadcastChannel("auth-leader");
      bc.onmessage = (evt: MessageEvent) => {
        const msg = evt.data as AuthLeaderMsg | undefined;
        if (!msg || typeof msg !== "object") return;

        if (msg.type === "claim") {
          const other = { ts: msg.ts, tabId: msg.tabId };
          const isBetter =
            other.ts < bestClaim.ts ||
            (other.ts === bestClaim.ts && other.tabId < bestClaim.tabId);
          if (isBetter) bestClaim = other;
          return;
        }

        if (msg.type === "leader") {
          lastLeaderBeatAt = Date.now();
          // If we thought we were leader but another tab is beating, step down unless we are the same tab.
          if (msg.tabId !== tabId && isLeader) {
            becomeFollower();
          }
        }
      };
    }

    startElection();

    const monitorLeader = window.setInterval(() => {
      if (cancelled) return;
      if (isLeader) return;
      // If no leader beat seen recently, re-elect.
      if (lastLeaderBeatAt && Date.now() - lastLeaderBeatAt > 2500) {
        scheduleReelection();
      }
    }, 800);

    const bootAuth = async (mode: "full" | "minimal") => {
      // 3) Guard boot: if hidden, delay full boot to let visible leader go first.
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible" &&
        mode === "full"
      ) {
        await sleep(1500);
      }

      try {
        if (mode === "minimal") {
          const sessionRes = await runAuthOp(() =>
            withAuthLockRetry(() => supabase.auth.getSession(), {
              attempts: 3,
              baseDelayMs: 200,
            }),
          );
          if (cancelled) return;
          setSession(sessionRes.data.session);
          setUser(sessionRes.data.session?.user ?? null);
          // Don't force profile loads from followers; keep prior.
          return;
        }

        const [sessionRes, userRes] = await runAuthOp(() =>
          withAuthLockRetry(
            async () =>
              Promise.all([
                supabase.auth.getSession(),
                supabase.auth.getUser(),
              ]),
            {
              attempts: 8,
              baseDelayMs: 120,
            },
          ),
        );
        if (cancelled) return;

        const s = sessionRes.data.session;
        const verifiedUser = userRes.data.user ?? null;
        setSession(s);
        setUser(verifiedUser);

        if (verifiedUser?.id) {
          try {
            const p = await resolveProfile(verifiedUser.id);
            if (!cancelled) setProfile(p);
          } catch {
            if (!cancelled) setProfile(null);
          }
        } else {
          setProfile(null);
        }
      } catch (err) {
        // 5) On lock timeout, retry getSession once after 2s.
        if (isSupabaseAuthLockTimeout(err)) {
          await sleep(2000);
          try {
            const sessionRes = await runAuthOp(() =>
              supabase.auth.getSession(),
            );
            if (cancelled) return;
            setSession(sessionRes.data.session);
            setUser(sessionRes.data.session?.user ?? null);
          } catch {
            // ignore
          }
          return;
        }
        if (!cancelled) setProfile((prev) => prev);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    // 1) visibilitychange + focus debounce guard:
    // When the tab becomes visible, followers do a minimal getSession (if missing/stale),
    // leaders may refresh after 2s if session is stale.
    const onVisibleMaybeRefresh = () => {
      if (cancelled) return;
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      )
        return;

      if (visibleRefreshTimer) window.clearTimeout(visibleRefreshTimer);
      visibleRefreshTimer = window.setTimeout(async () => {
        if (cancelled) return;

        // Followers: only fetch session if missing/stale; never refreshSession here.
        if (!isLeaderRef.current) {
          if (!isSessionFresh(sessionRef.current, { bufferMs: 60_000 })) {
            await bootAuth("minimal");
          }
          return;
        }

        // Leaders: only refresh if session is stale.
        if (isSessionFresh(sessionRef.current, { bufferMs: 60_000 })) return;
        try {
          await runAuthOp(() =>
            withAuthLockRetry(() => supabase.auth.refreshSession(), {
              attempts: 3,
              baseDelayMs: 300,
            }),
          );
          // After refresh, re-read session/user.
          await bootAuth("minimal");
        } catch {
          // ignore; next visibility/focus will retry
        }
      }, 2000);
    };

    document.addEventListener("visibilitychange", onVisibleMaybeRefresh);
    window.addEventListener("focus", onVisibleMaybeRefresh);

    // Defer boot until after leader election (~200ms) so isLeaderRef matches the winning tab.
    // Hidden tabs still wait longer so a visible tab can claim the auth lock first.
    const bootDelayMs =
      typeof document !== "undefined" && document.visibilityState !== "visible" ? 1500 : 250;
    bootTimer = window.setTimeout(() => {
      bootAuth(isLeaderRef.current ? "full" : "minimal");
    }, bootDelayMs);

    // Fallback: never leave loading true for more than 3s (e.g. if getSession hangs)
    const timeoutId = setTimeout(() => {
      setLoading((prev) => (prev ? false : prev));
    }, 3000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      try {
        setSession(s);
        setUser(s?.user ?? null);
        // Session is known (signed in or out) — unblock navbar before profile/network completes.
        setLoading(false);
        if (s?.user?.id) {
          const p = await resolveProfile(s.user.id);
          setProfile((prev) => p ?? prev);
        } else {
          setProfile(null);
        }
      } catch (err) {
        // Never clear auth on lock contention; it is usually transient during multi-tab redirects.
        // For other errors, fall back to safe logged-out state.
        if (!isSupabaseAuthLockTimeout(err)) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    });

    // Ensure profile hydration after election settles even when no auth event fires.
    // Followers keep minimal behavior to avoid multi-tab lock churn.
    const postElectionHydration = window.setTimeout(() => {
      if (cancelled || !isLeaderRef.current) return;
      void bootAuth("full");
    }, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(monitorLeader);
      if (bootTimer) window.clearTimeout(bootTimer);
      window.clearTimeout(postElectionHydration);
      if (visibleRefreshTimer) window.clearTimeout(visibleRefreshTimer);
      if (reelectTimer) window.clearTimeout(reelectTimer);
      if (leaderBeatInterval) window.clearInterval(leaderBeatInterval);
      bc?.close();
      document.removeEventListener("visibilitychange", onVisibleMaybeRefresh);
      window.removeEventListener("focus", onVisibleMaybeRefresh);
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [resolveProfile, runAuthOp]);

  const signOut = async () => {
    const SIGN_OUT_WAIT_MS = 10_000;
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: "global" }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("signOut timed out")), SIGN_OUT_WAIT_MS);
        }),
      ]);
    } catch {
      // Clear storage in finally (lock timeout, network, etc.)
    } finally {
      clearSupabaseAuthCookiesAndStorage();
      profileResultCacheRef.current = null;
      profileInflightRef.current.clear();
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);
    }
  };

  const isLandlord = profile?.is_landlord ?? false;
  const isContractor = profile?.is_contractor ?? false;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLandlord,
        isContractor,
        loading,
        signOut,
        refreshProfile,
        updateProfileLocally,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
