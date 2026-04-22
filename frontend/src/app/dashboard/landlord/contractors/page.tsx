"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DashboardProfile from "@/components/DashboardProfile";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/api";
import { contractorRatingCaption } from "@/lib/contractorReputation";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/Toast";
import type {
  Contractor,
  ContractorAvailabilityStatus,
  ContractorJob,
} from "@/types/database";

type ServiceFilter =
  | "Painting"
  | "Cleaning"
  | "Renovation"
  | "Staging"
  | "Repairs"
  | "Electrical"
  | "Plumbing";

const SERVICE_OPTIONS: ServiceFilter[] = [
  "Painting",
  "Cleaning",
  "Renovation",
  "Staging",
  "Repairs",
  "Electrical",
  "Plumbing",
];

type AvailabilityFilter = "any" | "available_now";

interface ApiContractorResponse {
  success: boolean;
  data: Contractor[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

interface ApiContractorJobResponse {
  success: boolean;
  data?: ContractorJob;
  error?: string;
}

export default function LandlordContractorsPage() {
  const router = useRouter();
  const { user, isLandlord, loading } = useAuth();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [selectedServices, setSelectedServices] = useState<ServiceFilter[]>([]);
  const [availabilityFilter, setAvailabilityFilter] =
    useState<AvailabilityFilter>("any");
  const [radius, setRadius] = useState<string>("");
  const [zip, setZip] = useState("");

  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [creatingJobFor, setCreatingJobFor] = useState<Contractor | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobBudget, setJobBudget] = useState("");
  const [jobPreferredDate, setJobPreferredDate] = useState("");
  const [jobSubmitting, setJobSubmitting] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobSuccess, setJobSuccess] = useState<string | null>(null);
  const [landlordListings, setLandlordListings] = useState<any[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string>("");
  const [loadingListings, setLoadingListings] = useState(false);
  const [listingsError, setListingsError] = useState<string | null>(null);

  // Redirect non-landlords as a safety net (RLS + middleware already protect)
  useEffect(() => {
    if (!loading && (!user || !isLandlord)) {
      router.replace("/dashboard/renter");
    }
  }, [loading, user, isLandlord, router]);

  const serviceQuery = useMemo(
    () => (selectedServices.length ? selectedServices.join(",") : undefined),
    [selectedServices]
  );

  useEffect(() => {
    if (!user || !isLandlord) return;

    const fetchData = async () => {
      setFetching(true);
      setFetchError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", "12");
        if (search.trim()) params.set("search", search.trim());
        if (serviceQuery) params.set("service", serviceQuery);
        if (availabilityFilter === "available_now") {
          params.set("available", "true");
        }
        if (radius.trim()) params.set("radius", radius.trim());
        if (zip.trim()) params.set("zip", zip.trim());

        const res = await fetch(
          `${getApiUrl()}/api/contractors?${params.toString()}`,
          {
            headers: {
              "X-User-Id": user.id,
            },
          }
        );

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error || "Failed to load contractors");
        }

        const json = (await res.json()) as ApiContractorResponse;
        setContractors(json.data || []);
        setTotal(json.pagination?.total || 0);
        setTotalPages(json.pagination?.totalPages || 0);
      } catch (err) {
        setFetchError(
          err instanceof Error ? err.message : "Failed to load contractors"
        );
      } finally {
        setFetching(false);
      }
    };

    fetchData();
  }, [user, isLandlord, page, search, serviceQuery, availabilityFilter, radius, zip]);

  useEffect(() => {
    if (!user || !isLandlord) return;
    let cancelled = false;
    const loadListings = async () => {
      setLoadingListings(true);
      setListingsError(null);
      try {
        const { data, error } = await supabase
          .from("listings")
          .select("id, title, city, state")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (cancelled) return;
        if (error) {
          setListingsError(error.message);
          setLandlordListings([]);
        } else {
          const listings = data || [];
          setLandlordListings(listings);
          if (listings.length > 0) {
            setSelectedListingId((prev) => prev || listings[0].id);
          }
        }
      } finally {
        if (!cancelled) setLoadingListings(false);
      }
    };
    loadListings();
    return () => {
      cancelled = true;
    };
  }, [user, isLandlord]);

  const toggleService = (service: ServiceFilter) => {
    setPage(1);
    setSelectedServices((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service]
    );
  };

  const handleAvailabilityChange = (value: AvailabilityFilter) => {
    setPage(1);
    setAvailabilityFilter(value);
  };

  const handleRadiusChange = (value: string) => {
    setPage(1);
    setRadius(value.replace(/[^\d]/g, ""));
  };

  const handleSearchChange = (value: string) => {
    setPage(1);
    setSearch(value);
  };

  const handleClearFilters = () => {
    setSearch("");
    setSelectedServices([]);
    setAvailabilityFilter("any");
    setRadius("");
    setZip("");
    setPage(1);
  };

  const handleMessageClick = async (contractor: Contractor) => {
    if (!user) return;
    try {
      const res = await fetch(`${getApiUrl()}/api/messages/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": user.id,
        },
        body: JSON.stringify({
          contextType: "contractor",
          contractorId: contractor.id,
          participantIds: [user.id, contractor.user_id],
        }),
      });

      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: { id: string }; error?: string }
        | null;

      if (!res.ok || !json?.success || !json.data) {
        toast("Unable to start conversation. Please try again.", "error");
        return;
      }

      router.push(`/messages/${json.data.id}`);
    } catch {
      toast("Unable to start conversation. Please try again.", "error");
    }
  };

  const resetJobForm = () => {
    setJobTitle("");
    setJobDescription("");
    setJobBudget("");
    setJobPreferredDate("");
    setJobError(null);
  };

  const handleCreateJobClick = (contractor: Contractor) => {
    setJobSuccess(null);
    setCreatingJobFor(contractor);
    resetJobForm();
  };

  const handleSubmitJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !creatingJobFor) return;

    setJobSubmitting(true);
    setJobError(null);
    setJobSuccess(null);

    try {
      const payload = {
        contractor_id: creatingJobFor.user_id,
        listing_id: selectedListingId || undefined,
        title: jobTitle.trim(),
        description: jobDescription.trim() || undefined,
        budget: jobBudget ? Number(jobBudget) : undefined,
        preferred_date: jobPreferredDate || undefined,
      };

      const res = await fetch(`${getApiUrl()}/api/contractor-jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": user.id,
        },
        body: JSON.stringify(payload),
      });

      const body = (await res.json().catch(() => null)) as
        | ApiContractorJobResponse
        | { error?: string }
        | null;

      if (!res.ok || !body || !("success" in body) || !body.success) {
        throw new Error(
          (body && "error" in body && body.error) ||
            "Failed to create contractor job",
        );
      }

      setJobSuccess("Job request sent to contractor.");
      resetJobForm();
    } catch (err) {
      setJobError(
        err instanceof Error ? err.message : "Failed to create contractor job",
      );
    } finally {
      setJobSubmitting(false);
    }
  };

  const availabilityDotColor = (status: ContractorAvailabilityStatus) => {
    switch (status) {
      case "available":
        return "bg-emerald-500";
      case "soon":
        return "bg-amber-400";
      default:
        return "bg-slate-400";
    }
  };

  const availabilityLabel = (status: ContractorAvailabilityStatus) => {
    switch (status) {
      case "available":
        return "Available now";
      case "soon":
        return "Available soon";
      default:
        return "Busy";
    }
  };

  const dayOrder: string[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
        <Navbar />
      </header>

      <main className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        <DashboardProfile />

        <section className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Find Contractors
          </h1>
          <p className="text-slate-600 max-w-2xl">
            Browse available contractors for your property. Message them
            directly to discuss the job.
          </p>
        </section>

        {/* Filters */}
        <section
          aria-labelledby="filters-heading"
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2
                id="filters-heading"
                className="text-lg font-semibold text-slate-900"
              >
                Filters
              </h2>
              <p className="text-sm text-slate-600">
                Refine contractors by skills, availability, and service area.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
            >
              Clear all
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-700">
                  Search by name or skill
                </label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="e.g. John, painting, renovation"
                  className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div className="w-full md:w-64">
                <label className="block text-xs font-medium text-slate-700">
                  Availability
                </label>
                <div className="mt-1 inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => handleAvailabilityChange("any")}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md ${
                      availabilityFilter === "any"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    Any time
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAvailabilityChange("available_now")}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md ${
                      availabilityFilter === "available_now"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    Available this week
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-3">
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-700 mb-1">
                  Service type
                </p>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_OPTIONS.map((service) => {
                    const active = selectedServices.includes(service);
                    return (
                      <button
                        key={service}
                        type="button"
                        onClick={() => toggleService(service)}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {service}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="w-full lg:w-80 flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700">
                    ZIP code
                  </label>
                  <input
                    type="text"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="e.g. 10001"
                    className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Service radius (miles)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={radius}
                    onChange={(e) => handleRadiusChange(e.target.value)}
                    placeholder="e.g. 10"
                    className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Results */}
        <section aria-labelledby="results-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2
                id="results-heading"
                className="text-lg font-semibold text-slate-900"
              >
                Contractors
              </h2>
              <p className="text-sm text-slate-600">
                {fetching
                  ? "Loading contractors…"
                  : total > 0
                  ? `${total} contractors found`
                  : "Browse contractors that match your criteria."}
              </p>
            </div>
          </div>

          {fetchError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {fetchError}
            </div>
          )}

          {!fetching && contractors.length === 0 && !fetchError && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center space-y-2">
              <p className="text-base font-medium text-slate-900">
                No contractors match your filters
              </p>
              <p className="text-sm text-slate-600">
                Try adjusting your search, service types, or availability
                filters.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {contractors.map((contractor) => (
              <article
                key={contractor.id}
                className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {contractor.profile_picture_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={contractor.profile_picture_url}
                        alt={contractor.business_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-slate-600">
                        {contractor.business_name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">
                        {contractor.business_name}
                      </h3>
                      {contractor.is_verified && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-100">
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-amber-500">★</span>
                        <span className="font-medium">
                          {contractor.rating.toFixed(1)}
                        </span>
                        <span className="text-slate-400">
                          {contractorRatingCaption(contractor)}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="font-medium">
                        From ${contractor.hourly_rate.toFixed(0)}/hr
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-600">
                        Serves within {contractor.service_radius} miles
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`inline-flex h-2 w-2 rounded-full ${availabilityDotColor(
                          contractor.availability.status
                        )}`}
                      />
                      <span className="text-xs text-slate-600">
                        {availabilityLabel(contractor.availability.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {contractor.services.slice(0, 4).map((service) => (
                    <span
                      key={service}
                      className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200"
                    >
                      {service}
                    </span>
                  ))}
                  {contractor.services.length > 4 && (
                    <span className="text-[10px] text-slate-500">
                      +{contractor.services.length - 4} more
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span>Availability this week</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {dayOrder.map((day) => {
                      const isAvailable =
                        contractor.availability.available_days.includes(day);
                      return (
                        <div
                          key={day}
                          className={`flex flex-col items-center gap-0.5`}
                        >
                          <div
                            className={`h-2.5 w-2.5 rounded-sm border ${
                              isAvailable
                                ? "bg-emerald-500 border-emerald-500"
                                : "bg-slate-100 border-slate-200"
                            }`}
                          />
                          <span className="text-[9px] text-slate-400">
                            {day[0]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => handleMessageClick(contractor)}
                    className="inline-flex flex-1 items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    Message
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreateJobClick(contractor)}
                    className="inline-flex flex-1 items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    Request job
                  </button>
                  <Link
                    href={`/contractors/${contractor.id}`}
                    className="inline-flex flex-1 min-w-0 items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 cursor-pointer"
                  >
                    View profile
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-xs text-slate-600">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPage((p) => (p < totalPages ? p + 1 : p))
                }
                disabled={page >= totalPages}
                className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </section>

        {creatingJobFor && (
          <section className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-slate-200">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Request job from {creatingJobFor.business_name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Describe the work and when you’d like it done.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingJobFor(null);
                    resetJobForm();
                  }}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleSubmitJob} className="px-5 py-4 space-y-3">
                {jobError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {jobError}
                  </div>
                )}
                {jobSuccess && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    {jobSuccess}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Listing
                  </label>
                  {loadingListings ? (
                    <p className="text-xs text-slate-500">
                      Loading your listings…
                    </p>
                  ) : landlordListings.length === 0 ? (
                    <p className="text-xs text-red-600">
                      You need at least one listing to request a job. Create a
                      listing from your Landlord dashboard first.
                    </p>
                  ) : (
                    <select
                      value={selectedListingId}
                      onChange={(e) => setSelectedListingId(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-slate-50 text-slate-700"
                    >
                      {landlordListings.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.title || "Untitled"} – {l.city}, {l.state}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Job title
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    required
                    placeholder="e.g. Deep clean and repaint storefront"
                    className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Job details
                  </label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    rows={3}
                    placeholder="Share any details about the space, scope of work, and timing."
                    className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Budget (optional)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={jobBudget}
                      onChange={(e) => setJobBudget(e.target.value)}
                      placeholder="e.g. 500"
                      className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Preferred date
                    </label>
                    <input
                      type="date"
                      value={jobPreferredDate}
                      onChange={(e) => setJobPreferredDate(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingJobFor(null);
                      resetJobForm();
                    }}
                    className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={jobSubmitting || landlordListings.length === 0}
                    className="inline-flex items-center rounded-md bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {jobSubmitting ? "Sending…" : "Send request"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}

