"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
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
  const [authStorageWedge, setAuthStorageWedge] = useState(false);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      return;
    }
    const p = await fetchProfile(user.id);
    setProfile(p);
  }, [user?.id]);

  const updateProfileLocally = useCallback((updates: Partial<Profile>) => {
    setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const resolveProfile = useCallback(async (userId: string) => {
    let p = await fetchProfile(userId);
    if (p) return p;

    // On hard refresh in production, token refresh can lag briefly.
    // Retry once after forcing a refresh to avoid falling back to default profile UI.
    try {
      await supabase.auth.refreshSession();
    } catch (err) {
      if (isSupabaseAuthLockTimeout(err)) {
        // Auth storage is wedged; treat as logged out.
        setAuthStorageWedge(true);
        return null;
      }
      throw err;
    }
    p = await fetchProfile(userId);
    return p;
  }, []);

  useEffect(() => {
    let cancelled = false;

    // If auth storage is wedged, skip auth reads and allow app to run in anon mode.
    const boot = authStorageWedge
      ? Promise.resolve([{ data: { session: null } } as any, { data: { user: null } } as any])
      : Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);

    boot
      .then(async ([sessionRes, userRes]) => {
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
      })
      .catch((err) => {
        if (isSupabaseAuthLockTimeout(err)) {
          setAuthStorageWedge(true);
          setSession(null);
          setUser(null);
          setProfile(null);
          try {
            const key = "__cv_auth_reset_once__";
            const already = typeof window !== "undefined" && sessionStorage.getItem(key);
            if (!already) {
              sessionStorage.setItem(key, "1");
              clearSupabaseAuthCookiesAndStorage();
            }
          } catch {
            // ignore
          }
          return;
        }
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

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
        if (s?.user?.id) {
          const p = await resolveProfile(s.user.id);
          setProfile((prev) => p ?? prev);
        } else {
          setProfile(null);
        }
      } catch (err) {
        if (isSupabaseAuthLockTimeout(err)) {
          // Another tab likely holds the auth lock. Clear local auth and proceed in anon mode.
          setAuthStorageWedge(true);
          setSession(null);
          setUser(null);
          setProfile(null);

          // Clear cookies/storage once per tab to break the deadlock loop.
          try {
            const key = "__cv_auth_reset_once__";
            const already = typeof window !== "undefined" && sessionStorage.getItem(key);
            if (!already) {
              sessionStorage.setItem(key, "1");
              clearSupabaseAuthCookiesAndStorage();
            }
          } catch {
            // ignore
          }
          return;
        }
        // For other errors, fall back to safe logged-out state.
        setSession(null);
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [authStorageWedge, resolveProfile]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (err) {
      if (isSupabaseAuthLockTimeout(err)) {
        setAuthStorageWedge(true);
        clearSupabaseAuthCookiesAndStorage();
      } else {
        throw err;
      }
    } finally {
      // Always clear local state — onAuthStateChange can lag or miss a tick with cookie/session sync
      setSession(null);
      setUser(null);
      setProfile(null);
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
