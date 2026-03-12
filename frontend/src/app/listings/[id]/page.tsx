"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/api";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
import { SaveListingButton } from "@/components/SaveListingButton";

type LandlordPublicInfo = {
  id: string;
  email: string | null;
  is_landlord: boolean;
  created_at: string | null;
};

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
  landlord_user_id: string | null;
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
  const router = useRouter();
  const { user } = useAuth();

  const [listing, setListing] = useState<ListingDetails | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [contactOpen, setContactOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [tourMessage, setTourMessage] = useState("");
  const [tourTime, setTourTime] = useState("");
  const [submitting, setSubmitting] = useState<"contact" | "tour" | null>(
    null,
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [landlord, setLandlord] = useState<LandlordPublicInfo | null>(null);
  const [landlordLoading, setLandlordLoading] = useState(false);
  const [landlordError, setLandlordError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] =
    useState<google.maps.LatLngLiteral | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const { isLoaded: mapsLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  });

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
          .select(
            "id, title, description, address, city, state, property_type, user_id",
          )
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

        type ImageRow = { image_url: string[] | null };

        const images = ((imgRows ?? []) as ImageRow[])
          .flatMap((r) => (Array.isArray(r.image_url) ? r.image_url : []))
          .filter(
            (u): u is string => typeof u === "string" && u.length > 0,
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
            landlord_user_id:
              typeof listingRow.user_id === "string"
                ? listingRow.user_id
                : null,
          });
          setActiveImage(0);
          setLandlord(null);
          setLandlordError(null);
        }
      } catch {
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

  useEffect(() => {
    if (!id) return;
    setLandlord(null);
    setLandlordError(null);
  }, [id]);

  useEffect(() => {
    if (!id || !listing) return;

    let cancelled = false;

    async function loadLandlord() {
      setLandlordLoading(true);
      setLandlordError(null);

      try {
        const res = await fetch(`${getApiUrl()}/api/listings/${id}/landlord`);
        const body = (await res.json().catch(() => null)) as
          | { success?: boolean; data?: LandlordPublicInfo; error?: string }
          | null;

        if (!res.ok || !body?.success || !body.data) {
          if (!cancelled) {
            setLandlordError(
              body?.error || "Unable to load landlord details.",
            );
          }
          return;
        }

        if (!cancelled) {
          setLandlord(body.data);
        }
      } catch (_err) {
        if (!cancelled) {
          setLandlordError("Unable to load landlord details.");
        }
      } finally {
        if (!cancelled) setLandlordLoading(false);
      }
    }

    loadLandlord();

    return () => {
      cancelled = true;
    };
  }, [id, listing]);

  useEffect(() => {
    if (!mapsLoaded || !listing) return;
    if (!listing.address && !listing.city && !listing.state) return;

    const parts = [
      listing.address ?? "",
      listing.city ?? "",
      listing.state ?? "",
    ]
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (!parts.length) return;

    const addressString = parts.join(", ");

    const geocoder = new google.maps.Geocoder();
    setMapError(null);

    geocoder.geocode({ address: addressString }, (results, status) => {
      if (status === "OK" && results && results[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        setMapCenter({ lat: loc.lat(), lng: loc.lng() });
      } else {
        setMapError("Map is unavailable for this address.");
      }
    });
  }, [mapsLoaded, listing]);

  function ensureAuthenticated(action: "contact" | "tour" | "message") {
    if (!user) {
      const target = `/signin?redirect=/listings/${id}&action=${action}`;
      router.push(target);
      return false;
    }
    return true;
  }

  async function submitInquiry(type: "contact" | "tour") {
    if (!listing || !id) return;
    if (!ensureAuthenticated(type) || !user) return;

    setSubmitting(type);
    setFeedback(null);
    setError(null);

    try {
      const message =
        type === "contact"
          ? contactMessage.trim()
          : tourMessage.trim();
      const preferred_time = type === "tour" ? tourTime.trim() : null;

      const { error: insertError } = await supabase
        .from("listing_inquiries")
        .insert({
          listing_id: listing.id,
          renter_id: user.id,
          type,
          message: message || null,
          preferred_time,
        });

      if (insertError) {
        setError(
          insertError.message ||
            "Could not send your request. Please try again.",
        );
        return;
      }

      setFeedback(
        type === "contact"
          ? "Your interest has been recorded. The landlord will be able to review it."
          : "Your tour request has been recorded. The landlord will be able to review it.",
      );
      if (type === "contact") {
        setContactOpen(false);
        setContactMessage("");
      } else {
        setTourOpen(false);
        setTourMessage("");
        setTourTime("");
      }
    } catch (_err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting((current) => (current === type ? null : current));
    }
  }

  async function startMessageThread() {
    if (!listing || !id) return;
    if (!ensureAuthenticated("message") || !user) return;

    try {
      const res = await fetch(`${getApiUrl()}/api/messages/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": user.id,
        },
        body: JSON.stringify({
          contextType: "listing",
          listingId: id,
          participantIds: [user.id, listing.landlord_user_id],
        }),
      });

      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: { id: string }; error?: string }
        | null;

      if (!res.ok || !json?.success || !json.data) {
        console.error("Failed to start conversation", json?.error);
        alert("Unable to start message. Please try again.");
        return;
      }

      router.push(`/messages/${json.data.id}`);
    } catch (err) {
      console.error(err);
      alert("Unable to start message. Please try again.");
    }
  }

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
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0">
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

            {/* Map */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">
                Location
              </h2>
              <div className="h-64 rounded-xl border border-slate-200 overflow-hidden">
                {!mapsLoaded ? (
                  <div className="w-full h-full bg-slate-50 flex items-center justify-center text-sm text-slate-500">
                    Loading map…
                  </div>
                ) : mapCenter ? (
                  <GoogleMap
                    center={mapCenter}
                    zoom={14}
                    mapContainerStyle={{ width: "100%", height: "100%" }}
                    options={{
                      disableDefaultUI: true,
                      zoomControl: true,
                      streetViewControl: false,
                      mapTypeControl: false,
                    }}
                  >
                    <Marker position={mapCenter} />
                  </GoogleMap>
                ) : (
                  <div className="w-full h-full bg-slate-50 flex items-center justify-center text-sm text-slate-500">
                    {mapError || "Map is unavailable for this address."}
                  </div>
                )}
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

                <div className="mb-4">
                  <SaveListingButton
                    propertyId={listing.id}
                    onError={setError}
                    className="w-full py-2.5 text-sm"
                  />
                </div>

                <div className="space-y-4">
                  <button
                    className="w-full bg-slate-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm"
                    onClick={() => {
                      setFeedback(null);
                      setError(null);
                      if (!ensureAuthenticated("contact")) return;
                      setContactOpen((open) => !open);
                      setTourOpen(false);
                    }}
                    disabled={submitting === "contact" || submitting === "tour"}
                  >
                    Contact Landlord
                  </button>
                  <button
                    className="w-full bg-white text-slate-700 border border-slate-300 py-3 px-4 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                    onClick={() => {
                      if (!listing.landlord_user_id) {
                        alert("Unable to message landlord for this listing.");
                        return;
                      }
                      startMessageThread();
                    }}
                    disabled={submitting === "contact" || submitting === "tour"}
                  >
                    Message Landlord
                  </button>
                  <button
                    className="w-full bg-white text-slate-700 border border-slate-300 py-3 px-4 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                    onClick={() => {
                      setFeedback(null);
                      setError(null);
                      if (!ensureAuthenticated("tour")) return;
                      setTourOpen((open) => !open);
                      setContactOpen(false);
                    }}
                    disabled={submitting === "contact" || submitting === "tour"}
                  >
                    Schedule a Tour
                  </button>
                </div>

                {(contactOpen || tourOpen) && (
                  <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
                    {contactOpen && (
                      <div className="space-y-3">
                        <p className="text-sm text-slate-600">
                          Send a short note about your interest in this space.
                        </p>
                        <textarea
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                          rows={3}
                          placeholder="Tell the landlord what you're looking for..."
                          value={contactMessage}
                          onChange={(e) => setContactMessage(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => submitInquiry("contact")}
                          className="w-full inline-flex justify-center items-center rounded-lg bg-slate-900 text-white py-2.5 px-4 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-60"
                          disabled={submitting === "contact"}
                        >
                          {submitting === "contact"
                            ? "Sending..."
                            : "Send to Landlord"}
                        </button>
                      </div>
                    )}

                    {tourOpen && (
                      <div className="space-y-3">
                        <p className="text-sm text-slate-600">
                          Request a tour and suggest times that work for you.
                        </p>
                        <label className="block text-xs font-medium text-slate-600">
                          Preferred date &amp; time
                          <input
                            type="datetime-local"
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                            value={tourTime}
                            onChange={(e) => setTourTime(e.target.value)}
                          />
                        </label>
                        <textarea
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                          rows={3}
                          placeholder="Add any details about your availability or questions..."
                          value={tourMessage}
                          onChange={(e) => setTourMessage(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => submitInquiry("tour")}
                          className="w-full inline-flex justify-center items-center rounded-lg bg-white text-slate-900 border border-slate-300 py-2.5 px-4 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-60"
                          disabled={submitting === "tour"}
                        >
                          {submitting === "tour"
                            ? "Sending request..."
                            : "Send Tour Request"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {(feedback || error) && (
                  <div className="mt-4 text-sm">
                    {feedback && (
                      <p className="text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                        {feedback}
                      </p>
                    )}
                    {error && (
                      <p className="text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-2">
                        {error}
                      </p>
                    )}
                  </div>
                )}

                {landlord && (
                  <p className="mt-3 text-xs text-slate-500">
                    Your messages are delivered to{" "}
                    <span className="font-medium text-slate-700">
                      {landlord.email ?? "this listing’s landlord"}
                    </span>
                    .
                  </p>
                )}

                <div className="mt-6 pt-6 border-t border-slate-100">
                  <p className="text-xs text-slate-500 uppercase font-semibold mb-3">
                    Listed by
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {landlord?.email || "Landlord"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {landlordLoading
                          ? "Loading contact details…"
                          : landlordError
                            ? "Contact details unavailable"
                            : landlord?.email
                              ? "Messages you send here go directly to this landlord."
                              : "Contact details will be shared after you send a message."}
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
