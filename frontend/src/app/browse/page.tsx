"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type ListingView = {
  id: string;
  title: string;
  city?: string;
  property_type?: string;
  price?: string;
  image?: string | null;
};

export default function BrowsePage() {
  const { user } = useAuth();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<ListingView[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);

  const handleSave = async (listingId: string) => {
    setError(null);

    if (!user) {
      setError("Please sign in to save spaces.");
      return;
    }

    // Avoid duplicate insert calls if already saved in this session
    if (savedIds.has(listingId)) {
      return;
    }

    setSavingId(listingId);
    try {
      const { error: insertError } = await supabase
        .from("saved_listings")
        .insert({
          user_id: user.id,
          listing_id: listingId,
        });

      if (insertError) {
        setError(insertError.message ?? "Unable to save this space.");
        return;
      }

      setSavedIds((prev) => {
        const next = new Set(prev);
        next.add(listingId);
        return next;
      });
    } catch (_err) {
      setError("Something went wrong while saving. Please try again.");
    } finally {
      setSavingId(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function loadListings() {
      setLoadingListings(true);
      try {
        const { data: listingRows } = await supabase
          .from("listings")
          .select("id, title, city, property_type")
          .order("created_at", { ascending: false });

        if (!listingRows || listingRows.length === 0) {
          setListings([]);
          return;
        }

        const ids = listingRows.map((r: any) => r.id);
        const { data: priceRows } = await supabase
          .from("property_pricing")
          .select("property_id, price, rental_type")
          .in("property_id", ids)
          .order("id", { ascending: true });

        const { data: imgRows } = await supabase
          .from("listings_images")
          .select("property_id, image_url")
          .in("property_id", ids)
          .order("id", { ascending: true });

        const priceMap = new Map<string, any>();
        (priceRows ?? []).forEach((p: any) => priceMap.set(p.property_id, p));
        const imgMap = new Map<string, any>();
        (imgRows ?? []).forEach((r: any) => imgMap.set(r.property_id, r));

        const view = listingRows.map((r: any) => {
          const pricing = priceMap.get(r.id);
          return {
            id: r.id,
            title: r.title,
            city: r.city,
            property_type: r.property_type,
            price: pricing ? `${pricing.price}/${pricing.rental_type}` : undefined,
            image: imgMap.get(r.id)?.image_url?.[0] ?? null,
          };
        });

        if (mounted) setListings(view);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingListings(false);
      }
    }

    loadListings();
    return () => {
      mounted = false;
    };
  }, []);

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
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Browse Spaces</h1>
        <p className="mt-3 text-slate-600 max-w-2xl leading-relaxed">
          Search and filter available commercial spaces. Find venues by
          location, type, and budget. Listings will appear here once property
          management is wired up.
        </p>

        <section className="mt-10" aria-label="Filters">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">
            Filter results
          </h2>
          <div className="flex flex-wrap gap-3">
            <select
              aria-label="Location"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]/30"
            >
              <option>Location</option>
            </select>
            <select
              aria-label="Type"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]/30"
            >
              <option>Type</option>
            </select>
            <select
              aria-label="Price"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]/30"
            >
              <option>Price</option>
            </select>
          </div>
        </section>

        <section
          className="mt-10 space-y-4"
          aria-label="Example listings with save feature"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Current Property Listings
            </h2>
          </div>

          {error && (
            <div className="text-sm text-red-600 border border-red-100 bg-red-50 px-3 py-2 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {loadingListings ? (
              <div className="col-span-3 text-center text-slate-500">Loading listings…</div>
            ) : listings.length === 0 ? (
              <div className="col-span-3 text-center text-slate-500">No listings yet.</div>
            ) : (
              listings.map((listing) => {
                const isSaved = savedIds.has(listing.id);
                const isSaving = savingId === listing.id;

                return (
                  <article
                    key={listing.id}
                    className="flex flex-col border border-slate-200/80 rounded-2xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="h-28 rounded-md overflow-hidden mb-4 flex items-center justify-center text-xs text-slate-400">
                      {listing.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={listing.image} alt={listing.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-50 border border-slate-100 flex items-center justify-center text-xs text-slate-400">No image</div>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {listing.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      {listing.city ?? ""} · {listing.property_type ?? ""}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {listing.price ?? ""}
                    </p>

                    <div className="mt-4 flex justify-between items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleSave(listing.id)}
                        disabled={isSaving || isSaved}
                        className="inline-flex items-center justify-center text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-60 disabled:cursor-default transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/20"
                      >
                        {isSaved
                          ? "Saved"
                          : isSaving
                            ? "Saving..."
                            : "Save space"}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-slate-600 hover:text-slate-900"
                      >
                        View details
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
