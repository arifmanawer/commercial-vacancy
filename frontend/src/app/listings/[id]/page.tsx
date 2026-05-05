"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase, supabasePublic } from "@/lib/supabaseClient";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/api";
import { GoogleMap, Marker } from "@react-google-maps/api";
import { SaveListingButton } from "@/components/SaveListingButton";
import { useGoogleMapsLoader } from "@/hooks/useGoogleMapsLoader";
import VacancyInsights from "@/components/VacancyInsights";
import ZoningInsights from "@/components/ZoningInsights";
import TransitInsights from "@/components/TransitInsights";
import BookingDateRangePicker from "@/components/BookingDateRangePicker";
import type { DateRange } from "react-day-picker";

type LandlordPublicInfo = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
};

type ListingDetails = {
  id: string;
  title: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  property_type: string | null;
  rate_amount: number | null;
  rate_type: string | null;
  security_deposit: number | null;
  min_duration: number | null;
  max_duration: number | null;
  zip_code: string | null;
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

/** Backend accepts `user_id` query param as fallback when `X-User-Id` is stripped (some proxies/CDNs). */
function apiUserQuery(userId: string) {
  return `user_id=${encodeURIComponent(userId)}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number) {
  const copy = new Date(d.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function enumerateDaysTouched(start: Date, end: Date) {
  const days: Date[] = [];
  const from = startOfDay(start);
  const to = startOfDay(end);
  const min = Math.min(from.getTime(), to.getTime());
  const max = Math.max(from.getTime(), to.getTime());
  let cursor = new Date(min);
  while (cursor.getTime() <= max) {
    days.push(new Date(cursor.getTime()));
    cursor = addDays(cursor, 1);
  }
  return days;
}

function parseHHMM(value: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}

function combineLocalDateAndTime(d: Date, timeHHMM: string) {
  const parsed = parseHHMM(timeHHMM);
  const hh = parsed?.hh ?? 0;
  const mm = parsed?.mm ?? 0;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0, 0);
}

export default function ListingPage() {
  const params = useParams<{ id: string | string[] }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [listing, setListing] = useState<ListingDetails | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [tourOpen, setTourOpen] = useState(false);
  const [tourMessage, setTourMessage] = useState("");
  const [tourTime, setTourTime] = useState("");
  const [buyStart, setBuyStart] = useState("");
  const [buyEnd, setBuyEnd] = useState("");
  const [buyRange, setBuyRange] = useState<DateRange | undefined>(undefined);
  const [buyStartTime, setBuyStartTime] = useState("09:00");
  const [buyEndTime, setBuyEndTime] = useState("17:00");
  const [reservedDates, setReservedDates] = useState<Date[]>([]);
  const [submitting, setSubmitting] = useState<"tour" | "buy" | null>(null);
  const [startingConversation, setStartingConversation] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [landlordLoading, setLandlordLoading] = useState(false);
  const [landlordError, setLandlordError] = useState<string | null>(null);
  const [landlordInfo, setLandlordInfo] = useState<LandlordPublicInfo | null>(
    null,
  );
  const [mapCenter, setMapCenter] =
    useState<google.maps.LatLngLiteral | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const { isLoaded: mapsLoaded } = useGoogleMapsLoader();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function loadReservedDates() {
      const { data, error: bookingsError } = await supabasePublic
        .from("bookings")
        .select("start_datetime, end_datetime, status")
        .eq("listing_id", id)
        .in("status", ["pending_payment", "reserved", "active"]);

      if (cancelled) return;
      if (bookingsError) {
        console.warn("reserved dates fetch error", bookingsError.message);
        setReservedDates([]);
        return;
      }

      const days: Date[] = [];
      for (const row of data ?? []) {
        const start = new Date((row as any).start_datetime);
        const end = new Date((row as any).end_datetime);
        const startMs = start.getTime();
        const endMs = end.getTime();
        if (Number.isNaN(startMs) || Number.isNaN(endMs)) continue;
        for (const d of enumerateDaysTouched(start, end)) days.push(d);
      }
      setReservedDates(days);
    }

    loadReservedDates();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!buyRange?.from || !buyRange?.to) return;
    const start = combineLocalDateAndTime(buyRange.from, buyStartTime);
    const end = combineLocalDateAndTime(buyRange.to, buyEndTime);
    setBuyStart(start.toISOString());
    setBuyEnd(end.toISOString());
  }, [buyEndTime, buyRange?.from, buyRange?.to, buyStartTime]);

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
        // Use the public client so listing pages remain accessible even if auth storage
        // is wedged due to multi-tab Stripe redirect flows.
        const { data: listingRow, error: listingError } = await supabasePublic
          .from("listings")
          .select(
            "id, title, description, address, city, state, zip_code, property_type, user_id, rate_type, rate_amount, min_duration, max_duration",
          )
          .eq("id", id)
          .maybeSingle();

        if (listingError || !listingRow) {
          if (!cancelled) setNotFound(true);
          return;
        }

        const { data: imgRows, error: imgError } = await supabasePublic
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
            rate_amount: listingRow.rate_amount ?? null,
            rate_type: listingRow.rate_type ?? null,
            security_deposit: null,
            min_duration: listingRow.min_duration ?? null,
            max_duration: listingRow.max_duration ?? null,
            zip_code: listingRow.zip_code ?? null,
            images,
            landlord_user_id:
              typeof listingRow.user_id === "string"
                ? listingRow.user_id
                : null,
          });
          setActiveImage(0);
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
    const checkout = searchParams?.get("checkout");
    const bookingId = searchParams?.get("bookingId");
    const sessionId = searchParams?.get("session_id");
    if (checkout !== "success" || !bookingId) return;
    const userId = user?.id;
    if (!userId) {
      setFeedback("Payment completed. Sign in to see your reservation.");
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 12; // ~24s at 2s interval

    async function pollBooking(requestUserId: string) {
      attempts += 1;
      try {
        const res = await fetch(
          `${getApiUrl()}/api/bookings/${bookingId}?${apiUserQuery(requestUserId)}`,
          {
            headers: {
              "X-User-Id": requestUserId,
            },
          },
        );
        const json = (await res.json().catch(() => null)) as
          | { success?: boolean; data?: { status?: string }; error?: string }
          | null;

        const status = json?.data?.status;
        if (!cancelled && res.ok && json?.success && typeof status === "string") {
          if (status === "reserved" || status === "active") {
            setFeedback("Payment confirmed — your booking is reserved.");
            router.replace(`/listings/${id}`);
            return;
          }
          if (status === "payment_failed") {
            setError("Payment failed. Please try again.");
            router.replace(`/listings/${id}`);
            return;
          }
          setFeedback("Payment received — confirming your reservation…");
        }
      } catch {
        if (!cancelled) setFeedback("Payment received — confirming your reservation…");
      }

      if (!cancelled && attempts < maxAttempts) {
        setTimeout(() => pollBooking(requestUserId), 2000);
      } else if (!cancelled) {
        setFeedback(
          "Payment received — confirmation may take a moment. Check your renter dashboard for the latest status.",
        );
      }
    }

    setFeedback("Payment received — confirming your reservation…");
    // Ask the backend to confirm the Checkout Session (fallback when webhooks can't reach local dev).
    if (sessionId) {
      fetch(
        `${getApiUrl()}/api/bookings/confirm-checkout?${apiUserQuery(userId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": userId,
          },
          body: JSON.stringify({ sessionId, bookingId }),
        },
      ).catch(() => null);
    }

    pollBooking(userId);

    return () => {
      cancelled = true;
    };
  }, [id, router, searchParams, user?.id]);

  useEffect(() => {
    if (!id) return;
    setLandlordError(null);
    setLandlordInfo(null);
  }, [id]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    async function loadLandlord() {
      setLandlordLoading(true);
      setLandlordError(null);
      setLandlordInfo(null);
      try {
        const { data, error } = await supabasePublic
          .rpc("get_listing_landlord_public", { listing_id: id })
          .maybeSingle();

        if (error || !data) {
          if (!cancelled) {
            setLandlordError(error?.message || "Unable to load landlord details.");
          }
          return;
        }

        if (!cancelled) {
          // Supabase RPC typing defaults to `{}` unless we provide a generic type.
          // Cast to the fields we actually expect from `get_listing_landlord_public`.
          const landlord = data as {
            id: string;
            username?: string | null;
            first_name?: string | null;
            last_name?: string | null;
            profile_picture_url?: string | null;
          };

          setLandlordInfo({
            id: landlord.id,
            username: landlord.username ?? null,
            first_name: landlord.first_name ?? null,
            last_name: landlord.last_name ?? null,
            profile_picture_url: landlord.profile_picture_url ?? null,
          });
        }
      } finally {
        if (!cancelled) setLandlordLoading(false);
      }
    }

    loadLandlord();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const landlordDisplayName =
    [landlordInfo?.first_name, landlordInfo?.last_name]
      .filter(Boolean)
      .join(" ") ||
    landlordInfo?.username ||
    "Landlord";
  const landlordProfileHref = landlordInfo?.id
    ? `/landlords/${landlordInfo.id}`
    : null;
  const isOwnListing = Boolean(
    user?.id && listing?.landlord_user_id && user.id === listing.landlord_user_id,
  );

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

  function ensureAuthenticated(action: "tour" | "message" | "buy") {
    if (!user) {
      const target = `/signin?redirect=/listings/${id}&action=${action}`;
      router.push(target);
      return false;
    }
    return true;
  }

  function computeDurationUnits(
    start: Date,
    end: Date,
    rateType: ListingDetails["rate_type"],
  ): number | null {
    const startMs = start.getTime();
    const endMs = end.getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return null;

    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * hourMs;

    switch (rateType) {
      case "hourly":
        return Math.ceil((endMs - startMs) / hourMs);
      case "daily":
        return Math.ceil((endMs - startMs) / dayMs);
      case "weekly":
        return Math.ceil((endMs - startMs) / (7 * dayMs));
      case "monthly": {
        const monthsBase =
          (end.getFullYear() - start.getFullYear()) * 12 +
          (end.getMonth() - start.getMonth());
        const addMonths = (d: Date, months: number) => {
          const copy = new Date(d.getTime());
          copy.setMonth(copy.getMonth() + months);
          return copy;
        };
        let months = Math.max(0, monthsBase);
        if (addMonths(start, months).getTime() < endMs) months += 1;
        return Math.max(1, months);
      }
      default:
        return null;
    }
  }

  async function buyNow() {
    if (!listing || !id) return;
    if (!ensureAuthenticated("buy") || !user) return;

    if (!listing.rate_type) {
      setError("This listing is missing pricing information.");
      return;
    }
    if (!buyStart) {
      setError("Please choose a start date and time.");
      return;
    }
    if (!buyEnd) {
      setError("Please choose an end date and time.");
      return;
    }

    const start = new Date(buyStart);
    const end = new Date(buyEnd);
    const durationUnits = computeDurationUnits(start, end, listing.rate_type);
    if (!durationUnits) {
      setError("Please choose a valid start/end time window.");
      return;
    }
    if (listing.min_duration != null && durationUnits < listing.min_duration) {
      setError(`Duration must be at least ${listing.min_duration} ${listing.rate_type}.`);
      return;
    }
    if (listing.max_duration != null && durationUnits > listing.max_duration) {
      setError(`Duration must be at most ${listing.max_duration} ${listing.rate_type}.`);
      return;
    }

    setSubmitting("buy");
    setError(null);
    setFeedback(null);

    try {
      const res = await fetch(
        `${getApiUrl()}/api/bookings/buy-now?${apiUserQuery(user.id)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": user.id,
          },
          body: JSON.stringify({
            listingId: listing.id,
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          }),
        },
      );

      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: { checkoutUrl?: string }; error?: string }
        | null;

      if (!res.ok || !json?.success || !json.data?.checkoutUrl) {
        setError(json?.error || "Unable to start checkout.");
        return;
      }

      window.location.href = json.data.checkoutUrl;
    } catch {
      setError("Unable to start checkout.");
    } finally {
      setSubmitting(null);
    }
  }

  async function submitInquiry() {
    if (!listing || !id) return;
    if (!ensureAuthenticated("tour") || !user) return;

    setSubmitting("tour");
    setFeedback(null);
    setError(null);

    try {
      const message = tourMessage.trim();
      const preferred_time = tourTime.trim();
      if (!preferred_time) {
        setError("Please choose a preferred date and time for the tour.");
        return;
      }

      const { error: insertError } = await supabase
        .from("listing_inquiries")
        .insert({
          listing_id: listing.id,
          renter_id: user.id,
          type: "tour",
          message: message || null,
          preferred_time: preferred_time || null,
        });

      if (insertError) {
        setError(
          insertError.message ||
            "Could not send your request. Please try again.",
        );
        return;
      }

      setFeedback(
        "Your tour request has been recorded. The landlord will be able to review it.",
      );
      setTourOpen(false);
      setTourMessage("");
      setTourTime("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  async function startMessageThread() {
    if (!listing || !id) return;
    if (!ensureAuthenticated("message") || !user) return;
    if (listing.landlord_user_id === user.id) {
      setError("You cannot message yourself about your own listing.");
      return;
    }

    try {
      setFeedback(null);
      setError(null);
      setStartingConversation(true);
      const res = await fetch(
        `${getApiUrl()}/api/messages/conversations?${apiUserQuery(user.id)}`,
        {
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
        },
      );

      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: { id: string }; error?: string }
        | null;

      if (!res.ok || !json?.success || !json.data) {
        console.error("Failed to start conversation", json?.error);
        setError("Unable to start message. Please try again.");
        return;
      }

      router.push(`/messages/${json.data.id}`);
    } catch (err: unknown) {
      console.error(err);
      setError("Unable to start message. Please try again.");
    } finally {
      setStartingConversation(false);
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
                    {listing.rate_amount != null && listing.rate_type
                      ? `${formatMoney(listing.rate_amount)}/${listing.rate_type}`
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-sm text-slate-500">
                    Duration range
                  </span>
                  <span className="text-lg font-semibold text-slate-900">
                    {listing.min_duration != null && listing.max_duration != null
                      ? `${listing.min_duration}–${listing.max_duration} ${listing.rate_type ?? ""}`
                      : "—"}
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

            {/* NYC Open Data Insights */}
            {listing.zip_code && (
              <>
                <VacancyInsights zipCode={listing.zip_code} />
                <ZoningInsights zipCode={listing.zip_code} />
              </>
            )}
            {mapCenter && (
              <TransitInsights lat={mapCenter.lat} lng={mapCenter.lng} />
            )}
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
                  <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                      Buy now
                    </p>
                    <div className="space-y-2">
                      <BookingDateRangePicker
                        value={buyRange}
                        onChange={(next) => {
                          setError(null);
                          setBuyRange(next);
                        }}
                        reservedDates={reservedDates}
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-medium text-slate-600">
                          Start time
                          <input
                            type="time"
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                            value={buyStartTime}
                            onChange={(e) => setBuyStartTime(e.target.value)}
                          />
                        </label>
                        <label className="block text-xs font-medium text-slate-600">
                          End time
                          <input
                            type="time"
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                            value={buyEndTime}
                            onChange={(e) => setBuyEndTime(e.target.value)}
                          />
                        </label>
                      </div>
                      {listing.rate_type && buyStart && buyEnd && (() => {
                        const durationUnits = computeDurationUnits(
                          new Date(buyStart),
                          new Date(buyEnd),
                          listing.rate_type,
                        );
                        if (!durationUnits) return null;
                        return (
                          <p className="text-[11px] text-slate-500">
                            Billable duration: <span className="font-medium">{durationUnits}</span>{" "}
                            {listing.rate_type}
                          </p>
                        );
                      })()}
                    </div>
                    <button
                      className="mt-3 w-full bg-emerald-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60"
                      onClick={buyNow}
                      disabled={submitting != null}
                    >
                      {submitting === "buy" ? "Redirecting to checkout..." : "Buy Now"}
                    </button>
                  </div>
                  <button
                    className="w-full bg-slate-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={() => {
                      startMessageThread();
                    }}
                    disabled={
                      submitting != null ||
                      startingConversation ||
                      isOwnListing ||
                      !listing.landlord_user_id
                    }
                  >
                    {isOwnListing
                      ? "This is your listing"
                      : startingConversation
                        ? "Opening chat..."
                        : "Contact Landlord"}
                  </button>
                  <Link
                    href={`/assistant?listingId=${listing.id}`}
                    className="w-full inline-flex items-center justify-center bg-white text-slate-700 border border-slate-300 py-3 px-4 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                  >
                    Ask Assistant about this listing
                  </Link>
                  <button
                    className="w-full bg-white text-slate-700 border border-slate-300 py-3 px-4 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                    onClick={() => {
                      setFeedback(null);
                      setError(null);
                      if (!ensureAuthenticated("tour")) return;
                      setTourOpen((open) => !open);
                    }}
                    disabled={submitting != null}
                  >
                    Schedule a Tour
                  </button>
                </div>

                {tourOpen && (
                  <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
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
                          required
                        />
                      </label>
                      <textarea
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                        rows={3}
                        placeholder="Add any details about your availability or questions..."
                        value={tourMessage}
                        onChange={(e) => setTourMessage(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setTourOpen(false)}
                          className="flex-1 inline-flex justify-center items-center rounded-lg bg-slate-100 text-slate-700 py-2.5 px-4 text-sm font-medium hover:bg-slate-200 transition-colors"
                          disabled={submitting === "tour"}
                        >
                          Close
                        </button>
                        <button
                          type="button"
                          onClick={submitInquiry}
                          className="flex-1 inline-flex justify-center items-center rounded-lg bg-white text-slate-900 border border-slate-300 py-2.5 px-4 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-60"
                          disabled={submitting === "tour"}
                        >
                          {submitting === "tour"
                            ? "Sending request..."
                            : "Send Tour Request"}
                        </button>
                      </div>
                    </div>
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

                <div className="mt-6 pt-6 border-t border-slate-100">
                  <p className="text-xs text-slate-500 uppercase font-semibold mb-3">
                    Listed by
                  </p>
                  {landlordProfileHref ? (
                    <Link
                      href={landlordProfileHref}
                      className="group flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {landlordInfo?.profile_picture_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={landlordInfo.profile_picture_url}
                            alt={landlordDisplayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-semibold text-slate-600">
                            {landlordDisplayName
                              .split(" ")
                              .map((p) => p[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex flex-col gap-0.5">
                        <p className="text-sm font-medium text-slate-900 group-hover:text-slate-950">
                          {landlordLoading ? "Loading…" : landlordDisplayName}
                        </p>
                        {landlordLoading ? (
                          <p className="text-xs text-slate-500">
                            Loading contact details…
                          </p>
                        ) : landlordError ? (
                          <p className="text-xs text-slate-500">
                            Contact details unavailable
                          </p>
                        ) : (
                          <>
                            <p className="text-xs font-medium text-[var(--brand)]">
                              View profile
                            </p>
                          </>
                        )}
                      </div>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-slate-600">
                          {landlordDisplayName
                            .split(" ")
                            .map((p) => p[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {landlordLoading ? "Loading…" : landlordDisplayName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {landlordLoading
                            ? "Loading contact details…"
                            : landlordError
                              ? "Contact details unavailable"
                              : "Messages you send here go directly to this landlord."}
                        </p>
                      </div>
                    </div>
                  )}
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
                  Rental type: {listing.rate_type ?? "—"} · Duration range:{" "}
                  {listing.min_duration != null && listing.max_duration != null
                    ? `${listing.min_duration}–${listing.max_duration} ${listing.rate_type ?? ""}`
                    : "—"}
                </p>
                <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
                  Conversations started from this listing are for information and planning only.
                  A binding rental agreement is only created when you accept a formal offer and complete
                  payment through Commercial Vacancy, under the platform&apos;s terms and any refund policy
                  shown in the app.
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
