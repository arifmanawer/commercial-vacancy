"use client";

import { useParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useConversation } from "@/hooks/useConversation";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/api";

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const { user } = useAuth();
  const { conversation, messages, setMessages, latestOffer, loading, error } =
    useConversation(id ?? null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [offerStart, setOfferStart] = useState("");
  const [offerDuration, setOfferDuration] = useState("");
  const [offerSubmitting, setOfferSubmitting] = useState(false);

  const isLandlordInConversation = useMemo(() => {
    if (!conversation || !user) return false;
    return conversation.participants.some(
      (p) => p.user_id === user.id && p.role === "landlord",
    );
  }, [conversation, user]);

  const isRenterInConversation = useMemo(() => {
    if (!conversation || !user) return false;
    return conversation.participants.some(
      (p) => p.user_id === user.id && p.role === "renter",
    );
  }, [conversation, user]);

  const activeOffer = latestOffer;

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

      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || "Failed to send message");
      }

      setMessages((prev) =>
        prev
          .filter((m) => !m.id.startsWith("temp-"))
          .concat(json.data)
      );
    } catch (_err) {
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")));
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleCreateOffer(e: FormEvent) {
    e.preventDefault();
    if (!user || !id || !conversation) return;
    if (!offerStart || !offerDuration) return;

    const duration = Number(offerDuration);
    if (!Number.isFinite(duration) || duration <= 0) {
      alert("Duration must be a positive number.");
      return;
    }

    const renterParticipant = conversation.participants.find(
      (p) => p.user_id !== user.id && p.role === "renter",
    );
    const renterId = renterParticipant?.user_id;

    if (!renterId || !conversation.context_listing_id) {
      alert(
        "This conversation is not linked to a listing and renter yet. You can only create offers from listing conversations.",
      );
      return;
    }

    setOfferSubmitting(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/offers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": user.id,
        },
        body: JSON.stringify({
          conversationId: id,
          listingId: conversation.context_listing_id,
          renterId,
          startDate: offerStart,
          duration,
        }),
      });

      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: any; error?: string }
        | null;

      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || "Failed to create offer");
      }

      setOfferStart("");
      setOfferDuration("");
      setCreatingOffer(false);
      // Optimistically set latest offer for this thread
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).latestOfferDebug = json.data;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message || "Failed to create offer. Please try again."
          : "Failed to create offer. Please try again.";
      alert(msg);
    } finally {
      setOfferSubmitting(false);
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
              <div>
                <h1 className="text-base font-semibold text-slate-900">
                  {conversation.context_type === "listing"
                    ? "Listing conversation"
                    : conversation.context_type === "contractor"
                    ? "Contractor conversation"
                    : "Conversation"}
                </h1>
                <p className="text-xs text-slate-500">
                  Your messages stay on the platform. Share contact details only if you&apos;re comfortable.
                </p>
              </div>
              {conversation.context_type === "listing" && isLandlordInConversation && (
                <button
                  type="button"
                  onClick={() => {
                    setCreatingOffer((prev) => !prev);
                  }}
                  className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {creatingOffer ? "Close offer" : "Create Offer"}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {activeOffer && (
                <div className="mb-3 flex justify-center">
                  <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-800 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Offer
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {activeOffer.rate_amount} {activeOffer.currency?.toUpperCase() ?? "USD"}/
                          {activeOffer.rate_type}
                        </p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                        {activeOffer.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Start:{" "}
                      {activeOffer.start_date
                        ? new Date(activeOffer.start_date).toLocaleString()
                        : "—"}
                    </p>
                    <p className="text-xs text-slate-600">
                      Duration: {activeOffer.duration} {activeOffer.rate_type}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-900">
                      Total: ${(activeOffer.total_amount / 100).toFixed(2)}{" "}
                      {activeOffer.currency?.toUpperCase() ?? "USD"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Review the dates, price, and any refund policy in the listing before you accept.
                      When you accept and complete payment, you&apos;ll enter into a binding rental agreement
                      with this landlord through Commercial Vacancy.
                    </p>
                    {isRenterInConversation && activeOffer.status === "pending" && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className="inline-flex flex-1 items-center justify-center rounded-md bg-[var(--brand)] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[var(--brand-dark)] disabled:opacity-60"
                          disabled
                        >
                          Accept &amp; pay (coming soon)
                        </button>
                        <button
                          type="button"
                          className="inline-flex flex-1 items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                          disabled
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

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

            <div className="border-t border-slate-200 bg-white px-3 py-2 space-y-3">
              {creatingOffer && conversation?.context_type === "listing" && isLandlordInConversation && (
                <form
                  onSubmit={handleCreateOffer}
                  className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 space-y-2"
                >
                  <p className="text-xs font-semibold text-slate-800">
                    Create an offer based on this listing&apos;s rate.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-[11px] font-medium text-slate-700">
                      Start date &amp; time
                      <input
                        type="datetime-local"
                        value={offerStart}
                        onChange={(e) => setOfferStart(e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)]"
                        required
                      />
                    </label>
                    <label className="text-[11px] font-medium text-slate-700">
                      Duration
                      <input
                        type="number"
                        min={1}
                        value={offerDuration}
                        onChange={(e) => setOfferDuration(e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)]"
                        required
                      />
                    </label>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCreatingOffer(false)}
                      className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      disabled={offerSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={offerSubmitting}
                      className="inline-flex items-center rounded-md bg-[var(--brand)] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[var(--brand-dark)] disabled:opacity-60"
                    >
                      {offerSubmitting ? "Creating…" : "Send Offer"}
                    </button>
                  </div>
                </form>
              )}

              <form
                onSubmit={handleSubmit}
                className="flex items-center gap-2"
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
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

