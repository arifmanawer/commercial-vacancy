"use client";

import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { OfferModel, useConversation } from "@/hooks/useConversation";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const { user } = useAuth();
  const {
    conversation,
    messages,
    setMessages,
    latestOffer,
    offerActionability,
    refreshConversation,
    loading,
    error,
  } = useConversation(id ?? null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [offerMode, setOfferMode] = useState<"create" | "counter">("create");
  const [offerStart, setOfferStart] = useState("");
  const [offerDuration, setOfferDuration] = useState("");
  const [offerRateAmount, setOfferRateAmount] = useState("");
  const [offerRateType, setOfferRateType] = useState("");
  const [offerNotes, setOfferNotes] = useState("");
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerActionLoading, setOfferActionLoading] = useState<string | null>(null);
  const [offerHistory, setOfferHistory] = useState<OfferModel[]>([]);
  const [offerHistoryLoading, setOfferHistoryLoading] = useState(false);

  const durationUnitLabel = useMemo(() => {
    const normalized = offerRateType.trim().toLowerCase();
    switch (normalized) {
      case "hourly":
        return "hours";
      case "weekly":
        return "weeks";
      case "monthly":
        return "months";
      case "daily":
        return "days";
      default:
        return "units";
    }
  }, [offerRateType]);

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

  const isParticipantInConversation = useMemo(() => {
    if (!conversation || !user) return false;
    return conversation.participants.some((p) => p.user_id === user.id);
  }, [conversation, user]);

  const canCreateOffer =
    conversation?.context_type === "listing" &&
    (isLandlordInConversation || isRenterInConversation || isParticipantInConversation) &&
    latestOffer?.status !== "pending";

  async function loadOfferHistory() {
    if (!id || !user) return;
    setOfferHistoryLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/offers/conversation/${id}`, {
        headers: {
          "X-User-Id": user.id,
        },
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: OfferModel[]; error?: string }
        | null;
      if (!res.ok || !json?.success || !Array.isArray(json.data)) {
        throw new Error(json?.error || "Failed to load offer history");
      }
      setOfferHistory(json.data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load offer history";
      toast(msg, "error");
    } finally {
      setOfferHistoryLoading(false);
    }
  }

  useEffect(() => {
    loadOfferHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

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

  async function handleCreateOffer(e: FormEvent) {
    e.preventDefault();
    if (!user || !id || !conversation) return;
    if (!offerStart || !offerDuration) return;

    const duration = Number(offerDuration);
    if (!Number.isFinite(duration) || duration <= 0) {
      alert("Duration must be a positive number.");
      return;
    }

    const renterParticipant = conversation.participants.find((p) => p.role === "renter");
    const renterId = renterParticipant?.user_id;

    if (!conversation.context_listing_id) {
      alert(
        "This conversation is not linked to a listing yet. You can only create offers from listing conversations.",
      );
      return;
    }
    if (offerMode === "create" && isLandlordInConversation && !renterId) {
      alert("Could not find a renter participant in this conversation.");
      return;
    }

    setOfferSubmitting(true);
    try {
      const endpoint =
        offerMode === "counter" && latestOffer?.id
          ? `${getApiUrl()}/api/offers/${latestOffer.id}/counter`
          : `${getApiUrl()}/api/offers`;
      const payload: Record<string, unknown> = {
        startDate: offerStart,
        duration,
      };
      if (offerRateAmount.trim()) {
        payload.rateAmount = Number(offerRateAmount);
      }
      if (offerRateType.trim()) {
        payload.rateType = offerRateType.trim();
      }
      if (offerNotes.trim()) {
        payload.notes = offerNotes.trim();
      }
      if (offerMode === "create") {
        payload.conversationId = id;
        payload.listingId = conversation.context_listing_id;
        if (isLandlordInConversation && renterId) {
          payload.renterId = renterId;
        }
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": user.id,
        },
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: any; error?: string }
        | null;

      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || "Failed to create offer");
      }

      setOfferStart("");
      setOfferDuration("");
      setOfferRateAmount("");
      setOfferRateType("");
      setOfferNotes("");
      setCreatingOffer(false);
      await refreshConversation();
      await loadOfferHistory();
      toast(offerMode === "counter" ? "Counter-offer sent." : "Offer created.", "success");
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

  async function handleOfferAction(action: "accept" | "reject" | "withdraw") {
    if (!user || !latestOffer?.id) return;
    setOfferActionLoading(action);
    try {
      const res = await fetch(`${getApiUrl()}/api/offers/${latestOffer.id}/${action}`, {
        method: "POST",
        headers: {
          "X-User-Id": user.id,
        },
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Failed to ${action} offer`);
      }
      await refreshConversation();
      await loadOfferHistory();
      toast(`Offer ${action}ed.`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to ${action} offer`;
      toast(msg, "error");
    } finally {
      setOfferActionLoading(null);
    }
  }

  function formatMoney(cents: number, currency: string | undefined) {
    return (cents / 100).toLocaleString(undefined, {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    });
  }

  function formatStatusLabel(status: string | undefined) {
    if (!status) return "Unknown";
    return status
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
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
              <div className="flex items-center gap-3">
                {conversation.context_type === "listing" && canCreateOffer && (
                  <button
                    type="button"
                    onClick={() => {
                      setOfferMode("create");
                      setCreatingOffer((prev) => !prev);
                    }}
                    className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {creatingOffer && offerMode === "create" ? "Close offer" : "Create Offer"}
                  </button>
                )}

                {conversation.context_listing_id && (
                  <Link
                    href={`/listings/${conversation.context_listing_id}`}
                    className="shrink-0 text-xs font-medium text-[var(--brand)] hover:underline"
                  >
                    View listing
                  </Link>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {latestOffer && (
                <div className="mb-3 flex justify-center">
                  <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-800 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Offer
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {latestOffer.rate_amount} {latestOffer.currency?.toUpperCase() ?? "USD"}/
                          {latestOffer.rate_type}
                        </p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                        {formatStatusLabel(latestOffer.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Start:{" "}
                      {latestOffer.start_date
                        ? new Date(latestOffer.start_date).toLocaleString()
                        : "—"}
                    </p>
                    <p className="text-xs text-slate-600">
                      Duration: {latestOffer.duration} {latestOffer.rate_type}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-900">
                      Total: {formatMoney(latestOffer.total_amount, latestOffer.currency)}
                    </p>
                    {latestOffer.notes && (
                      <p className="mt-1 text-xs text-slate-600">Note: {latestOffer.notes}</p>
                    )}
                    {latestOffer.status === "pending" && (
                      <div className="mt-2 flex gap-2">
                        {offerActionability?.canAccept && (
                          <button
                            type="button"
                            className="inline-flex flex-1 items-center justify-center rounded-md bg-[var(--brand)] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[var(--brand-dark)] disabled:opacity-60"
                            onClick={() => handleOfferAction("accept")}
                            disabled={offerActionLoading !== null}
                          >
                            {offerActionLoading === "accept" ? "Accepting..." : "Accept"}
                          </button>
                        )}
                        {offerActionability?.canReject && (
                          <button
                            type="button"
                            className="inline-flex flex-1 items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            onClick={() => handleOfferAction("reject")}
                            disabled={offerActionLoading !== null}
                          >
                            {offerActionLoading === "reject" ? "Rejecting..." : "Reject"}
                          </button>
                        )}
                        {offerActionability?.canWithdraw && (
                          <button
                            type="button"
                            className="inline-flex flex-1 items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            onClick={() => handleOfferAction("withdraw")}
                            disabled={offerActionLoading !== null}
                          >
                            {offerActionLoading === "withdraw" ? "Withdrawing..." : "Withdraw"}
                          </button>
                        )}
                      </div>
                    )}
                    {latestOffer.status === "pending" && offerActionability?.canCounter && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setOfferMode("counter");
                            setCreatingOffer(true);
                          }}
                          className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Counter Offer
                        </button>
                      </div>
                    )}
                    {offerActionability?.reasonIfDisabled && latestOffer.status !== "pending" && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {offerActionability.reasonIfDisabled}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-slate-700">Offer History</p>
                  <button
                    type="button"
                    onClick={loadOfferHistory}
                    className="text-[11px] text-[var(--brand)] hover:underline"
                  >
                    Refresh
                  </button>
                </div>
                {offerHistoryLoading ? (
                  <p className="text-[11px] text-slate-500">Loading offers...</p>
                ) : offerHistory.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No offers yet.</p>
                ) : (
                  <div className="space-y-1">
                    {offerHistory.slice(0, 5).map((offer) => (
                      <div
                        key={offer.id}
                        className="flex items-center justify-between rounded border border-slate-100 px-2 py-1 text-[11px]"
                      >
                        <span className="text-slate-700">
                          {formatMoney(offer.total_amount, offer.currency)} / {offer.rate_type} •{" "}
                          {offer.duration}
                        </span>
                        <span className="text-slate-500">{formatStatusLabel(offer.status)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
              {creatingOffer && conversation?.context_type === "listing" && (
                <form
                  onSubmit={handleCreateOffer}
                  className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 space-y-2"
                >
                  <p className="text-xs font-semibold text-slate-800">
                    {offerMode === "counter"
                      ? "Counter the current pending offer."
                      : "Create an offer for this listing conversation."}
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
                      Duration ({durationUnitLabel})
                      <input
                        type="number"
                        min={1}
                        value={offerDuration}
                        onChange={(e) => setOfferDuration(e.target.value)}
                        placeholder={
                          durationUnitLabel === "units"
                            ? "e.g. 3"
                            : `e.g. 3 ${durationUnitLabel}`
                        }
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)]"
                        required
                      />
                      <p className="mt-1 text-[10px] font-normal text-slate-500">
                        Enter how many {durationUnitLabel} this offer should cover.
                      </p>
                    </label>
                    <label className="text-[11px] font-medium text-slate-700">
                      Rate amount (optional override)
                      <input
                        type="number"
                        min={1}
                        step="0.01"
                        value={offerRateAmount}
                        onChange={(e) => setOfferRateAmount(e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)]"
                      />
                    </label>
                    <label className="text-[11px] font-medium text-slate-700">
                      Rate type (optional override)
                      <select
                        value={offerRateType}
                        onChange={(e) => setOfferRateType(e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)]"
                      >
                        <option value="">Use listing rate type</option>
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                      <p className="mt-1 text-[10px] font-normal text-slate-500">
                        Rate type controls how duration is interpreted.
                      </p>
                    </label>
                  </div>
                  <label className="block text-[11px] font-medium text-slate-700">
                    Note (optional)
                    <textarea
                      value={offerNotes}
                      onChange={(e) => setOfferNotes(e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)]"
                    />
                  </label>
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
                      {offerSubmitting
                        ? "Sending..."
                        : offerMode === "counter"
                          ? "Send Counter"
                          : "Send Offer"}
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

