"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabaseClient";
import { useParams } from "next/navigation";

type ListingDetails = {
  id: string;
  title: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  property_type: string | null;
  price: number | null;
  rental_type: string | null;
  security_deposit: number | null;
  images: string[];
};

function formatMoney(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ListingPage() {
  const params = useParams<{ id: string | string[] }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [listing, setListing] = useState<ListingDetails | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(true);
      return;
    }

    let cancelled = false;

    async function loadListing() {
      setLoading(true);
      setNotFound(false);
      setListing(null);

      try {
        const { data: listingRow, error: listingError } = await supabase
          .from("listings")
          .select("id, title, description, address, city, state, property_type")
          .eq("id", id)
          .maybeSingle();

        if (listingError || !listingRow) {
          if (!cancelled) setNotFound(true);
          return;
        }

        const { data: pricingRows, error: pricingError } = await supabase
          .from("property_pricing")
          .select("price, rental_type, security_deposit")
          .eq("property_id", id)
          .order("id", { ascending: false })
          .limit(1);

        if (pricingError) {
          console.warn("pricing fetch error", pricingError.message);
        }

        const pricing =
          pricingRows && pricingRows.length > 0 ? pricingRows[0] : null;

        const { data: imgRows, error: imgError } = await supabase
          .from("listings_images")
          .select("image_url")
          .eq("property_id", id)
          .order("id", { ascending: true });

        if (imgError) {
          console.warn("images fetch error", imgError.message);
        }

        const images = (imgRows ?? [])
          .flatMap((r: any) => (Array.isArray(r.image_url) ? r.image_url : []))
          .filter(
            (u: any): u is string => typeof u === "string" && u.length > 0,
          );

        if (!cancelled) {
          setListing({
            id: listingRow.id,
            title: listingRow.title,
            description: listingRow.description ?? null,
            address: listingRow.address ?? null,
            city: listingRow.city ?? null,
            state: listingRow.state ?? null,
            property_type: listingRow.property_type ?? null,
            price: pricing?.price ?? null,
            rental_type: pricing?.rental_type ?? null,
            security_deposit: pricing?.security_deposit ?? null,
            images,
          });
          setActiveImage(0);
        }
      } catch (_err) {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadListing();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center text-slate-600">Loading listing…</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900">
              Listing Not Found
            </h1>
            <p className="text-slate-600 mt-2">
              {notFound
                ? "The listing you are looking for does not exist."
                : "Unable to load this listing."}
            </p>
            <Link
              href="/browse"
              className="mt-4 inline-block text-blue-600 hover:underline"
            >
              Browse all spaces
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <header className="border-b border-slate-100 sticky top-0 bg-white z-50">
        <Navbar />
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb / Back Link */}
        <Link
          href="/browse"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Browse
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT COLUMN - Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Image Gallery */}
            <div className="space-y-4">
              <div className="aspect-video w-full bg-slate-100 rounded-xl overflow-hidden shadow-sm relative group">
                {listing.images.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      listing.images[
                        Math.min(activeImage, listing.images.length - 1)
                      ]
                    }
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400">
                    <span className="text-lg font-medium">No image</span>
                  </div>
                )}

                {/* Image Navigation (if multiple) */}
                {listing.images.length > 1 && (
                  <>
                    <button
                      onClick={() =>
                        setActiveImage((prev) =>
                          prev === 0 ? listing.images.length - 1 : prev - 1,
                        )
                      }
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-md text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ←
                    </button>
                    <button
                      onClick={() =>
                        setActiveImage((prev) =>
                          prev === listing.images.length - 1 ? 0 : prev + 1,
                        )
                      }
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-md text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      →
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnails */}
              {listing.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {listing.images.map((img: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImage(idx)}
                      className={`h-20 w-32 flex-shrink-0 rounded-lg border-2 overflow-hidden ${
                        activeImage === idx
                          ? "border-slate-900"
                          : "border-transparent"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img}
                        alt={`${listing.title} thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title & Key Info */}
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">
                    {listing.title}
                  </h1>
                  <p className="text-lg text-slate-600 mt-1">
                    {listing.address ??
                      `${listing.city ?? ""}${listing.state ? `, ${listing.state}` : ""}`}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-800">
                  {listing.property_type ?? "Space"}
                </span>
              </div>

              <div className="flex gap-6 mt-6 border-y border-slate-100 py-4">
                <div>
                  <span className="block text-sm text-slate-500">Price</span>
                  <span className="text-lg font-semibold text-slate-900">
                    {listing.price != null && listing.rental_type
                      ? `${formatMoney(listing.price)}/${listing.rental_type}`
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-sm text-slate-500">
                    Security deposit
                  </span>
                  <span className="text-lg font-semibold text-slate-900">
                    {formatMoney(listing.security_deposit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">
                About this space
              </h2>
              <p className="text-slate-600 leading-relaxed text-lg">
                {listing.description ?? "No description provided."}
              </p>
            </section>

            {/* Map Placeholder */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">
                Location
              </h2>
              <div className="h-64 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 border border-slate-200">
                Map Placeholder (Integration coming later)
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN - Sticky Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Contact Card */}
              <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  Interested in this space?
                </h3>

                <div className="space-y-4">
                  <button className="w-full bg-slate-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm">
                    Contact Landlord
                  </button>
                  <button className="w-full bg-white text-slate-700 border border-slate-300 py-3 px-4 rounded-lg font-medium hover:bg-slate-50 transition-colors">
                    Schedule a Tour
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100">
                  <p className="text-xs text-slate-500 uppercase font-semibold mb-3">
                    Listed by
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Landlord
                      </p>
                      <p className="text-xs text-slate-500">
                        Contact info coming soon
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Safety/Info Box */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <h4 className="flex items-center text-sm font-semibold text-slate-900 mb-2">
                  <svg
                    className="w-4 h-4 mr-2 text-slate-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Leasing Info
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Rental type: {listing.rental_type ?? "—"} · Security deposit:{" "}
                  {formatMoney(listing.security_deposit)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
