"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getApiUrl } from "@/lib/api";
import type { Contractor, ContractorAvailabilityStatus } from "@/types/database";

interface ApiContractorResponse {
  success?: boolean;
  data?: Contractor;
  error?: string;
}

function availabilityLabel(status: ContractorAvailabilityStatus) {
  switch (status) {
    case "available":
      return "Available now";
    case "soon":
      return "Available soon";
    default:
      return "Busy";
  }
}

function availabilityClass(status: ContractorAvailabilityStatus) {
  switch (status) {
    case "available":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "soon":
      return "bg-amber-50 text-amber-700 border-amber-100";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export default function ContractorProfilePage() {
  const params = useParams<{ id: string }>();
  const contractorId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contractorId) {
      setLoading(false);
      setError("Missing contractor id.");
      return;
    }

    let cancelled = false;

    async function loadContractor() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${getApiUrl()}/api/contractors/${contractorId}`);
        const body = (await res.json().catch(() => null)) as ApiContractorResponse | null;

        if (!res.ok || !body?.success || !body.data) {
          throw new Error(body?.error || "Failed to load contractor profile");
        }

        if (!cancelled) {
          setContractor(body.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load contractor profile",
          );
          setContractor(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadContractor();
    return () => {
      cancelled = true;
    };
  }, [contractorId]);

  const orderedDays = useMemo(() => {
    const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    if (!contractor) return [];
    return dayOrder.filter((day) => contractor.availability.available_days.includes(day));
  }, [contractor]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
        <Navbar />
      </header>

      <main className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
        <Link
          href="/dashboard/landlord/contractors"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-[var(--brand)] transition-colors"
        >
          ← Back to contractors
        </Link>

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading contractor profile...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {error}
          </div>
        ) : !contractor ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Contractor not found.
          </div>
        ) : (
          <>
          <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-5">
              <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                {contractor.profile_picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={contractor.profile_picture_url}
                    alt={contractor.business_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-semibold text-slate-600">
                    {contractor.business_name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                    {contractor.business_name}
                  </h1>
                  {contractor.is_verified && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-100">
                      Verified
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <span className="text-amber-500">★</span>
                    <span className="font-medium">{contractor.rating.toFixed(1)}</span>
                    <span className="text-slate-400">
                      ({contractor.total_jobs_completed} jobs)
                    </span>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="font-medium">${contractor.hourly_rate.toFixed(0)}/hr</span>
                  <span className="text-slate-300">|</span>
                  <span>Radius: {contractor.service_radius} miles</span>
                </div>

                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${availabilityClass(
                    contractor.availability.status,
                  )}`}
                >
                  {availabilityLabel(contractor.availability.status)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Services
              </h2>
              <div className="flex flex-wrap gap-2">
                {contractor.services.map((service) => (
                  <span
                    key={service}
                    className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200"
                  >
                    {service}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Typical work days
              </h2>
              {orderedDays.length > 0 ? (
                <p className="text-sm text-slate-700">{orderedDays.join(", ")}</p>
              ) : (
                <p className="text-sm text-slate-500">No days listed yet.</p>
              )}
            </div>
          </section>

          <section
            aria-labelledby="reviews-heading"
            className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
              <div>
                <h2
                  id="reviews-heading"
                  className="text-lg font-semibold text-slate-900"
                >
                  Reviews
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Feedback from landlords after completed work. This section is a
                  placeholder until reviews are stored and loaded from the backend.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No reviews to show yet
              </p>
              <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
                Example entries will list the reviewer, star rating, date, and
                comment once the feature is wired up.
              </p>
            </div>

            <ul className="space-y-3" aria-hidden="true">
              {[1, 2, 3].map((i) => (
                <li
                  key={i}
                  className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-slate-200/80" />
                    <div className="space-y-1 flex-1">
                      <div className="h-3 w-28 rounded bg-slate-200/80" />
                      <div className="h-2 w-20 rounded bg-slate-100" />
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <span key={j} className="text-slate-200 text-xs">
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="h-2 w-full rounded bg-slate-100" />
                  <div className="h-2 w-[80%] rounded bg-slate-100" />
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-400 text-center">
              Placeholder layout only — not real data.
            </p>
          </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
