"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, supabasePublic } from "@/lib/supabaseClient";
import { SaveListingButton } from "@/components/SaveListingButton";

function ListingImage({ src, alt }: { src?: string | null; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  if (!src) {
    return (
      <div className="h-28 rounded-md mb-4 bg-slate-50 border border-slate-100 flex items-center justify-center text-xs text-slate-400">
        No image
      </div>
    );
  }
  return (
    <div className="h-28 rounded-md overflow-hidden mb-4 relative bg-slate-100">
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-slate-100" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

type ListingView = {
  id: string;
  title: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  property_type?: string | null;
  rate_amount?: number | null;
  rate_type?: string | null;
  security_deposit?: number | null;
  image?: string | null;
};

type SavedListingRow = {
  property_id: string | null;
};

type ListingRow = {
  id: string;
  title: string;
  address: string | null;
  city: string | null;
  state: string | null;
  property_type: string | null;
  rate_amount: number | null;
  rate_type: string | null;
};

type ImageRow = {
  id?: string | number;
  property_id: string;
  image_url: string[] | null;
};

type PricingRow = {
  id?: string | number;
  property_id: string;
  security_deposit: number | string | null;
};

const PROPERTY_REL_CHUNK = 120;

function sortByStableId<T extends { id?: string | number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const na = Number(a.id);
    const nb = Number(b.id);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}

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
  const [search, setSearch] = useState("");
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
        // Use the public client so browsing is resilient to auth storage lock contention
        // (e.g. multi-tab Stripe redirect flows).
        const { data: listingRows, error: listingsError } = await supabasePublic
          .from("listings")
          .select(
            "id, title, address, city, state, property_type, rate_amount, rate_type",
          )
          .order("created_at", { ascending: false });

        if (listingsError) {
          console.error("Failed to load listings", listingsError);
          if (mounted) {
            setListings([]);
          }
          return;
        }

        if (!listingRows || listingRows.length === 0) {
          setListings([]);
          return;
        }

        const rows = listingRows as ListingRow[];

        const ids = rows.map((r) => r.id);

        async function fetchImageRows(): Promise<ImageRow[]> {
          const merged: ImageRow[] = [];
          for (let i = 0; i < ids.length; i += PROPERTY_REL_CHUNK) {
            const chunk = ids.slice(i, i + PROPERTY_REL_CHUNK);
            const { data, error: imgErr } = await supabasePublic
              .from("listings_images")
              .select("id, property_id, image_url")
              .in("property_id", chunk)
              .order("id", { ascending: true });
            if (imgErr) {
              console.error("listings_images fetch failed", imgErr);
              continue;
            }
            merged.push(...((data ?? []) as ImageRow[]));
          }
          return merged;
        }

        async function fetchPricingRows(): Promise<PricingRow[]> {
          const merged: PricingRow[] = [];
          for (let i = 0; i < ids.length; i += PROPERTY_REL_CHUNK) {
            const chunk = ids.slice(i, i + PROPERTY_REL_CHUNK);
            const { data, error: priceErr } = await supabasePublic
              .from("property_pricing")
              .select("id, property_id, security_deposit")
              .in("property_id", chunk);
            if (priceErr) {
              console.error("property_pricing fetch failed", priceErr);
              continue;
            }
            merged.push(...((data ?? []) as PricingRow[]));
          }
          return merged;
        }

        const [imgRowsMerged, pricingRowsMerged] = await Promise.all([
          fetchImageRows(),
          fetchPricingRows(),
        ]);

        const thumbByProperty = new Map<string, string | null>();
        for (const r of sortByStableId(imgRowsMerged)) {
          if (thumbByProperty.has(r.property_id)) continue;
          const first = Array.isArray(r.image_url)
            ? r.image_url.find((u) => typeof u === "string" && u.length > 0)
            : null;
          thumbByProperty.set(r.property_id, first ?? null);
        }

        const depositByProperty = new Map<string, number | null>();
        for (const r of sortByStableId(pricingRowsMerged)) {
          if (depositByProperty.has(r.property_id)) continue;
          const raw = r.security_deposit;
          const n =
            raw === null || raw === undefined || raw === ""
              ? null
              : Number(raw);
          depositByProperty.set(
            r.property_id,
            typeof n === "number" && Number.isFinite(n) ? n : null,
          );
        }

        const view = rows.map((r) => {
          return {
            id: r.id,
            title: r.title,
            address: r.address,
            city: r.city,
            state: r.state,
            property_type: r.property_type,
            rate_amount: r.rate_amount ?? null,
            rate_type: r.rate_type ?? null,
            security_deposit: depositByProperty.get(r.id) ?? null,
            image: thumbByProperty.get(r.id) ?? null,
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
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const haystack = [
        listing.title,
        listing.address,
        listing.city,
        listing.state,
        listing.property_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

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

    const deposit = listing.security_deposit ?? null;

    if (filters.minDeposit) {
      const min = Number(filters.minDeposit);
      if (Number.isFinite(min)) {
        if (deposit === null || deposit < min) return false;
      }
    }

    if (filters.maxDeposit) {
      const max = Number(filters.maxDeposit);
      if (Number.isFinite(max)) {
        if (deposit === null || deposit > max) return false;
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
          Search and filter available commercial spaces across NYC. Find
          offices, retail, studios, and more by location, type, and budget.
        </p>

        <div className="mt-8 relative">
          <input
            type="text"
            aria-label="Search listings"
            placeholder="Search by name, address, neighborhood, or type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]/30"
          />
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <section className="mt-6" aria-label="Filters">
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
              <>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="flex flex-col border border-slate-200/80 rounded-2xl p-5 bg-white animate-pulse"
                  >
                    <div className="h-28 rounded-md bg-slate-100 mb-4" />
                    <div className="h-4 w-3/4 rounded bg-slate-100 mb-2" />
                    <div className="h-3 w-1/2 rounded bg-slate-100 mb-2" />
                    <div className="h-4 w-1/3 rounded bg-slate-100 mt-1" />
                    <div className="mt-4 flex justify-between">
                      <div className="h-8 w-8 rounded-full bg-slate-100" />
                      <div className="h-4 w-16 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </>
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
                    <ListingImage src={listing.image} alt={listing.title} />
                    <h3 className="text-sm font-semibold text-slate-900">
                      {listing.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      {listing.city ?? ""}
                      {""}
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
