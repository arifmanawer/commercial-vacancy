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
  city?: string | null;
  state?: string | null;
  property_type?: string | null;
  price?: number | null;
  security_deposit?: number | null;
  rental_type?: string | null;
  image?: string | null;
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
  const [savingId, setSavingId] = useState<string | null>(null);
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
        (data ?? []).forEach((r: any) => {
          if (typeof r?.property_id === "string" && r.property_id.length > 0) {
            next.add(r.property_id);
          }
        });

        if (!cancelled) setSavedIds(next);
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

  const handleToggleSave = async (property_id: string) => {
    setError(null);

    if (!user) {
      setError("Please sign in to save spaces.");
      return;
    }

    const currentlySaved = savedIds.has(property_id);

    setSavingId(property_id);
    try {
      if (currentlySaved) {
        const { error: deleteError } = await supabase
          .from("saved_listings")
          .delete()
          .eq("user_id", user.id)
          .eq("property_id", property_id);

        if (deleteError) {
          setError(deleteError.message ?? "Unable to remove this saved space.");
          return;
        }

        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(property_id);
          return next;
        });
      } else {
        const { error: insertError } = await supabase
          .from("saved_listings")
          .insert({
            user_id: user.id,
            property_id: property_id,
          });

        if (insertError) {
          const msg = insertError.message ?? "";
          const isDuplicate =
            insertError.code === "23505" ||
            msg.toLowerCase().includes("duplicate");
          if (!isDuplicate) {
            setError(insertError.message ?? "Unable to save this space.");
            return;
          }
        }

        setSavedIds((prev) => {
          const next = new Set(prev);
          next.add(property_id);
          return next;
        });
      }
    } catch (_err) {
      setError("Something went wrong. Please try again.");
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
          .select("id, title, city, state, property_type")
          .order("created_at", { ascending: false });

        if (!listingRows || listingRows.length === 0) {
          setListings([]);
          return;
        }

        const ids = listingRows.map((r: any) => r.id);
        const { data: priceRows } = await supabase
          .from("property_pricing")
          .select("property_id, price, rental_type, security_deposit")
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
            state: r.state,
            property_type: r.property_type,
            price: pricing ? pricing.price : null,
            security_deposit: pricing ? pricing.security_deposit : null,
            rental_type: pricing ? pricing.rental_type : null,
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

    const price = listing.price ?? null;
    const deposit = listing.security_deposit ?? null;

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
                const isSaving = savingId === listing.id;

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
                      {listing.price != null && listing.rental_type
                        ? `${listing.price}/${listing.rental_type}`
                        : ""}
                    </p>

                    <div className="mt-4 flex justify-between items-center gap-3">
                      <button
                        type="button"
                        aria-pressed={isSaved}
                        onClick={() => handleToggleSave(listing.id)}
                        disabled={isSaving || loadingSaved}
                        className={`inline-flex items-center justify-center text-xs px-3 py-1.5 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/20 disabled:opacity-60 disabled:cursor-default ${
                          isSaved
                            ? "border-[var(--brand)]/30 text-[var(--brand)] hover:border-[var(--brand)] hover:bg-[var(--brand)]/5"
                            : "border-slate-200 text-slate-700 hover:border-[var(--brand)] hover:text-[var(--brand)]"
                        }`}
                      >
                        {isSaving
                          ? "Saving..."
                          : isSaved
                            ? "Unsave"
                            : "Save space"}
                      </button>
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
