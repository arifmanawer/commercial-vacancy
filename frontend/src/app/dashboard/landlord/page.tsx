"use client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DashboardProfile from "@/components/DashboardProfile";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function LandlordDashboardPage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    supabase
      .from("listings")
      .select("id, title, city, state, property_type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setListings(data || []);
        setLoading(false);
      });
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this listing?")) return;
    setError(null);
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) {
      setError(error.message);
    } else {
      setListings((prev) => prev.filter((l) => l.id !== id));
    }
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
              <p className="text-2xl font-bold text-slate-900">0</p>
              <p className="text-xs text-slate-500">
                Publish a space to start receiving booking requests.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Pending requests
              </p>
              <p className="text-2xl font-bold text-slate-900">0</p>
              <p className="text-xs text-slate-500">
                New booking requests from renters will show up here.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Upcoming payouts
              </p>
              <p className="text-2xl font-bold text-slate-900">$0.00</p>
              <p className="text-xs text-slate-500">
                Once bookings are completed, your payouts will appear here.
              </p>
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
              <button
                type="button"
                className="hidden sm:inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                Add new listing
              </button>
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
                  <li key={listing.id} className="py-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{listing.title}</div>
                      <div className="text-xs text-slate-500">
                        {listing.city}, {listing.state} &middot; {listing.property_type}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(listing.id)}
                      className="ml-4 px-3 py-1.5 rounded-md border border-red-200 bg-red-50 text-xs text-red-700 hover:bg-red-100"
                    >
                      Delete
                    </button>
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
                  Review, approve, or decline incoming booking requests.
                </p>
              </div>
            </div>

            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              There are no booking requests yet. When renters request your
              spaces, you&apos;ll be able to manage them here.
            </div>
          </section>
        </section>

        <section
          aria-labelledby="payouts-heading"
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2
                id="payouts-heading"
                className="text-lg font-semibold text-slate-900"
              >
                Payouts
              </h2>
              <p className="text-sm text-slate-600">
                Track completed bookings and payout history.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No payouts yet. Once bookings are completed and processed,
            you&apos;ll see your payout history here.
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
