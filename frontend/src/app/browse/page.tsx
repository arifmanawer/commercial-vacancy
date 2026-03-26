"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { SaveListingButton } from "@/components/SaveListingButton";

type ListingView = {
  id: string;
  title: string;
  city?: string | null;
  state?: string | null;
  property_type?: string | null;
  rate_amount?: number | null;
  rate_type?: string | null;
  image?: string | null;
};

type SavedListingRow = {
  property_id: string | null;
};

type ListingRow = {
  id: string;
  title: string;
  description: string | null;
};

type PricingRow = {
  id: string;
  rate_amount: number | null;
  rate_type: string | null;
  min_duration: number | null;
  max_duration: number | null;
};

type ImageRow = {
  property_id: string;
  image_url: string[] | null;
};

type FilterState = {
  propertyType: string;
  city: string;
  state: string;
  minPrice: string;
  maxPrice: string;
  minDeposit: string;
  maxDeposit: string;
};

export default function BrowsePage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<ListingView[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    propertyType: "",
    city: "",
    state: "",
    minPrice: "",
    maxPrice: "",
    minDeposit: "",
    maxDeposit: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSaved() {
      setError(null);

      if (!userId) {
        setSavedIds(new Set());
        return;
      }

      setLoadingSaved(true);
      try {
        const { data, error: fetchError } = await supabase
          .from("saved_listings")
          .select("property_id")
          .eq("user_id", userId);

        if (fetchError) {
          if (!cancelled) {
            setError(fetchError.message ?? "Unable to load saved spaces.");
          }
          return;
        }

        const next = new Set<string>();
        const rows = (data ?? []) as SavedListingRow[];
        rows.forEach((r) => {
          if (typeof r.property_id === "string" && r.property_id.length > 0) {
            next.add(r.property_id);
          }
        });

        if (!cancelled) setSavedIds(next);
      } catch {
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
    let mounted = true;
    async function loadListings() {
      setLoadingListings(true);
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/732c440c-88ac-4208-979e-9aee3e11d0cd', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Debug-Session-Id': '8ebdf7',
          },
          body: JSON.stringify({
            sessionId: '8ebdf7',
            runId: 'pre-fix-1',
            hypothesisId: 'H1',
            location: 'frontend/src/app/browse/page.tsx:loadListings:entry',
            message: 'Entering loadListings',
            data: {},
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion agent log

        const { data: listingRows, error: listingsError } = await supabase
          .from("listings")
          .select(
            // Only select columns that are guaranteed to exist in the current schema.
            "id, title, description",
          )
          .order("created_at", { ascending: false });

        if (listingsError) {
          console.error("Failed to load listings", listingsError);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/732c440c-88ac-4208-979e-9aee3e11d0cd', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Debug-Session-Id': '8ebdf7',
            },
            body: JSON.stringify({
              sessionId: '8ebdf7',
              runId: 'pre-fix-1',
              hypothesisId: 'H1',
              location: 'frontend/src/app/browse/page.tsx:loadListings:error',
              message: 'Listings query failed',
              data: { message: listingsError.message, details: listingsError.details },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion agent log
          if (mounted) {
            setListings([]);
          }
          return;
        }

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/732c440c-88ac-4208-979e-9aee3e11d0cd', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Debug-Session-Id': '8ebdf7',
          },
          body: JSON.stringify({
            sessionId: '8ebdf7',
            runId: 'pre-fix-1',
            hypothesisId: 'H2',
            location: 'frontend/src/app/browse/page.tsx:loadListings:afterQuery',
            message: 'Listings query succeeded',
            data: { rowCount: listingRows ? listingRows.length : null },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion agent log

        if (!listingRows || listingRows.length === 0) {
          setListings([]);
          return;
        }

        const rows = listingRows as ListingRow[];

        const ids = rows.map((r) => r.id);

        const { data: imgRows } = await supabase
          .from("listings_images")
          .select("property_id, image_url")
          .in("property_id", ids)
          .order("id", { ascending: true });

        const imgMap = new Map<string, any>();
        const imgRowsTyped = (imgRows ?? []) as ImageRow[];
        imgRowsTyped.forEach((r) => imgMap.set(r.property_id, r));

        const view = rows.map((r) => {
          return {
            id: r.id,
            title: r.title,
            city: null,
            state: null,
            property_type: null,
            rate_amount: null,
            rate_type: null,
            image: imgMap.get(r.id)?.image_url?.[0] ?? null,
          };
        });

        if (mounted) setListings(view);
      } catch (err) {
        console.error(err);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/732c440c-88ac-4208-979e-9aee3e11d0cd', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Debug-Session-Id': '8ebdf7',
          },
          body: JSON.stringify({
            sessionId: '8ebdf7',
            runId: 'pre-fix-1',
            hypothesisId: 'H3',
            location: 'frontend/src/app/browse/page.tsx:loadListings:catch',
            message: 'Unexpected error in loadListings',
            data: { errorMessage: err instanceof Error ? err.message : String(err) },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion agent log
      } finally {
        setLoadingListings(false);
      }
    }

    loadListings();
    return () => {
      mounted = false;
    };
  }, []);

  const handleFilterChange = (e: {
    target: { name: string; value: string };
  }) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const uniqueCities = Array.from(
    new Set(
      listings
        .map((l) => l.city)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );

  const uniqueStates = Array.from(
    new Set(
      listings
        .map((l) => l.state)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );

  const uniquePropertyTypes = Array.from(
    new Set(
      listings
        .map((l) => l.property_type)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );

  const filteredListings = listings.filter((listing) => {
    if (filters.city && listing.city !== filters.city) return false;
    if (filters.state && listing.state !== filters.state) return false;
    if (
      filters.propertyType &&
      listing.property_type !== filters.propertyType
    ) {
      return false;
    }

    const price = listing.rate_amount ?? null;

    if (filters.minPrice) {
      const min = Number(filters.minPrice);
      if (Number.isFinite(min)) {
        if (price === null || price < min) return false;
      }
    }

    if (filters.maxPrice) {
      const max = Number(filters.maxPrice);
      if (Number.isFinite(max)) {
        if (price === null || price > max) return false;
      }
    }

    return true;
  });

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
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
          Browse Spaces
        </h1>
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
              aria-label="City"
              name="city"
              value={filters.city}
              onChange={handleFilterChange}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]/30"
            >
              <option value="">All cities</option>
              {uniqueCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <select
              aria-label="State"
              name="state"
              value={filters.state}
              onChange={handleFilterChange}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]/30"
            >
              <option value="">All states</option>
              {uniqueStates.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
            <select
              aria-label="Property Type"
              name="propertyType"
              value={filters.propertyType}
              onChange={handleFilterChange}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]/30"
            >
              <option value="">All types</option>
              {uniquePropertyTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="minPrice"
                value={filters.minPrice}
                onChange={handleFilterChange}
                placeholder="Min price"
                className="w-28 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]/30"
              />
              <span className="text-xs text-slate-500">-</span>
              <input
                type="number"
                name="maxPrice"
                value={filters.maxPrice}
                onChange={handleFilterChange}
                placeholder="Max price"
                className="w-28 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]/30"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="minDeposit"
                value={filters.minDeposit}
                onChange={handleFilterChange}
                placeholder="Min deposit"
                className="w-28 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]/30"
              />
              <span className="text-xs text-slate-500">-</span>
              <input
                type="number"
                name="maxDeposit"
                value={filters.maxDeposit}
                onChange={handleFilterChange}
                placeholder="Max deposit"
                className="w-28 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]/30"
              />
            </div>
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
              <div className="col-span-3 text-center text-slate-500">
                Loading listings…
              </div>
            ) : listings.length === 0 ? (
              <div className="col-span-3 text-center text-slate-500">
                No listings yet.
              </div>
            ) : filteredListings.length === 0 ? (
              <div className="col-span-3 text-center text-slate-500">
                No listings match your filters.
              </div>
            ) : (
              filteredListings.map((listing) => {
                const isSaved = savedIds.has(listing.id);

                return (
                  <article
                    key={listing.id}
                    className="flex flex-col border border-slate-200/80 rounded-2xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="h-28 rounded-md overflow-hidden mb-4 flex items-center justify-center text-xs text-slate-400">
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
                    <h3 className="text-sm font-semibold text-slate-900">
                      {listing.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      {listing.city ?? ""}{" "}
                      {listing.state ? `, ${listing.state}` : ""} ·{" "}
                      {listing.property_type ?? ""}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {listing.rate_amount != null && listing.rate_type
                        ? `$${listing.rate_amount}/${listing.rate_type}`
                        : ""}
                    </p>

                    <div className="mt-4 flex justify-between items-center gap-3">
                      <SaveListingButton
                        propertyId={listing.id}
                        isSaved={isSaved}
                        disabled={loadingSaved}
                        onChange={(nextSaved) => {
                          setSavedIds((prev) => {
                            const next = new Set(prev);
                            if (nextSaved) {
                              next.add(listing.id);
                            } else {
                              next.delete(listing.id);
                            }
                            return next;
                          });
                        }}
                        onError={setError}
                      />
                      <Link
                        href={`/listings/${listing.id}`}
                        className="text-xs text-slate-600 hover:text-slate-900"
                      >
                        View details
                      </Link>
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
