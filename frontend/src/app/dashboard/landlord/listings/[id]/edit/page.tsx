"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import {
  LISTING_RATE_TYPES,
  type ListingRateType,
  validateBuyNowListingPricing,
} from "@/lib/listingPricing";

type EditFormState = {
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  property_type: string;
  rate_amount: string;
  rate_type: string;
  min_duration: string;
  max_duration: string;
  status: string;
};

export default function EditListingPage() {
  const params = useParams<{ id: string | string[] }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const router = useRouter();
  const { user } = useAuth();

  const [form, setForm] = useState<EditFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !user) return;

    let cancelled = false;

    async function loadListing() {
      setLoading(true);
      setError(null);

      const { data: listingRow, error: listingError } = await supabase
        .from("listings")
        .select(
          "id, user_id, title, description, address, city, state, zip_code, property_type, status, rate_type, rate_amount, min_duration, max_duration",
        )
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;

      if (listingError || !listingRow) {
        setError("Listing not found.");
        setLoading(false);
        return;
      }

      if (!user || listingRow.user_id !== user.id) {
        setError("You do not have permission to edit this listing.");
        setLoading(false);
        return;
      }

      if (listingRow.status !== "Available") {
        setError("Only listings with status 'Available' can be edited.");
        setLoading(false);
        return;
      }

      const loadedRate = listingRow.rate_type ?? "";
      const normalizedRateType = LISTING_RATE_TYPES.includes(
        loadedRate as ListingRateType,
      )
        ? loadedRate
        : LISTING_RATE_TYPES[1];

      setForm({
        title: listingRow.title ?? "",
        description: listingRow.description ?? "",
        address: listingRow.address ?? "",
        city: listingRow.city ?? "",
        state: listingRow.state ?? "",
        zip_code: listingRow.zip_code ?? "",
        property_type: listingRow.property_type ?? "",
        rate_amount:
          listingRow.rate_amount != null ? String(listingRow.rate_amount) : "",
        rate_type: normalizedRateType,
        min_duration:
          listingRow.min_duration != null ? String(listingRow.min_duration) : "",
        max_duration:
          listingRow.max_duration != null ? String(listingRow.max_duration) : "",
        status: listingRow.status ?? "",
      });
      setLoading(false);
    }

    loadListing();

    return () => {
      cancelled = true;
    };
  }, [id, user]);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
    if (!form) return;
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !id || !user) return;

    if (form.status !== "Available") {
      setError("Only listings with status 'Available' can be edited.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const rateType = String(form.rate_type || "").toLowerCase();
      const rateAmount =
        form.rate_amount.trim() === "" ? null : Number.parseFloat(form.rate_amount);
      const minDuration =
        form.min_duration.trim() === ""
          ? null
          : Number.parseInt(form.min_duration, 10);
      const maxDuration =
        form.max_duration.trim() === ""
          ? null
          : Number.parseInt(form.max_duration, 10);

      const pricingError = validateBuyNowListingPricing({
        rateType,
        rateAmount,
        minDuration,
        maxDuration,
      });
      if (pricingError) {
        setError(pricingError);
        setSaving(false);
        return;
      }

      const { error: listingError } = await supabase
        .from("listings")
        .update({
          title: form.title,
          description: form.description || null,
          address: form.address,
          city: form.city,
          state: form.state,
          zip_code: form.zip_code,
          property_type: form.property_type,
        })
        .eq("id", id)
        .eq("user_id", user.id);

      if (listingError) {
        setError(listingError.message);
        setSaving(false);
        return;
      }

    const { error: pricingUpdateError } = await supabase
      .from("listings")
      .update({
        rate_type: rateType,
        rate_amount: rateAmount,
        min_duration: minDuration,
        max_duration: maxDuration,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (pricingUpdateError) {
      setError(pricingUpdateError.message);
      setSaving(false);
      return;
    }

      router.push("/dashboard/landlord");
    } catch (err: any) {
      setError(err?.message ?? "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <h1 className="text-xl font-semibold text-slate-900">
              Sign in required
            </h1>
            <p className="text-sm text-slate-600">
              You must be signed in to edit a listing.
            </p>
            <Link
              href="/signin"
              className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Go to sign in
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (loading || !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-slate-600">Loading listing...</div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <Link
          href="/dashboard/landlord"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 mb-6"
        >
          ← Back to dashboard
        </Link>

        <div className="max-w-3xl">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            Edit listing
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            Update the details of your listing. Editing is only allowed while the
            listing is marked as &quot;Available&quot;.
          </p>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-6 bg-white rounded-2xl shadow-lg p-6 border border-slate-100"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Title
                </label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Property Type
                </label>
                <input
                  name="property_type"
                  value={form.property_type}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Address
                </label>
                <input
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  City
                </label>
                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  State
                </label>
                <input
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Zip Code
                </label>
                <input
                  name="zip_code"
                  value={form.zip_code}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Rate type (required for Buy Now) <span className="text-red-600">*</span>
                </label>
                <select
                  name="rate_type"
                  value={form.rate_type}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
                >
                  {LISTING_RATE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs text-slate-600">
              Pricing below must stay valid so renters can use Buy Now on this listing.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Price per unit (USD) <span className="text-red-600">*</span>
                </label>
                <input
                  name="rate_amount"
                  type="number"
                  value={form.rate_amount}
                  onChange={handleChange}
                  required
                  min={0.01}
                  step={0.01}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
                />
              </div>
              <div />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Minimum duration <span className="text-red-600">*</span>
                </label>
                <input
                  name="min_duration"
                  type="number"
                  value={form.min_duration}
                  onChange={handleChange}
                  required
                  min={1}
                  step={1}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Maximum duration <span className="text-red-600">*</span>
                </label>
                <input
                  name="max_duration"
                  type="number"
                  value={form.max_duration}
                  onChange={handleChange}
                  required
                  min={1}
                  step={1}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-2.5 text-base font-semibold text-white hover:bg-slate-800 shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-slate-900/40 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
              <Link
                href="/dashboard/landlord"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}

