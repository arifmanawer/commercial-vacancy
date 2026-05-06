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
import { authDebug } from "@/lib/authDebug";
import type { Profile } from "@/types/database";
import { clearCachedToken, setCachedToken } from "@/lib/api";

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

function clearSupabaseAuthCookiesAndStorage() {
  if (typeof window === "undefined") return;

  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (const c of cookies) {
    const eq = c.indexOf("=");
    const rawName = (eq >= 0 ? c.slice(0, eq) : c).trim();
    if (!rawName.startsWith("sb-")) continue;

    const name = rawName;
    const base = `${name}=; Max-Age=0; path=/`;
    document.cookie = base;
    document.cookie = `${base}; domain=${window.location.hostname}`;
    document.cookie = `${base}; domain=.${window.location.hostname}`;
  }

  try {
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

async function fetchProfile(userId: string): Promise<Profile | null> {
  authDebug.info("profile.fetch.start", { userId });
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error || !data) {
    authDebug.warn("profile.fetch.miss", {
      userId,
      error: error?.message ?? null,
      hasData: Boolean(data),
    });
    return null;
  }
  authDebug.info("profile.fetch.ok", { userId });
  return data as Profile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileInflightRef = useRef<Map<string, Promise<Profile | null>>>(
    new Map(),
  );
  const profileResultCacheRef = useRef<{
    userId: string;
    profile: Profile | null;
  } | null>(null);

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

  const resolveProfile = useCallback(async (userId: string) => {
    const cached = profileResultCacheRef.current;
    if (cached && cached.userId === userId) {
      return cached.profile;
    }
    const existing = profileInflightRef.current.get(userId);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const p = await fetchProfile(userId);
        profileResultCacheRef.current = { userId, profile: p };
        return p;
      } finally {
        profileInflightRef.current.delete(userId);
      }
    })();

    profileInflightRef.current.set(userId, promise);
    return promise;
  }, []);

  const loadProfileWithRetry = useCallback(
    async (userId: string, opts?: { retries?: number; delayMs?: number }) => {
      const retries = opts?.retries ?? 2;
      const delayMs = opts?.delayMs ?? 500;
      let lastErr: unknown = null;

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          authDebug.info("profile.resolve.attempt", { userId, attempt, retries });
          const p = await resolveProfile(userId);
          return p;
        } catch (err) {
          lastErr = err;
          authDebug.warn("profile.resolve.error", {
            userId,
            attempt,
            message: err instanceof Error ? err.message : String(err),
          });
          // A common reason for a first-load miss is an expired access token that
          // gets refreshed shortly after startup. Try a refresh once per attempt.
          try {
            authDebug.info("session.refresh.start", { userId, attempt });
            await supabase.auth.refreshSession();
            authDebug.info("session.refresh.ok", { userId, attempt });
          } catch {
            authDebug.warn("session.refresh.error", { userId, attempt });
            // ignore refresh errors; we'll still retry resolveProfile
          }
          if (attempt < retries) {
            await new Promise((r) => window.setTimeout(r, delayMs * (attempt + 1)));
          }
        }
      }

      throw lastErr;
    },
    [resolveProfile],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const shouldResetOnBoot =
        process.env.NEXT_PUBLIC_RESET_AUTH_ON_BOOT === "1";
      authDebug.info("startup.boot", { shouldResetOnBoot });
      try {
        if (shouldResetOnBoot) {
          authDebug.info("startup.resetSession.start");
          // Clean slate on app boot (debug mode).
          try {
            await supabase.auth.signOut({ scope: "local" });
          } catch {
            // ignore
          }
          clearSupabaseAuthCookiesAndStorage();
          if (cancelled) return;
          setSession(null);
          setUser(null);
          setProfile(null);
          authDebug.info("startup.resetSession.done");
        }

        authDebug.info("startup.getSession.start");
        const {
          data: { session: s },
          error,
        } = await supabase.auth.getSession();
        if (error) {
          authDebug.error("startup.getSession.error", { message: error.message });
        }
        if (cancelled) return;
        authDebug.info("startup.getSession.ok", {
          hasSession: Boolean(s),
          userId: s?.user?.id ?? null,
        });
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user?.id) {
          try {
            const p = await loadProfileWithRetry(s.user.id);
            if (!cancelled) setProfile(p);
          } catch {
            if (!cancelled) setProfile(null);
          }
        } else {
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      authDebug.info("startup.getSession.done", { cancelled });
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      try {
        authDebug.info("auth.onAuthStateChange", {
          event,
          hasSession: Boolean(s),
          userId: s?.user?.id ?? null,
        });
        setSession(s);
        if (event === "SIGNED_OUT") {
          clearCachedToken();
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          const token = s?.access_token ?? null;
          const expiresAt = s?.expires_at ?? 0;
          if (token && expiresAt) setCachedToken(token, expiresAt);
        }
        setUser(s?.user ?? null);
        if (s?.user?.id) {
          const p = await loadProfileWithRetry(s.user.id);
          setProfile((prev) => p ?? prev);
        } else {
          setProfile(null);
        }
        setLoading(false);
      } catch (err) {
        authDebug.error("auth.onAuthStateChange.error", {
          message: err instanceof Error ? err.message : String(err),
        });
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadProfileWithRetry, resolveProfile]);

  const signOut = async () => {
    const SIGN_OUT_WAIT_MS = 10_000;
    authDebug.info("signOut.start");
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: "global" }),
        new Promise<never>((_, reject) => {
          window.setTimeout(
            () => reject(new Error("signOut timed out")),
            SIGN_OUT_WAIT_MS,
          );
        }),
      ]);
    } catch {
      // Clear storage in finally (lock timeout, network, etc.)
    } finally {
      authDebug.info("signOut.cleanup");
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
