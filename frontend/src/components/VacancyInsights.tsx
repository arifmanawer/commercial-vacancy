"use client";

import { useEffect, useState } from "react";

const NYC_OPEN_DATA_BASE =
  "https://data.cityofnewyork.us/resource/92iy-9c3n.json";

type VacancyStats = {
  total: number;
  vacant: number;
  rate: number;
  neighborhood: string | null;
  topActivities: { activity: string; count: number }[];
};

export default function VacancyInsights({ zipCode }: { zipCode: string }) {
  const [stats, setStats] = useState<VacancyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!zipCode) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchVacancyData() {
      setLoading(true);
      setError(null);

      try {
        const [vacancyRes, activitiesRes, neighborhoodRes] = await Promise.all([
          fetch(
            `${NYC_OPEN_DATA_BASE}?$select=vacant_on_12_31,count(*) as count` +
              `&$where=zip_code='${zipCode}'&$group=vacant_on_12_31`,
          ),
          fetch(
            `${NYC_OPEN_DATA_BASE}?$select=primary_business_activity,count(*) as count` +
              `&$where=zip_code='${zipCode}' AND vacant_on_12_31='YES'` +
              `&$group=primary_business_activity&$order=count DESC&$limit=5`,
          ),
          fetch(
            `${NYC_OPEN_DATA_BASE}?$select=nbhd&$where=zip_code='${zipCode}' AND nbhd IS NOT NULL&$limit=1`,
          ),
        ]);

        if (!vacancyRes.ok) throw new Error("Failed to fetch vacancy data");

        const vacancyRows = (await vacancyRes.json()) as {
          vacant_on_12_31: string;
          count: string;
        }[];
        const activityRows = activitiesRes.ok
          ? ((await activitiesRes.json()) as {
              primary_business_activity: string;
              count: string;
            }[])
          : [];
        const neighborhoodRows = neighborhoodRes.ok
          ? ((await neighborhoodRes.json()) as { nbhd: string }[])
          : [];

        let total = 0;
        let vacant = 0;
        for (const row of vacancyRows) {
          const c = parseInt(row.count, 10) || 0;
          total += c;
          if (row.vacant_on_12_31 === "YES") vacant = c;
        }

        if (cancelled) return;

        if (total === 0) {
          setStats(null);
          setLoading(false);
          return;
        }

        setStats({
          total,
          vacant,
          rate: Math.round((vacant / total) * 1000) / 10,
          neighborhood: neighborhoodRows[0]?.nbhd ?? null,
          topActivities: activityRows
            .filter((r) => r.primary_business_activity)
            .map((r) => ({
              activity: r.primary_business_activity,
              count: parseInt(r.count, 10) || 0,
            })),
        });
      } catch {
        if (!cancelled) setError("Unable to load NYC vacancy data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchVacancyData();
    return () => {
      cancelled = true;
    };
  }, [zipCode]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-48 bg-slate-200 rounded" />
          <div className="h-4 w-full bg-slate-200 rounded" />
          <div className="h-16 w-full bg-slate-200 rounded" />
        </div>
      </section>
    );
  }

  if (error || !stats) return null;

  const rateColor =
    stats.rate > 15
      ? "text-red-600"
      : stats.rate > 8
        ? "text-amber-600"
        : "text-emerald-600";

  return (
    <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <svg
            className="w-4 h-4 text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <h2 className="text-lg font-semibold text-slate-900">
            Neighborhood Vacancy Insights
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          NYC Open Data — Storefronts Reported Vacant or Not (Local Law 157)
          {stats.neighborhood && (
            <span className="ml-1">
              · <span className="font-medium text-slate-700">{stats.neighborhood}</span>
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
          <p className="text-2xl font-bold text-slate-900">
            {stats.total.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Registered storefronts
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
          <p className="text-2xl font-bold text-slate-900">
            {stats.vacant.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Reported vacant
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
          <p className={`text-2xl font-bold ${rateColor}`}>
            {stats.rate}%
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Vacancy rate</p>
        </div>
      </div>

      {stats.topActivities.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">
            Previously occupied by
          </p>
          <div className="flex flex-wrap gap-1.5">
            {stats.topActivities.map((a) => (
              <span
                key={a.activity}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700"
              >
                {a.activity}
                <span className="ml-1.5 text-slate-400">{a.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
        Source: NYC Dept. of Finance via{" "}
        <a
          href="https://data.cityofnewyork.us/City-Government/Storefronts-Reported-Vacant-or-Not/92iy-9c3n"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-600"
        >
          NYC Open Data
        </a>
      </p>
    </section>
  );
}
