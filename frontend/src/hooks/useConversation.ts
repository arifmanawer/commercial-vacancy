import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import type { ConversationSummary } from "./useConversations";
import { getApiUrl } from "@/lib/api";

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

interface ConversationResponse {
  conversation: ConversationSummary;
  messages: Message[];
}

export function useConversation(conversationId: string | null) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [latestOffer, setLatestOffer] = useState<any | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user || !conversationId) {
      setConversation(null);
      setMessages([]);
      setLoading(false);
      return;
    }

    async function load() {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${getApiUrl()}/api/messages/conversations/${conversationId}`,
          {
            headers: {
              "X-User-Id": user.id,
            },
          }
        );

        const json = (await res.json().catch(() => null)) as
          | {
              success?: boolean;
              data?: ConversationResponse & { latestOffer?: any };
              error?: string;
            }
          | null;

        if (!res.ok || !json?.success || !json.data) {
          if (!cancelled) {
            setError(json?.error || "Failed to load conversation");
          }
          return;
        }

        if (!cancelled) {
          setConversation(json.data.conversation);
          setMessages(json.data.messages);
          setLatestOffer(json.data.latestOffer ?? null);
        }
      } catch (_err) {
        if (!cancelled) {
          setError("Failed to load conversation");
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
  }, [user, conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const record = payload.new as any;
          setMessages((prev) => {
            if (prev.some((m) => m.id === record.id)) return prev;
            return [
              ...prev,
              {
                id: record.id,
                conversation_id: record.conversation_id,
                sender_id: record.sender_id,
                body: record.body,
                created_at: record.created_at,
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return { conversation, messages, setMessages, latestOffer, setLatestOffer, loading, error };
}

