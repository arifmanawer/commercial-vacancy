"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DashboardProfile from "@/components/DashboardProfile";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/api";
import type {
  Contractor,
  ContractorAvailabilityStatus,
  ContractorJob,
  ContractorJobStatus,
} from "@/types/database";

type ServiceOption =
  | "Painting"
  | "Cleaning"
  | "Renovation"
  | "Staging"
  | "Repairs"
  | "Electrical"
  | "Plumbing";

const SERVICE_OPTIONS: ServiceOption[] = [
  "Painting",
  "Cleaning",
  "Renovation",
  "Staging",
  "Repairs",
  "Electrical",
  "Plumbing",
];

interface ApiContractorResponse {
  success: boolean;
  data?: Contractor;
  error?: string;
}

interface ApiContractorJobsResponse {
  success: boolean;
  data: ContractorJob[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export default function ContractorDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [existing, setExisting] = useState<Contractor | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [selectedServices, setSelectedServices] = useState<ServiceOption[]>([]);
  const [hourlyRate, setHourlyRate] = useState("");
  const [serviceRadius, setServiceRadius] = useState("");
  const [availabilityStatus, setAvailabilityStatus] =
    useState<ContractorAvailabilityStatus>("available");
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [jobs, setJobs] = useState<ContractorJob[]>([]);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      setError(null);
      try {
        const res = await fetch(`${getApiUrl()}/api/contractors/me`, {
          headers: {
            "X-User-Id": user.id,
          },
        });

        const body = (await res.json().catch(() => null)) as
          | ApiContractorResponse
          | { error?: string }
          | null;

        if (!res.ok) {
          const message =
            res.status === 403
              ? "Enable the Contractor role on your Profile to use this page."
              : (body && "error" in body ? body.error : "Failed to load contractor profile");
          throw new Error(message);
        }

        if (body?.data) {
          setExisting(body.data);
          setBusinessName(body.data.business_name);
          setSelectedServices(
            body.data.services.filter((s): s is ServiceOption =>
              SERVICE_OPTIONS.includes(s as ServiceOption)
            )
          );
          setHourlyRate(String(body.data.hourly_rate || ""));
          setServiceRadius(String(body.data.service_radius || ""));
          setAvailabilityStatus(body.data.availability.status);
          setAvailableDays(body.data.availability.available_days || []);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load contractor profile"
        );
      } finally {
        setLoaded(true);
      }
    };

    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const fetchJobs = async () => {
      setJobsError(null);
      try {
        const res = await fetch(
          `${getApiUrl()}/api/contractor-jobs?role=contractor`,
          {
            headers: {
              "X-User-Id": user.id,
            },
          },
        );
        const body = (await res.json().catch(() => null)) as
          | ApiContractorJobsResponse
          | { error?: string }
          | null;
        if (!res.ok || !body || !("success" in body) || !body.success) {
          throw new Error(
            (body && "error" in body && body.error) ||
              "Failed to load contractor jobs",
          );
        }
        setJobs(body.data || []);
      } catch (err) {
        setJobsError(
          err instanceof Error ? err.message : "Failed to load contractor jobs",
        );
      }
    };

    fetchJobs();
  }, [user]);

  const toggleService = (service: ServiceOption) => {
    setSelectedServices((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service]
    );
  };

  const toggleDay = (day: string) => {
    setAvailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError(null);

    try {
      const payload = {
        business_name: businessName.trim(),
        services: selectedServices,
        hourly_rate: Number(hourlyRate),
        service_radius: Number(serviceRadius),
        availability_status: availabilityStatus,
        available_days: availableDays,
      };

      const res = await fetch(`${getApiUrl()}/api/contractors/me`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": user.id,
        },
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => null)) as
        | ApiContractorResponse
        | null;

      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || "Failed to save contractor profile");
      }

      setExisting(json.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save contractor profile"
      );
    } finally {
      setSaving(false);
    }
  };

  const updateJobStatus = async (
    jobId: string,
    updates: Partial<Pick<ContractorJob, "status" | "contractor_note">>,
  ) => {
    if (!user) return;
    setUpdatingJobId(jobId);
    setJobsError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/contractor-jobs/${jobId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": user.id,
        },
        body: JSON.stringify(updates),
      });
      const body = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: ContractorJob; error?: string }
        | null;
      if (!res.ok || !body?.success || !body.data) {
        throw new Error(body?.error || "Failed to update job");
      }
      setJobs((prev) =>
        prev.map((job) => (job.id === jobId ? body.data! : job)),
      );
    } catch (err) {
      setJobsError(
        err instanceof Error ? err.message : "Failed to update job",
      );
    } finally {
      setUpdatingJobId(null);
    }
  };

  const statusLabel = (status: ContractorJobStatus) => {
    switch (status) {
      case "accepted":
        return "Accepted";
      case "declined":
        return "Declined";
      case "completed":
        return "Completed";
      default:
        return "Requested";
    }
  };

  const statusClasses = (status: ContractorJobStatus) => {
    switch (status) {
      case "accepted":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "declined":
        return "bg-red-50 text-red-700 border-red-100";
      case "completed":
        return "bg-slate-900 text-white border-slate-900";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
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
            Contractor Dashboard
          </h1>
          <p className="text-slate-600 max-w-2xl">
            Create or update your contractor profile so landlords can find and
            hire you for jobs.
          </p>
        </section>

        <section
          aria-labelledby="contractor-profile-heading"
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2
                id="contractor-profile-heading"
                className="text-lg font-semibold text-slate-900"
              >
                {existing ? "Your contractor profile" : "Set up your profile"}
              </h2>
              <p className="text-sm text-slate-600">
                Share what you do, where you work, and when you’re available.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSave}>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Business name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Downtown Repair & Maintenance"
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                required
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-700">Services</p>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Hourly rate (USD)
                </label>
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="e.g. 75"
                  className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Service radius (miles)
                </label>
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={serviceRadius}
                  onChange={(e) => setServiceRadius(e.target.value)}
                  placeholder="e.g. 10"
                  className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-700">
                  Availability status
                </p>
                <div className="mt-1 inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => setAvailabilityStatus("available")}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md ${
                      availabilityStatus === "available"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    Available now
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvailabilityStatus("soon")}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md ${
                      availabilityStatus === "soon"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    Available soon
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvailabilityStatus("busy")}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md ${
                      availabilityStatus === "busy"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    Busy
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-700">
                  Days you typically work
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {dayOrder.map((day) => {
                    const active = availableDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`inline-flex items-center justify-center rounded-md border px-2 py-1 text-[11px] font-medium ${
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-xs text-slate-500">
                You can update these details anytime as your availability
                changes.
              </p>
              <button
                type="submit"
                disabled={saving || !loaded}
                className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? "Saving…"
                  : existing
                  ? "Save changes"
                  : "Create profile"}
              </button>
            </div>
          </form>
        </section>

        <section
          aria-labelledby="jobs-heading"
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2
                id="jobs-heading"
                className="text-lg font-semibold text-slate-900"
              >
                Job requests
              </h2>
              <p className="text-sm text-slate-600">
                Review new job requests from landlords and update their status.
              </p>
            </div>
          </div>

          {jobsError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {jobsError}
            </div>
          )}

          {jobs.length === 0 && !jobsError ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              You don&apos;t have any job requests yet. When landlords request
              work, it will appear here.
            </div>
          ) : null}

          {jobs.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <li key={job.id} className="py-3 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900">
                        {job.title}
                      </span>
                      {job.description && (
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {job.description}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                        {job.budget != null && (
                          <span>Budget: ${job.budget.toFixed(0)}</span>
                        )}
                        {job.preferred_date && (
                          <span>
                            Preferred:{" "}
                            {new Date(job.preferred_date).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClasses(
                        job.status,
                      )}`}
                    >
                      {statusLabel(job.status)}
                    </span>
                  </div>
                  {job.landlord_note && (
                    <p className="text-xs text-slate-600">
                      Landlord note: “{job.landlord_note}”
                    </p>
                  )}
                  {job.contractor_note && (
                    <p className="text-xs text-slate-600">
                      Your note: “{job.contractor_note}”
                    </p>
                  )}
                  {job.status === "requested" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={updatingJobId === job.id}
                        onClick={() =>
                          updateJobStatus(job.id, { status: "accepted" })
                        }
                        className="inline-flex items-center rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {updatingJobId === job.id
                          ? "Updating..."
                          : "Accept job"}
                      </button>
                      <button
                        type="button"
                        disabled={updatingJobId === job.id}
                        onClick={() =>
                          updateJobStatus(job.id, { status: "declined" })
                        }
                        className="inline-flex items-center rounded-md bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 border border-red-100 hover:bg-red-100 disabled:opacity-60"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {job.status === "accepted" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={updatingJobId === job.id}
                        onClick={() =>
                          updateJobStatus(job.id, { status: "completed" })
                        }
                        className="inline-flex items-center rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {updatingJobId === job.id
                          ? "Updating..."
                          : "Mark completed"}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
