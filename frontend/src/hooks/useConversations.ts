import { useEffect, useState } from "react";
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
  }[];
  unread_count: number;
}

export function useConversations() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  async function loadConversations(cancelled = false) {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/messages/conversations`, {
        headers: {
          "X-User-Id": user.id,
        },
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
      loadConversations(false);
    };
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [user]);

  const totalUnread = conversations.reduce(
    (sum, conv) => sum + (conv.unread_count || 0),
    0
  );

  return { conversations, loading, error, totalUnread, refresh, markAllAsRead };
}

