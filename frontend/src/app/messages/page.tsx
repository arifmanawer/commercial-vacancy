"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useConversations } from "@/hooks/useConversations";
import { useAuth } from "@/contexts/AuthContext";

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const { conversations, loading, error } = useConversations();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
        <Navbar />
      </header>
      <main className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-[var(--brand)] transition-colors mb-8"
        >
          ← Back to home
        </Link>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Messages</h1>
        <p className="mt-3 text-slate-600 max-w-2xl leading-relaxed">
          View and continue your conversations with landlords, renters, and contractors.
        </p>

        {!user && (
          <div className="mt-8 text-slate-600">
            Please{" "}
            <Link href="/signin" className="text-[var(--brand)] hover:underline">
              sign in
            </Link>{" "}
            to view your messages.
          </div>
        )}

        {user && (
          <section className="mt-10 space-y-4" aria-label="Message conversations">
            {loading && (
              <div className="text-slate-500 text-sm">Loading conversations…</div>
            )}
            {error && (
              <div className="text-sm text-red-600 border border-red-100 bg-red-50 px-3 py-2 rounded">
                {error}
              </div>
            )}
            {!loading && !error && conversations.length === 0 && (
              <div className="text-slate-500 text-sm">
                You don&apos;t have any conversations yet. Start by messaging a landlord,
                renter, or contractor from their page.
              </div>
            )}

            <div className="space-y-3">
              {conversations.map((conv) => {
                const unread = conv.unread_count > 0;
                const secondaryLine =
                  conv.context_type === "listing"
                    ? "Listing conversation"
                    : conv.context_type === "contractor"
                    ? "Contractor conversation"
                    : "General conversation";
                return (
                  <Link
                    key={conv.id}
                    href={`/messages/${conv.id}`}
                    className="block rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {secondaryLine}
                          </p>
                          {unread && (
                            <span className="inline-flex items-center justify-center rounded-full bg-[var(--brand)] text-white text-[10px] font-semibold px-1.5 py-0.5">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 truncate">
                          {conv.last_message_preview || "No messages yet"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[11px] text-slate-400">
                          {formatRelativeTime(conv.last_message_at)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

