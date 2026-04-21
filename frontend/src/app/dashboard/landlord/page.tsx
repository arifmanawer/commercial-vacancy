"use client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DashboardProfile from "@/components/DashboardProfile";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type BookingStatus = "pending_payment" | "reserved" | "active";

export default function LandlordDashboardPage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loadingInquiries, setLoadingInquiries] = useState(false);
  const [inquiriesError, setInquiriesError] = useState<string | null>(null);
  const [editingInquiryId, setEditingInquiryId] = useState<string | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState<string>("");
  const [rescheduleNote, setRescheduleNote] = useState<string>("");
  const [editMode, setEditMode] = useState<"reschedule" | "decline" | null>(
    null,
  );
  const [updatingInquiryId, setUpdatingInquiryId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [contractorJobs, setContractorJobs] = useState<any[]>([]);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [upcomingReservationsCount, setUpcomingReservationsCount] = useState(0);
  const [loadingReservationsCount, setLoadingReservationsCount] = useState(false);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);
      setInquiries([]);
      setInquiriesError(null);

      const userId = user?.id;
      if (!userId) {
        setListings([]);
        setLoading(false);
        return;
      }

      const { data: listingRows, error: listingError } = await supabase
        .from("listings")
        .select("id, title, city, state, property_type, status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (listingError) {
        setError(listingError.message);
        setListings([]);
        setLoading(false);
        return;
      }

      const safeListings = listingRows || [];
      setListings(safeListings);
      setLoading(false);

      const ids = safeListings.map((l: any) => l.id);
      if (!ids.length) return;

      setLoadingInquiries(true);
      const { data: inquiryRows, error: inquiryError } = await supabase
        .from("listing_inquiries")
        .select(
          "id, listing_id, type, message, preferred_time, status, landlord_message, landlord_suggested_time, created_at, resolved_at",
        )
        .in("listing_id", ids)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (inquiryError) {
        setInquiriesError(
          inquiryError.message ||
            "Could not load interest or tour requests.",
        );
        setInquiries([]);
      } else {
        setInquiries(inquiryRows || []);
      }
      setLoadingInquiries(false);

      setLoadingJobs(true);
      setJobsError(null);
      const { data: jobsRows, error: jobsErr } = await supabase
        .from("contractor_jobs")
        .select(
          "id, listing_id, title, status, budget, preferred_date, created_at",
        )
        .eq("landlord_id", userId)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (jobsErr) {
        setJobsError(
          jobsErr.message || "Could not load contractor jobs.",
        );
        setContractorJobs([]);
      } else {
        setContractorJobs(jobsRows || []);
      }
      setLoadingJobs(false);
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function loadReservationsCount() {
      setLoadingReservationsCount(true);

      const userId = user?.id;
      if (!userId) {
        setUpcomingReservationsCount(0);
        setLoadingReservationsCount(false);
        return;
      }

      const activeStatuses: BookingStatus[] = [
        "pending_payment",
        "reserved",
        "active",
      ];

      const { data, error } = await supabase
        .from("bookings")
        .select("id, end_datetime, status")
        .eq("landlord_id", userId)
        .in("status", activeStatuses);

      if (cancelled) return;

      if (error) {
        setUpcomingReservationsCount(0);
        setLoadingReservationsCount(false);
        return;
      }

      const now = Date.now();
      const count = (data ?? []).filter((b: any) => {
        const end = new Date(b.end_datetime).getTime();
        return Number.isFinite(end) && end >= now;
      }).length;

      setUpcomingReservationsCount(count);
      setLoadingReservationsCount(false);
    }

    loadReservationsCount();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleDelete = async (id: string) => {
    const listing = listings.find((l: any) => l.id === id);
    if (!listing) {
      setError("Listing not found.");
      return;
    }
    if (listing.status !== "Available") {
      setError("Only listings with status 'Available' can be deleted.");
      return;
    }
    if (!confirm("Are you sure you want to delete this listing?")) return;
    setError(null);
    setDeletingId(id);
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) {
      setError(error.message);
    } else {
      setListings((prev) => prev.filter((l: any) => l.id !== id));
    }
    setDeletingId(null);
  };

  const updateInquiry = async (
    id: string,
    updates: Record<string, unknown>,
  ) => {
    setUpdatingInquiryId(id);
    const { error } = await supabase
      .from("listing_inquiries")
      .update(updates)
      .eq("id", id);
    if (error) {
      setInquiriesError(
        error.message || "Could not update this request. Please try again.",
      );
      setUpdatingInquiryId(null);
      return;
    }
    setInquiriesError(null);
    setInquiries((prev) =>
      prev.map((inq) => (inq.id === id ? { ...inq, ...updates } : inq)),
    );
    setUpdatingInquiryId(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
        <Navbar />
      </header>

      <main className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        <DashboardProfile />

        <section className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Landlord Dashboard
          </h1>
          <p className="text-slate-600 max-w-2xl">
            Monitor your active listings, review booking requests, and keep
            track of payouts for your spaces.
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
              High-level view of your hosting activity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Active listings
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {loading ? (
                  <span className="inline-block h-7 w-8 rounded bg-slate-100 animate-pulse" />
                ) : (
                  listings.filter((l: any) => l.status === "Available").length
                )}
              </p>
              <p className="text-xs text-slate-500">
                Publish a space to start receiving booking requests.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Pending requests
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {loading || loadingInquiries ? (
                  <span className="inline-block h-7 w-8 rounded bg-slate-100 animate-pulse" />
                ) : (
                  inquiries.filter((inq: any) => inq.status === "pending").length
                )}
              </p>
              <p className="text-xs text-slate-500">
                New booking requests from renters will show up here.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Reservations
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {loadingReservationsCount ? (
                  <span className="inline-block h-7 w-8 rounded bg-slate-100 animate-pulse" />
                ) : (
                  upcomingReservationsCount
                )}
              </p>
              <p className="text-xs text-slate-500">
                Upcoming bookings across your listings.
              </p>
              <Link
                href="/dashboard/landlord/reservations"
                className="mt-1 inline-flex items-center text-xs font-medium text-[var(--brand)] hover:underline"
              >
                Manage reservations
              </Link>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="tools-heading"
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2
                id="tools-heading"
                className="text-lg font-semibold text-slate-900"
              >
                Tools
              </h2>
              <p className="text-sm text-slate-600">
                Shortcuts to manage your spaces and work with contractors.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/landlord/contractors"
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                C
              </span>
              <span>Find Contractors</span>
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section
            aria-labelledby="listings-heading"
            className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2
                  id="listings-heading"
                  className="text-lg font-semibold text-slate-900"
                >
                  Your listings
                </h2>
                <p className="text-sm text-slate-600">
                  Manage the spaces you&apos;ve made available for rent.
                </p>
              </div>
              <Link
                href="/list"
                className="hidden sm:inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                Add new listing
              </Link>
            </div>

            {loading ? (
              <div className="text-center text-slate-500 py-6">Loading…</div>
            ) : error ? (
              <div className="text-center text-red-500 py-6">{error}</div>
            ) : listings.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                You don&apos;t have any listings yet. Click &quot;Add new listing&quot; to publish your first space.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {listings.map((listing) => (
                  <li
                    key={listing.id}
                    className="py-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {listing.title}
                      </div>
                      <div className="text-xs text-slate-500">
                        {listing.city}, {listing.state} &middot;{" "}
                        {listing.property_type}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {listing.status === "Available" && (
                        <Link
                          href={`/dashboard/landlord/listings/${listing.id}/edit`}
                          className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </Link>
                      )}
                      <button
                        onClick={() => handleDelete(listing.id)}
                        className="px-3 py-1.5 rounded-md border border-red-200 bg-red-50 text-xs text-red-700 hover:bg-red-100 disabled:opacity-60"
                        disabled={listing.status !== "Available" || deletingId === listing.id}
                        title={
                          listing.status !== "Available"
                            ? "Only available listings can be deleted"
                            : "Delete"
                        }
                      >
                        {deletingId === listing.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="requests-heading"
            className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2
                  id="requests-heading"
                  className="text-lg font-semibold text-slate-900"
                >
                  Booking requests
                </h2>
                <p className="text-sm text-slate-600">
                  Review contact and tour requests from interested renters.
                </p>
              </div>
            </div>

            {loadingInquiries ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Loading requests…
              </div>
            ) : inquiriesError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
                {inquiriesError}
              </div>
            ) : inquiries.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                There are no contact or tour requests yet. When renters express
                interest in your spaces, you&apos;ll be able to review them
                here.
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
                            {inq.type === "tour"
                              ? "Tour request"
                              : "Contact request"}
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
                          Preferred time:{" "}
                          {new Date(inq.preferred_time).toLocaleString()}
                        </p>
                      )}
                      {inq.message && (
                        <p className="text-xs text-slate-700">
                          “{inq.message}”
                        </p>
                      )}
                      {inq.landlord_message && (
                        <p className="text-xs text-slate-600">
                          Your note: “{inq.landlord_message}”
                        </p>
                      )}
                      {inq.landlord_suggested_time && (
                        <p className="text-xs text-slate-600">
                          Suggested time:{" "}
                          {new Date(
                            inq.landlord_suggested_time,
                          ).toLocaleString()}
                        </p>
                      )}
                      {inq.status === "pending" && (
                        <>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={updatingInquiryId === inq.id}
                              className="inline-flex items-center rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                              onClick={() =>
                                updateInquiry(inq.id, {
                                  status: "accepted",
                                  resolved_at: new Date().toISOString(),
                                })
                              }
                            >
                              {updatingInquiryId === inq.id ? "Updating…" : "Accept"}
                            </button>
                            <button
                              type="button"
                              disabled={updatingInquiryId === inq.id}
                              className="inline-flex items-center rounded-md bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 border border-red-100 hover:bg-red-100 disabled:opacity-60"
                              onClick={() => {
                                setEditingInquiryId(inq.id);
                                setEditMode("decline");
                                setRescheduleNote("");
                                setRescheduleTime("");
                              }}
                            >
                              Decline
                            </button>
                            <button
                              type="button"
                              disabled={updatingInquiryId === inq.id}
                              className="inline-flex items-center rounded-md bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-60"
                              onClick={() => {
                                setEditingInquiryId(inq.id);
                                setEditMode("reschedule");
                                setRescheduleTime(
                                  inq.preferred_time || rescheduleTime,
                                );
                                setRescheduleNote(inq.landlord_message || "");
                              }}
                            >
                              Propose new time
                            </button>
                          </div>
                          {editingInquiryId === inq.id && editMode && (
                            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 space-y-2">
                              {editMode === "reschedule" ? (
                                <>
                                  <label className="block text-xs font-medium text-slate-600">
                                    New date &amp; time
                                    <input
                                      type="datetime-local"
                                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white"
                                      value={rescheduleTime}
                                      onChange={(e) =>
                                        setRescheduleTime(e.target.value)
                                      }
                                    />
                                  </label>
                                  <label className="block text-xs font-medium text-slate-600">
                                    Note to renter (optional)
                                    <textarea
                                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white"
                                      rows={2}
                                      value={rescheduleNote}
                                      onChange={(e) =>
                                        setRescheduleNote(e.target.value)
                                      }
                                      placeholder="Add any context or instructions…"
                                    />
                                  </label>
                                  <div className="flex justify-end gap-2 pt-1">
                                    <button
                                      type="button"
                                      className="inline-flex items-center rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                                      onClick={() => {
                                        setEditingInquiryId(null);
                                        setEditMode(null);
                                        setRescheduleTime("");
                                        setRescheduleNote("");
                                      }}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      className="inline-flex items-center rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                                      disabled={!rescheduleTime || updatingInquiryId === inq.id}
                                      onClick={async () => {
                                        if (!rescheduleTime) return;
                                        await updateInquiry(inq.id, {
                                          status: "reschedule_proposed",
                                          landlord_suggested_time:
                                            rescheduleTime,
                                          landlord_message:
                                            rescheduleNote.trim() || null,
                                        });
                                        setEditingInquiryId(null);
                                        setEditMode(null);
                                        setRescheduleTime("");
                                        setRescheduleNote("");
                                      }}
                                    >
                                      {updatingInquiryId === inq.id ? "Sending…" : "Send proposal"}
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <label className="block text-xs font-medium text-slate-600">
                                    Reason for declining (optional)
                                    <textarea
                                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white"
                                      rows={2}
                                      value={rescheduleNote}
                                      onChange={(e) =>
                                        setRescheduleNote(e.target.value)
                                      }
                                      placeholder="Briefly explain why you’re declining, if you’d like."
                                    />
                                  </label>
                                  <div className="flex justify-end gap-2 pt-1">
                                    <button
                                      type="button"
                                      className="inline-flex items-center rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                                      onClick={() => {
                                        setEditingInquiryId(null);
                                        setEditMode(null);
                                        setRescheduleTime("");
                                        setRescheduleNote("");
                                      }}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      className="inline-flex items-center rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-60"
                                      disabled={updatingInquiryId === inq.id}
                                      onClick={async () => {
                                        await updateInquiry(inq.id, {
                                          status: "declined",
                                          landlord_message:
                                            rescheduleNote.trim() || null,
                                          resolved_at:
                                            new Date().toISOString(),
                                        });
                                        setEditingInquiryId(null);
                                        setEditMode(null);
                                        setRescheduleTime("");
                                        setRescheduleNote("");
                                      }}
                                    >
                                      {updatingInquiryId === inq.id ? "Declining…" : "Confirm decline"}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </section>

        <section
          aria-labelledby="contractor-jobs-heading"
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2
                id="contractor-jobs-heading"
                className="text-lg font-semibold text-slate-900"
              >
                Contractor jobs
              </h2>
              <p className="text-sm text-slate-600">
                See the status of work you&apos;ve requested from contractors.
              </p>
            </div>
          </div>

          {loadingJobs ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Loading contractor jobs…
            </div>
          ) : jobsError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
              {jobsError}
            </div>
          ) : contractorJobs.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              You haven&apos;t requested any contractor jobs yet. When you send
              job requests from the Contractors page, you&apos;ll see them
              listed here.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {contractorJobs.map((job) => {
                const listing = listings.find(
                  (l) => l.id === job.listing_id,
                );
                const status =
                  job.status === "accepted"
                    ? "Accepted"
                    : job.status === "declined"
                    ? "Declined"
                    : job.status === "completed"
                    ? "Completed"
                    : "Requested";
                const statusClasses =
                  job.status === "accepted"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : job.status === "declined"
                    ? "bg-red-50 text-red-700 border-red-100"
                    : job.status === "completed"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-slate-50 text-slate-700 border-slate-200";
                return (
                  <li key={job.id} className="py-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900">
                          {job.title}
                        </span>
                        <span className="text-xs text-slate-600">
                          {listing?.title
                            ? `${listing.title} — ${listing.city}, ${listing.state}`
                            : "Listing"}
                        </span>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                          {job.budget != null && (
                            <span>Budget: ${job.budget.toFixed(0)}</span>
                          )}
                          {job.preferred_date && (
                            <span>
                              Preferred:{" "}
                              {new Date(job.preferred_date).toLocaleString()}
                            </span>
                          )}
                          <span>
                            Created:{" "}
                            {new Date(job.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClasses}`}
                      >
                        {status}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
