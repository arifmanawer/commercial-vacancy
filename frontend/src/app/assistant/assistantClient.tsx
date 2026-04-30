"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/api";

type ListingCard = {
  id: string;
  title: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  property_type: string | null;
  rate_type: string | null;
  rate_amount: number | null;
  min_duration: number | null;
  max_duration: number | null;
  image: string | null;
};

type AssistantResponse = {
  reply: string;
  cards?: {
    listings?: ListingCard[];
  };
};

type ChatTurn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; listings?: ListingCard[] };

function formatPrice(rate_amount: number | null, rate_type: string | null) {
  if (rate_amount == null || !rate_type) return "";
  return `$${rate_amount}/${rate_type}`;
}

export default function AssistantClient({ listingId }: { listingId?: string }) {
  const { user } = useAuth();
  const listingIdSafe = (listingId || "").trim();

  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      role: "assistant",
      text:
        "Tell me what you’re looking for (city, budget, dates), or paste a listing link and I’ll help you evaluate it.",
    },
  ]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeholder = useMemo(() => {
    return listingIdSafe
      ? "Ask about this listing (pricing, availability, next steps)…"
      : "Ask about spaces, availability, or next steps…";
  }, [listingIdSafe]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      setError("Please sign in to use the assistant.");
      return;
    }
    const trimmed = message.trim();
    if (!trimmed) return;

    setSending(true);
    setError(null);
    setTurns((prev) => prev.concat({ role: "user", text: trimmed }));
    setMessage("");

    try {
      const res = await fetch(`${getApiUrl()}/api/assistant/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": user.id,
        },
        body: JSON.stringify({
          message: trimmed,
          contextType: listingIdSafe ? "listing" : "general",
          listingId: listingIdSafe || undefined,
        }),
      });

      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: AssistantResponse; error?: string }
        | null;

      const data = json?.data;
      if (!res.ok || !json?.success || !data) {
        throw new Error(json?.error || "Assistant request failed");
      }

      setTurns((prev) =>
        prev.concat({
          role: "assistant",
          text: data.reply,
          listings: data.cards?.listings,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assistant request failed");
      setTurns((prev) =>
        prev.concat({
          role: "assistant",
          text: "I couldn’t complete that request. Please try again with a little more detail (city, budget, dates).",
        })
      );
    } finally {
      setSending(false);
    }
  }

  function handleMessageKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending && message.trim()) {
        void send(e);
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
        <Navbar />
      </header>

      <main className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-[var(--brand)] transition-colors mb-6"
        >
          ← Back to home
        </Link>

        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
              Assistant
            </h1>
            <p className="mt-2 text-slate-600 max-w-2xl leading-relaxed">
              Ask questions about listings, availability, and next steps. The assistant is read-only and uses live platform data.
            </p>
          </div>
        </div>

        {!user && (
          <div className="mt-8 text-slate-600">
            Please{" "}
            <Link href="/signin" className="text-[var(--brand)] hover:underline">
              sign in
            </Link>{" "}
            to use the assistant.
          </div>
        )}

        {user && (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="h-[60vh] overflow-y-auto px-4 py-4 space-y-4 bg-slate-50/60">
              {turns.map((t, idx) => {
                const isUser = t.role === "user";
                return (
                  <div
                    key={idx}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div className="max-w-[80%]">
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm shadow-sm whitespace-pre-wrap break-words ${
                          isUser
                            ? "bg-[var(--brand)] text-white rounded-br-sm"
                            : "bg-white text-slate-900 rounded-bl-sm border border-slate-200/80"
                        }`}
                      >
                        {t.text}
                      </div>

                      {"listings" in t &&
                        Array.isArray(t.listings) &&
                        t.listings.length > 0 && (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {t.listings.slice(0, 6).map((l) => (
                              <Link
                                key={l.id}
                                href={`/listings/${l.id}`}
                                className="block rounded-xl border border-slate-200 bg-white p-3 hover:shadow-md transition-shadow"
                              >
                                <div className="flex gap-3">
                                  <div className="h-16 w-20 rounded-md bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                                    {l.image ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={l.image}
                                        alt={l.title || "Listing"}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <span className="text-[11px] text-slate-400">
                                        No image
                                      </span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 truncate">
                                      {l.title || "Listing"}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500 truncate">
                                      {[l.city, l.state]
                                        .filter(Boolean)
                                        .join(", ")}
                                      {l.property_type
                                        ? ` · ${l.property_type}`
                                        : ""}
                                    </p>
                                    <p className="mt-1 text-xs font-medium text-slate-900">
                                      {formatPrice(l.rate_amount, l.rate_type)}
                                    </p>
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-200 bg-white px-3 py-3">
              {error && (
                <div className="mb-3 text-sm text-red-600 border border-red-100 bg-red-50 px-3 py-2 rounded">
                  {error}
                </div>
              )}
              <form onSubmit={send} className="flex items-center gap-2">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleMessageKeyDown}
                  placeholder={placeholder}
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30 focus:border-[var(--brand)]/40 max-h-28"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !message.trim()}
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </form>
              <p className="mt-2 text-[11px] text-slate-500">
                The assistant is read-only and may be wrong. Verify details on
                the listing page before booking.
              </p>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

