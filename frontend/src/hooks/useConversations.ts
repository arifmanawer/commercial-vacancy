import { useEffect, useMemo, useRef, useState } from "react";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export type ConversationContextType = "listing" | "contractor" | "general";

export interface ConversationSummary {
  id: string;
  context_type: ConversationContextType;
  context_listing_id: string | null;
  context_contractor_id: string | null;
  context_listing_title: string | null;
  context_listing_address: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  participants: {
    user_id: string;
    role: string | null;
    display_name: string;
    profile_picture_url: string | null;
  }[];
  unread_count: number;
}

export function useConversations(options?: { enabled?: boolean; focusDebounceMs?: number }) {
  const { user } = useAuth();
  const enabled = options?.enabled ?? true;
  const focusDebounceMs = options?.focusDebounceMs ?? 250;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const focusTimerRef = useRef<number | null>(null);

  async function loadConversations(cancelled = false) {
    if (!enabled || !user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Cancel any in-flight request (e.g. user switches tabs rapidly).
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`${getApiUrl()}/api/messages/conversations`, {
        headers: {
          "X-User-Id": user.id,
        },
        signal: controller.signal,
      });

      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: ConversationSummary[]; error?: string }
        | null;

      if (!res.ok || !json?.success) {
        if (!cancelled) {
          setError(json?.error || "Failed to load conversations");
        }
        return;
      }

      if (!cancelled) {
        setConversations(json.data || []);
      }
    } catch (_err) {
      if (!cancelled) {
        // Ignore abort errors triggered by tab switching / unmounts.
        setError("Failed to load conversations");
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  async function refresh() {
    await loadConversations(false);
  }

  async function markAllAsRead() {
    if (!user) return;
    const unreadConversationIds = conversations
      .filter((c) => c.unread_count > 0)
      .map((c) => c.id);
    if (unreadConversationIds.length === 0) return;

    setConversations((prev) =>
      prev.map((conv) =>
        conv.unread_count > 0
          ? {
              ...conv,
              unread_count: 0,
            }
          : conv
      )
    );

    const results = await Promise.allSettled(
      unreadConversationIds.map((conversationId) =>
        fetch(`${getApiUrl()}/api/messages/conversations/${conversationId}/read`, {
          method: "POST",
          headers: {
            "X-User-Id": user.id,
          },
        })
      )
    );

    const hasFailure = results.some(
      (result) => result.status === "rejected" || (result.status === "fulfilled" && !result.value.ok)
    );

    if (hasFailure) {
      setError("Some conversations could not be marked as read. Retrying list sync...");
      await refresh();
    }
  }

  useEffect(() => {
    let cancelled = false;
    loadConversations(cancelled);

    const refreshOnFocus = () => {
      // Avoid triggering work for background tabs/windows.
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = window.setTimeout(() => {
        loadConversations(false);
      }, focusDebounceMs);
    };
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [user?.id, enabled, focusDebounceMs]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0),
    [conversations]
  );

  return { conversations, loading, error, totalUnread, refresh, markAllAsRead };
}

