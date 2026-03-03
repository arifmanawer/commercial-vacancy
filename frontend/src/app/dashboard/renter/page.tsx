/* eslint-disable react-hooks/rules-of-hooks */
"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DashboardProfile from "@/components/DashboardProfile";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function RenterDashboardPage() {
  const { user } = useAuth();
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loadingInquiries, setLoadingInquiries] = useState(false);
  const [inquiriesError, setInquiriesError] = useState<string | null>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const updateInquiry = async (id: string, updates: Record<string, unknown>) => {
    setUpdatingId(id);
    setInquiriesError(null);
    try {
      const { error } = await supabase
        .from("listing_inquiries")
        .update(updates)
        .eq("id", id);
      if (error) {
        setInquiriesError(
          error.message || "Could not update this request. Please try again.",
        );
        return;
      }
      setInquiries((prev) =>
        prev.map((inq) => (inq.id === id ? { ...inq, ...updates } : inq)),
      );
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      setLoadingInquiries(true);
      setInquiriesError(null);
      const { data: inqRows, error } = await supabase
        .from("listing_inquiries")
        .select(
          "id, listing_id, type, status, message, preferred_time, landlord_message, landlord_suggested_time, created_at, resolved_at",
        )
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setInquiriesError(
          error.message ||
            "Could not load your interest and tour requests.",
        );
        setInquiries([]);
        setLoadingInquiries(false);
        return;
      }

      const safeInquiries = inqRows || [];
      setInquiries(safeInquiries);

      const ids = safeInquiries.map((i: any) => i.listing_id);
      if (!ids.length) {
        setListings([]);
        setLoadingInquiries(false);
        return;
      }

      const { data: listingRows } = await supabase
        .from("listings")
        .select("id, title, city, state, property_type")
        .in("id", ids);

      if (!cancelled) {
        setListings(listingRows || []);
        setLoadingInquiries(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
        <Navbar />
      </header>

      <main className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        <DashboardProfile />

        <section className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Renter Dashboard
          </h1>
          <p className="text-slate-600 max-w-2xl">
            Track your upcoming bookings, manage saved spaces, and stay on top
            of messages from hosts.
          </p>
        </section>

        <section aria-labelledby="overview-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="overview-heading"
              className="text-lg font-semibold text-slate-900"
            >
              Overview
            </h2>
            <p className="text-xs text-slate-500">
              Summary of your current rental activity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Upcoming booking
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {inquiries.filter((i) => i.status === "accepted").length > 0
                  ? `${inquiries.filter((i) => i.status === "accepted").length} accepted request(s)`
                  : "No confirmed bookings"}
              </p>
              <p className="text-xs text-slate-500">
                Once you book a space, it will appear here.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Saved spaces
              </p>
              <p className="text-2xl font-bold text-slate-900">0</p>
              <p className="text-xs text-slate-500">
                Save spaces from Browse to compare and revisit later.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Messages
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {inquiries.length}
              </p>
              <p className="text-xs text-slate-500">
                Conversations with hosts will show up here.
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="bookings-heading"
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2
                id="bookings-heading"
                className="text-lg font-semibold text-slate-900"
              >
                Requests & bookings
              </h2>
              <p className="text-sm text-slate-600">
                View the status of your contact and tour requests.
              </p>
            </div>
            <button
              type="button"
              className="hidden sm:inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              View all
            </button>
          </div>

          {loadingInquiries ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Loading your requests…
            </div>
          ) : inquiriesError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
              {inquiriesError}
            </div>
          ) : inquiries.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              You haven&apos;t contacted any landlords yet. When you send
              interest or tour requests from a listing, they will appear here.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {inquiries.map((inq) => {
                const listing = listings.find(
                  (l) => l.id === inq.listing_id,
                );
                const statusLabel =
                  inq.status === "accepted"
                    ? "Accepted"
                    : inq.status === "declined"
                    ? "Declined"
                    : inq.status === "reschedule_proposed"
                    ? "Reschedule proposed"
                    : "Pending";
                const statusColorClasses =
                  inq.status === "accepted"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : inq.status === "declined"
                    ? "bg-red-50 text-red-700 border-red-100"
                    : inq.status === "reschedule_proposed"
                    ? "bg-amber-50 text-amber-700 border-amber-100"
                    : "bg-slate-50 text-slate-700 border-slate-200";
                return (
                  <li key={inq.id} className="py-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {inq.type === "tour" ? "Tour request" : "Contact"}
                        </span>
                        <span className="text-sm font-medium text-slate-900">
                          {listing?.title ?? "Listing"}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-slate-500">
                          {new Date(inq.created_at).toLocaleString()}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusColorClasses}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                    {inq.preferred_time && (
                      <p className="text-xs text-slate-600">
                        Your preferred time:{" "}
                        {new Date(inq.preferred_time).toLocaleString()}
                      </p>
                    )}
                    {inq.message && (
                      <p className="text-xs text-slate-700">
                        You said: “{inq.message}”
                      </p>
                    )}
                    {inq.landlord_suggested_time && (
                      <p className="text-xs text-slate-600">
                        Host&apos;s suggested time:{" "}
                        {new Date(
                          inq.landlord_suggested_time,
                        ).toLocaleString()}
                      </p>
                    )}
                    {inq.landlord_message && (
                      <p className="text-xs text-slate-600">
                        Host note: “{inq.landlord_message}”
                      </p>
                    )}
                    {inq.status === "reschedule_proposed" && inq.landlord_suggested_time && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                          disabled={updatingId === inq.id}
                          onClick={() =>
                            updateInquiry(inq.id, {
                              status: "accepted",
                              preferred_time: inq.landlord_suggested_time,
                              resolved_at: new Date().toISOString(),
                            })
                          }
                        >
                          {updatingId === inq.id
                            ? "Accepting..."
                            : "Accept proposed time"}
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center rounded-md bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-60"
                          disabled={updatingId === inq.id}
                          onClick={() =>
                            updateInquiry(inq.id, {
                              status: "declined",
                              resolved_at: new Date().toISOString(),
                            })
                          }
                        >
                          {updatingId === inq.id ? "Updating..." : "Decline"}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section
            aria-labelledby="saved-heading"
            className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2
                  id="saved-heading"
                  className="text-lg font-semibold text-slate-900"
                >
                  Saved spaces
                </h2>
                <p className="text-sm text-slate-600">
                  Quickly jump back to spaces you&apos;ve favorited.
                </p>
              </div>
            </div>

            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              You haven&apos;t saved any spaces yet. Browse listings and tap
              &quot;Save&quot; to add them here.
            </div>
          </section>

          <section
            aria-labelledby="messages-heading"
            className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2
                  id="messages-heading"
                  className="text-lg font-semibold text-slate-900"
                >
                  Messages
                </h2>
                <p className="text-sm text-slate-600">
                  Stay in touch with hosts and keep all your conversations in
                  one place.
                </p>
              </div>
            </div>

            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              No messages yet. When you send inquiries to hosts, your
              conversations will show up here.
            </div>
          </section>
        </section>
      </main>

      <Footer />
    </div>
  );
}
