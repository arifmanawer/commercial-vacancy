"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DashboardProfile from "@/components/DashboardProfile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type BookingStatus =
  | "pending_payment"
  | "reserved"
  | "active"
  | "completed"
  | "cancelled"
  | "refund_pending"
  | "refund_completed"
  | "payment_failed";

type BookingRow = {
  id: string;
  listing_id: string;
  landlord_id: string;
  renter_id: string;
  start_datetime: string;
  end_datetime: string;
  status: BookingStatus;
  currency: string;
  total_amount: number;
  created_at: string;
};

type ListingRow = {
  id: string;
  title: string;
  city: string | null;
  state: string | null;
  property_type: string | null;
};

type ImageRow = {
  property_id: string;
  image_url: string[] | null;
};

type BookingView = BookingRow & {
  listing?: ListingRow | null;
  image?: string | null;
};

function statusPill(status: BookingStatus) {
  switch (status) {
    case "reserved":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "active":
      return "bg-slate-900 text-white border-slate-900";
    case "pending_payment":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "completed":
      return "bg-slate-50 text-slate-700 border-slate-200";
    case "cancelled":
      return "bg-red-50 text-red-700 border-red-100";
    case "refund_pending":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "refund_completed":
      return "bg-slate-50 text-slate-700 border-slate-200";
    case "payment_failed":
      return "bg-red-50 text-red-700 border-red-100";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function labelForStatus(status: BookingStatus) {
  switch (status) {
    case "pending_payment":
      return "Pending payment";
    case "reserved":
      return "Reserved";
    case "active":
      return "Active";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "refund_pending":
      return "Refund pending";
    case "refund_completed":
      return "Refund completed";
    case "payment_failed":
      return "Payment failed";
    default:
      return status;
  }
}

export default function RenterReservationsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [bookings, setBookings] = useState<BookingView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setBookings([]);

      if (!userId) {
        setLoading(false);
        return;
      }

      const { data: bookingRows, error: bookingError } = await supabase
        .from("bookings")
        .select(
          "id, listing_id, landlord_id, renter_id, start_datetime, end_datetime, status, currency, total_amount, created_at",
        )
        .eq("renter_id", userId)
        .order("start_datetime", { ascending: true });

      if (cancelled) return;

      if (bookingError) {
        setError(
          bookingError.message || "Could not load your reservations right now.",
        );
        setLoading(false);
        return;
      }

      const rows = (bookingRows ?? []) as BookingRow[];
      const listingIds = Array.from(
        new Set(rows.map((b) => b.listing_id).filter(Boolean)),
      );

      if (listingIds.length === 0) {
        setBookings([]);
        setLoading(false);
        return;
      }

      const { data: listingRows } = await supabase
        .from("listings")
        .select("id, title, city, state, property_type")
        .in("id", listingIds);

      const { data: imgRows } = await supabase
        .from("listings_images")
        .select("property_id, image_url")
        .in("property_id", listingIds);

      if (cancelled) return;

      const listingMap = new Map<string, ListingRow>();
      (listingRows ?? []).forEach((l: any) => listingMap.set(l.id, l));

      const imageMap = new Map<string, ImageRow>();
      (imgRows ?? []).forEach((r: any) => imageMap.set(r.property_id, r));

      setBookings(
        rows.map((b) => {
          const listing = listingMap.get(b.listing_id) ?? null;
          const image = imageMap.get(b.listing_id)?.image_url?.[0] ?? null;
          return { ...b, listing, image };
        }),
      );
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const now = Date.now();
  const { upcoming, past } = useMemo(() => {
    const upcoming: BookingView[] = [];
    const past: BookingView[] = [];
    bookings.forEach((b) => {
      const end = new Date(b.end_datetime).getTime();
      if (Number.isFinite(end) && end >= now) upcoming.push(b);
      else past.push(b);
    });
    return { upcoming, past };
  }, [bookings, now]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
        <Navbar />
      </header>

      <main className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        <DashboardProfile />

        <section className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Your reservations
            </h1>
            <p className="text-slate-600 max-w-2xl">
              Track your reservation timeline and see when a space becomes{" "}
              <span className="font-semibold">Reserved</span> after payment is
              confirmed.
            </p>
          </div>
          <Link
            href="/dashboard/renter"
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Back to dashboard
          </Link>
        </section>

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Loading reservations…
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {error}
          </div>
        ) : bookings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-600">
              You don&apos;t have any reservations yet.
            </p>
            <Link
              href="/browse"
              className="mt-3 inline-flex items-center text-sm font-medium text-[var(--brand)] hover:underline"
            >
              Browse spaces
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Upcoming</h2>
                <span className="text-xs text-slate-500">
                  {upcoming.length} total
                </span>
              </div>
              {upcoming.length === 0 ? (
                <div className="text-sm text-slate-600">
                  No upcoming reservations.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {upcoming.map((b) => (
                    <li key={b.id} className="py-4 flex gap-4">
                      <div className="h-16 w-24 rounded-md overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-xs text-slate-400">
                        {b.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={b.image}
                            alt={b.listing?.title ?? "Listing"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          "No image"
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {b.listing?.title ?? "Listing"}
                            </p>
                            <p className="text-xs text-slate-600">
                              {[b.listing?.city, b.listing?.state]
                                .filter(Boolean)
                                .join(", ")}{" "}
                              {b.listing?.property_type
                                ? `· ${b.listing.property_type}`
                                : ""}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusPill(b.status)}`}
                          >
                            {labelForStatus(b.status)}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-slate-600 flex flex-wrap gap-3">
                          <span>
                            Start:{" "}
                            <span className="font-medium text-slate-900">
                              {new Date(b.start_datetime).toLocaleString()}
                            </span>
                          </span>
                          <span>
                            End:{" "}
                            <span className="font-medium text-slate-900">
                              {new Date(b.end_datetime).toLocaleString()}
                            </span>
                          </span>
                        </div>
                        <div className="mt-2">
                          <Link
                            href={`/listings/${b.listing_id}`}
                            className="text-xs font-medium text-[var(--brand)] hover:underline"
                          >
                            View listing
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Past</h2>
                <span className="text-xs text-slate-500">{past.length} total</span>
              </div>
              {past.length === 0 ? (
                <div className="text-sm text-slate-600">No past reservations.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {past.map((b) => (
                    <li key={b.id} className="py-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {b.listing?.title ?? "Listing"}
                        </p>
                        <p className="text-xs text-slate-600">
                          {new Date(b.start_datetime).toLocaleString()} →{" "}
                          {new Date(b.end_datetime).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusPill(b.status)}`}
                      >
                        {labelForStatus(b.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

