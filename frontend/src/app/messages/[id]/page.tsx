"use client";

import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useConversation } from "@/hooks/useConversation";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const { user } = useAuth();
  const { conversation, messages, setMessages, loading, error } = useConversation(id ?? null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !id) return;
    const trimmed = body.trim();
    if (!trimmed) return;

    setSending(true);
    try {
      const optimistic = {
        id: `temp-${Date.now()}`,
        conversation_id: id,
        sender_id: user.id,
        body: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setBody("");

      const res = await fetch(
        `${getApiUrl()}/api/messages/conversations/${id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": user.id,
          },
          body: JSON.stringify({ body: trimmed }),
        }
      );

      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: typeof optimistic; error?: string }
        | null;

      const sentMessage = json?.data;

      if (!res.ok || !json?.success || !sentMessage) {
        throw new Error(json?.error || "Failed to send message");
      }

      setMessages((prev) =>
        prev
          .filter((m) => !m.id.startsWith("temp-"))
          .concat(sentMessage)
      );
    } catch (_err) {
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")));
      toast("Failed to send message. Please try again.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <header className="border-b border-slate-100 sticky top-0 bg-white z-50">
        <Navbar />
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/messages"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors"
        >
          ← Back to Messages
        </Link>

        {loading && (
          <div className="text-slate-600 text-sm">Loading conversation…</div>
        )}
        {error && (
          <div className="text-sm text-red-600 border border-red-100 bg-red-50 px-3 py-2 rounded">
            {error}
          </div>
        )}
        {!loading && !conversation && !error && (
          <div className="text-slate-600 text-sm">
            Conversation not found or you don&apos;t have access.
          </div>
        )}

        {conversation && (
          <div className="mt-2 bg-slate-50/80 border border-slate-200 rounded-2xl flex flex-col h-[70vh] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="min-w-0">
                <h1 className="text-base font-semibold text-slate-900 truncate">
                  {conversation.context_listing_title
                    ? conversation.context_listing_title
                    : conversation.context_type === "listing"
                    ? "Listing conversation"
                    : conversation.context_type === "contractor"
                    ? "Contractor conversation"
                    : "Conversation"}
                </h1>
                {conversation.context_listing_address && (
                  <p className="text-xs text-slate-400 truncate">
                    {conversation.context_listing_address}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-0.5">
                  Your messages stay on the platform. Share contact details only if you&apos;re comfortable.
                </p>
              </div>
              {conversation.context_listing_id && (
                <Link
                  href={`/listings/${conversation.context_listing_id}`}
                  className="shrink-0 ml-3 text-xs font-medium text-[var(--brand)] hover:underline"
                >
                  View listing
                </Link>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg) => {
                const isSelf = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                        isSelf
                          ? "bg-[var(--brand)] text-white rounded-br-sm"
                          : "bg-white text-slate-900 rounded-bl-sm border border-slate-200/80"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <div className="text-xs text-slate-500 text-center mt-4">
                  No messages yet. Start the conversation below.
                </div>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="border-t border-slate-200 bg-white px-3 py-2 flex items-center gap-2"
            >
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type your message…"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30 focus:border-[var(--brand)]/40 max-h-28"
              />
              <button
                type="submit"
                disabled={sending || !body.trim()}
                className="inline-flex items-center justify-center rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </form>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

