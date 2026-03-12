import { useEffect, useState } from "react";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export type ConversationContextType = "listing" | "contractor" | "general";

export interface ConversationSummary {
  id: string;
  context_type: ConversationContextType;
  context_listing_id: string | null;
  context_contractor_id: string | null;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setConversations([]);
      return;
    }

    async function load() {
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

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const totalUnread = conversations.reduce(
    (sum, conv) => sum + (conv.unread_count || 0),
    0
  );

  return { conversations, loading, error, totalUnread };
}

