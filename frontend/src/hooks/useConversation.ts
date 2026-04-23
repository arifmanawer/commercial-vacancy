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

export interface OfferActionability {
  canAccept: boolean;
  canReject: boolean;
  canCounter: boolean;
  canWithdraw: boolean;
  reasonIfDisabled: string | null;
}

export interface OfferModel {
  id: string;
  conversation_id: string;
  listing_id: string;
  landlord_id: string;
  renter_id: string;
  parent_offer_id?: string | null;
  created_by?: string;
  rate_type: string;
  rate_amount: number;
  currency: string;
  start_date: string;
  duration: number;
  subtotal_amount: number;
  platform_fee_amount: number;
  total_amount: number;
  status: string;
  notes?: string | null;
  created_at: string;
}

interface ConversationResponse {
  conversation: ConversationSummary;
  messages: Message[];
  latestOffer?: OfferModel | null;
  offerActionability?: OfferActionability;
}

export function useConversation(conversationId: string | null) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [latestOffer, setLatestOffer] = useState<OfferModel | null>(null);
  const [offerActionability, setOfferActionability] = useState<OfferActionability | null>(null);

  async function refreshConversation() {
    if (!user || !conversationId) return;
    const res = await fetch(`${getApiUrl()}/api/messages/conversations/${conversationId}`, {
      headers: {
        "X-User-Id": user.id,
      },
    });
    const json = (await res.json().catch(() => null)) as
      | { success?: boolean; data?: ConversationResponse; error?: string }
      | null;
    if (!res.ok || !json?.success || !json.data) {
      throw new Error(json?.error || "Failed to refresh conversation");
    }
    setConversation(json.data.conversation);
    setMessages(json.data.messages);
    setLatestOffer(json.data.latestOffer ?? null);
    setOfferActionability(json.data.offerActionability ?? null);
  }

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
              "X-User-Id": user!.id,
            },
          }
        );

        const json = (await res.json().catch(() => null)) as
          | {
              success?: boolean;
              data?: ConversationResponse;
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
          setOfferActionability(json.data.offerActionability ?? null);
        }

        if (json.data.conversation.unread_count > 0) {
          await fetch(`${getApiUrl()}/api/messages/conversations/${conversationId}/read`, {
            method: "POST",
            headers: {
              "X-User-Id": user.id,
            },
          });
          if (!cancelled) {
            setConversation((prev) =>
              prev
                ? {
                    ...prev,
                    unread_count: 0,
                  }
                : prev
            );
          }
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

  return {
    conversation,
    messages,
    setMessages,
    latestOffer,
    setLatestOffer,
    offerActionability,
    refreshConversation,
    loading,
    error,
  };
}

