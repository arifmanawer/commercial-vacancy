"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DashboardProfile from "@/components/DashboardProfile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type SavedListing = {
  id: string;
  title: string;
  city?: string | null;
  state?: string | null;
  property_type?: string | null;
  price?: number | null;
  rental_type?: string | null;
  image?: string | null;
};

export default function RenterDashboardPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [savedListings, setSavedListings] = useState<SavedListing[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loadingInquiries, setLoadingInquiries] = useState(false);
  const [inquiriesError, setInquiriesError] = useState<string | null>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSaved() {
      setError(null);

      if (!userId) {
        setSavedListings([]);
        return;
      }

      setLoadingSaved(true);
      try {
        const { data, error: savedError } = await supabase
          .from("saved_listings")
          .select("property_id")
          .eq("user_id", userId);

        if (savedError) {
          if (!cancelled) {
            setError(savedError.message ?? "Unable to load saved spaces.");
          }
          return;
        }

        const propertyIds =
          data?.map((r: any) => r.property_id).filter(Boolean) ?? [];

        if (propertyIds.length === 0) {
          if (!cancelled) setSavedListings([]);
          return;
        }

        const { data: listingRows, error: listingsError } = await supabase
          .from("listings")
          .select("id, title, city, state, property_type")
          .in("id", propertyIds);

        if (listingsError) {
          if (!cancelled) {
            setError(listingsError.message ?? "Unable to load saved spaces.");
          }
          return;
        }

        const { data: priceRows } = await supabase
          .from("property_pricing")
          .select("property_id, price, rental_type")
          .in("property_id", propertyIds);

        const { data: imgRows } = await supabase
          .from("listings_images")
          .select("property_id, image_url")
          .in("property_id", propertyIds);

        const priceMap = new Map<string, any>();
        (priceRows ?? []).forEach((p: any) => priceMap.set(p.property_id, p));
        const imgMap = new Map<string, any>();
        (imgRows ?? []).forEach((r: any) => imgMap.set(r.property_id, r));

        const view: SavedListing[] =
          listingRows?.map((r: any) => {
            const pricing = priceMap.get(r.id);
            return {
              id: r.id,
              title: r.title,
              city: r.city,
              state: r.state,
              property_type: r.property_type,
              price: pricing ? pricing.price : null,
              rental_type: pricing ? pricing.rental_type : null,
              image: imgMap.get(r.id)?.image_url?.[0] ?? null,
            };
          }) ?? [];

        if (!cancelled) setSavedListings(view);
      } catch (_err) {
        if (!cancelled) setError("Unable to load saved spaces.");
      } finally {
        if (!cancelled) setLoadingSaved(false);
      }
    }

    loadSaved();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setInquiries([]);
      setListings([]);
      return;
    }

    let cancelled = false;

    async function loadInquiries() {
      setInquiriesError(null);
      setLoadingInquiries(true);

      const { data: inquiryRows, error: inquiryError } = await supabase
        .from("listing_inquiries")
        .select(
          "id, listing_id, type, message, preferred_time, status, landlord_message, landlord_suggested_time, created_at, resolved_at",
        )
        .eq("renter_id", userId)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (inquiryError) {
        setInquiriesError(
          inquiryError.message ||
            "Could not load your interest or tour requests.",
        );
        setInquiries([]);
        setListings([]);
        setLoadingInquiries(false);
        return;
      }

      const safeInquiries = inquiryRows || [];
      setInquiries(safeInquiries);

      const listingIds = Array.from(
        new Set(safeInquiries.map((inq: any) => inq.listing_id).filter(Boolean)),
      );

      if (!listingIds.length) {
        setListings([]);
        setLoadingInquiries(false);
        return;
      }

      const { data: listingRows, error: listingError } = await supabase
        .from("listings")
        .select("id, title, city, state, property_type")
        .in("id", listingIds);

      if (cancelled) return;

      if (listingError) {
        setInquiriesError(
          listingError.message ||
            "Could not load listings for your requests.",
        );
        setListings([]);
      } else {
        setListings(listingRows || []);
      }

      setLoadingInquiries(false);
    }

    loadInquiries();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const updateInquiry = async (
    id: string,
    updates: Record<string, unknown>,
  ) => {
    setUpdatingId(id);
    const { error: updateError } = await supabase
      .from("listing_inquiries")
      .update(updates)
      .eq("id", id);

    if (updateError) {
      setInquiriesError(
        updateError.message ||
          "Could not update this request. Please try again.",
      );
    } else {
      setInquiriesError(null);
      setInquiries((prev) =>
        prev.map((inq) => (inq.id === id ? { ...inq, ...updates } : inq)),
      );
    }

    setUpdatingId(null);
  };

  const savedCount = useMemo(() => savedListings.length, [savedListings]);

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
              <p className="text-2xl font-bold text-slate-900">
                {loadingSaved ? "…" : savedCount}
              </p>
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
            {error && (
              <div className="text-sm text-red-600 border border-red-100 bg-red-50 px-3 py-2 rounded">
                {error}
              </div>
            )}

            {loadingSaved ? (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Loading your saved spaces…
              </div>
            ) : savedListings.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                You haven&apos;t saved any spaces yet. Browse listings and tap
                &quot;Save&quot; to add them here.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {savedListings.map((listing) => (
                  <article
                    key={listing.id}
                    className="flex flex-col border border-slate-200/80 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="h-24 rounded-md overflow-hidden mb-3 flex items-center justify-center text-xs text-slate-400">
                      {listing.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={listing.image}
                          alt={listing.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-50 border border-slate-100 flex items-center justify-center text-xs text-slate-400">
                          No image
                        </div>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 line-clamp-1">
                      {listing.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      {listing.city ?? ""}{" "}
                      {listing.state ? `, ${listing.state}` : ""} ·{" "}
                      {listing.property_type ?? ""}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {listing.price != null && listing.rental_type
                        ? `${listing.price}/${listing.rental_type}`
                        : ""}
                    </p>
                    <div className="mt-3">
                      <Link
                        href={`/listings/${listing.id}`}
                        className="inline-flex items-center text-xs text-[var(--brand)] hover:underline"
                      >
                        View details
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
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
