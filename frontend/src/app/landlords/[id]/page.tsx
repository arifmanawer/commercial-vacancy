"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getApiUrl } from "@/lib/api";

type PublicListingSummary = {
  id: string;
  title: string | null;
  city: string | null;
  state: string | null;
  property_type: string | null;
  status: string | null;
  created_at: string | null;
};

type LandlordPublicProfile = {
  id: string;
  name: string;
  email: string | null;
  profile_picture_url: string | null;
  message_enabled: boolean;
  current_listings: PublicListingSummary[];
  reviews: {
    implemented: boolean;
    message: string;
    items: unknown[];
  };
};

export default function LandlordPublicProfilePage() {
  const params = useParams<{ id: string | string[] }>();
  const landlordId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [profile, setProfile] = useState<LandlordPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!landlordId) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      setNotFound(false);
      setProfile(null);

      try {
        const res = await fetch(
          `${getApiUrl()}/api/profiles/public/${encodeURIComponent(landlordId)}`,
        );

        type ApiJson = {
          success?: boolean;
          data?: LandlordPublicProfile;
          error?: string;
        };
        let json: ApiJson | null = null;
        try {
          json = (await res.json()) as ApiJson;
        } catch {
          json = null;
        }

        if (cancelled) return;

        if (res.status === 404) {
          setNotFound(true);
          return;
        }

        if (!res.ok) {
          setLoadError("Something went wrong. Please try again later.");
          return;
        }

        if (!json?.success || !json.data) {
          setLoadError("Something went wrong. Please try again later.");
          return;
        }

        setProfile(json.data);
      } catch {
        if (!cancelled) {
          setLoadError("Something went wrong. Please try again later.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [landlordId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
          <Navbar />
        </header>
        <main className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-slate-600">
          Loading profile…
        </main>
        <Footer />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
          <Navbar />
        </header>
        <main className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <Link
            href="/browse"
            className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-[var(--brand)] transition-colors mb-8"
          >
            ← Back to browse
          </Link>
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center">
            <h1 className="text-2xl font-bold text-slate-900">
              Profile not found
            </h1>
            <p className="mt-2 text-slate-600">
              We couldn&apos;t find this profile.
            </p>
            <Link
              href="/browse"
              className="mt-6 inline-block text-sm font-medium text-[var(--brand)] hover:underline"
            >
              Browse spaces
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (loadError || !profile || !landlordId) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
          <Navbar />
        </header>
        <main className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <Link
            href="/browse"
            className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-[var(--brand)] transition-colors mb-8"
          >
            ← Back to browse
          </Link>
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">
              Something went wrong
            </h1>
            <p className="mt-2 text-slate-600">
              {loadError || "Please try again later."}
            </p>
            <Link
              href="/browse"
              className="mt-6 inline-block text-sm font-medium text-[var(--brand)] hover:underline"
            >
              Browse spaces
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
        <Navbar />
      </header>
      <main className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <Link
          href="/browse"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-[var(--brand)] transition-colors mb-8"
        >
          ← Back to browse
        </Link>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            <div className="mx-auto sm:mx-0 h-24 w-24 sm:h-28 sm:w-28 flex-shrink-0 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center ring-1 ring-slate-200/80">
              {profile.profile_picture_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.profile_picture_url}
                  alt={profile.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-lg font-semibold text-slate-600">
                  {profile.name
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "L"}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Landlord
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900 tracking-tight">
                {profile.name}
              </h1>
              {profile.email && (
                <p className="mt-2 text-sm text-slate-600 break-all">
                  {profile.email}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="listings-heading">
          <h2
            id="listings-heading"
            className="text-lg font-semibold text-slate-900 mb-4"
          >
            Current listings
          </h2>
          {profile.current_listings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
              No active listings right now.
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profile.current_listings.map((listing) => (
                <li key={listing.id}>
                  <Link
                    href={`/listings/${listing.id}`}
                    className="flex h-full flex-col rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <span className="text-sm font-semibold text-slate-900 line-clamp-2">
                      {listing.title || "Untitled space"}
                    </span>
                    <span className="mt-1 text-xs text-slate-600">
                      {[listing.city, listing.state].filter(Boolean).join(", ") ||
                        "—"}
                      {listing.property_type
                        ? ` · ${listing.property_type}`
                        : ""}
                    </span>
                    <span className="mt-3 text-xs font-medium text-[var(--brand)]">
                      View details →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="mt-10 rounded-xl border border-slate-200 bg-slate-50/80 p-6 sm:p-8"
          aria-labelledby="reviews-heading"
        >
          <h2
            id="reviews-heading"
            className="text-lg font-semibold text-slate-900 mb-2"
          >
            Reviews
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {profile.reviews.message}
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
