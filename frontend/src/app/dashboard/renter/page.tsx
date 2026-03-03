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
                No confirmed bookings
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
              <p className="text-2xl font-bold text-slate-900">0</p>
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
                Upcoming bookings
              </h2>
              <p className="text-sm text-slate-600">
                View and manage your reservations.
              </p>
            </div>
            <button
              type="button"
              className="hidden sm:inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              View all
            </button>
          </div>

          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            You don&apos;t have any upcoming bookings yet. When you reserve a
            space, the details will appear here.
          </div>
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
