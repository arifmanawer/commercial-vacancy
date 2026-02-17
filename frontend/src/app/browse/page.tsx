"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type MockListing = {
  id: string;
  title: string;
  location: string;
  price: string;
  type: string;
};

const mockListings: MockListing[] = [
  {
    id: "listing-1",
    title: "Street-level Retail Space",
    location: "Downtown",
    price: "$1,800 / month",
    type: "Retail",
  },
  {
    id: "listing-2",
    title: "Loft Studio for Events",
    location: "Arts District",
    price: "$250 / day",
    type: "Event",
  },
  {
    id: "listing-3",
    title: "Flexible Office Suite",
    location: "Business Park",
    price: "$900 / month",
    type: "Office",
  },
];

export default function BrowsePage() {
  const { user } = useAuth();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-100">
        <Navbar />
      </header>
      <main className="max-w-6xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 rounded mb-6"
        >
          ← Back to home
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Browse Spaces</h1>
        <p className="mt-2 text-slate-600 max-w-2xl">
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
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option>Location</option>
            </select>
            <select
              aria-label="Type"
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option>Type</option>
            </select>
            <select
              aria-label="Price"
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
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
              Example listings (save feature)
            </h2>
            <p className="text-xs text-slate-500">
              These are sample spaces to test saving; real listings will replace
              them later.
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-600 border border-red-100 bg-red-50 px-3 py-2 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {mockListings.map((listing) => {
              const isSaved = savedIds.has(listing.id);
              const isSaving = savingId === listing.id;

              return (
                <article
                  key={listing.id}
                  className="flex flex-col border border-slate-200 rounded-lg p-4 bg-white"
                >
                  <div className="h-28 rounded-md bg-slate-50 border border-slate-100 mb-4 flex items-center justify-center text-xs text-slate-400">
                    Listing image
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {listing.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    {listing.location} · {listing.type}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {listing.price}
                  </p>

                  <div className="mt-4 flex justify-between items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleSave(listing.id)}
                      disabled={isSaving || isSaved}
                      className="inline-flex items-center justify-center text-xs px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
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
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
