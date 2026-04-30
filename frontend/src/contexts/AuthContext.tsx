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
    await supabase.auth.refreshSession();
    p = await fetchProfile(userId);
    return p;
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([supabase.auth.getSession(), supabase.auth.getUser()])
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
      .catch(() => {
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
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user?.id) {
        const p = await resolveProfile(s.user.id);
        setProfile((prev) => p ?? prev);
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [resolveProfile]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: "global" });
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
