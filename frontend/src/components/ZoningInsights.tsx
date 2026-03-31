"use client";

import { useEffect, useState } from "react";

const PLUTO_BASE = "https://data.cityofnewyork.us/resource/64uk-42ks.json";

const LAND_USE_LABELS: Record<string, string> = {
  "1": "One & Two Family",
  "2": "Multi-Family Walk-Up",
  "3": "Multi-Family Elevator",
  "4": "Mixed Residential & Commercial",
  "5": "Commercial & Office",
  "6": "Industrial & Manufacturing",
  "7": "Transportation & Utility",
  "8": "Public Facilities",
  "9": "Open Space & Recreation",
  "10": "Parking Facilities",
  "11": "Vacant Land",
};

type ZoningStats = {
  topZones: { zone: string; count: number }[];
  landUse: { code: string; label: string; count: number }[];
  avgFloors: number | null;
  avgYearBuilt: number | null;
  totalLots: number;
};

export default function ZoningInsights({ zipCode }: { zipCode: string }) {
  const [stats, setStats] = useState<ZoningStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!zipCode) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        const [zonesRes, landUseRes, buildingRes] = await Promise.all([
          fetch(
            `${PLUTO_BASE}?$select=zonedist1,count(*) as count` +
              `&$where=zipcode='${zipCode}' AND zonedist1 IS NOT NULL` +
              `&$group=zonedist1&$order=count DESC&$limit=5`,
          ),
          fetch(
            `${PLUTO_BASE}?$select=landuse,count(*) as count` +
              `&$where=zipcode='${zipCode}' AND landuse IS NOT NULL` +
              `&$group=landuse&$order=count DESC&$limit=6`,
          ),
          fetch(
            `${PLUTO_BASE}?$select=avg(numfloors) as avg_floors,avg(yearbuilt) as avg_year,count(*) as total` +
              `&$where=zipcode='${zipCode}' AND numfloors>0 AND yearbuilt>1800`,
          ),
        ]);

        if (!zonesRes.ok) throw new Error("Failed to fetch zoning data");

        const zones = (await zonesRes.json()) as {
          zonedist1: string;
          count: string;
        }[];
        const landUseRows = landUseRes.ok
          ? ((await landUseRes.json()) as { landuse: string; count: string }[])
          : [];
        const buildingRows = buildingRes.ok
          ? ((await buildingRes.json()) as {
              avg_floors: string;
              avg_year: string;
              total: string;
            }[])
          : [];

        if (cancelled) return;

        const totalLots = buildingRows[0]
          ? parseInt(buildingRows[0].total, 10) || 0
          : 0;

        if (zones.length === 0 && totalLots === 0) {
          setStats(null);
          setLoading(false);
          return;
        }

        const avgFloors = buildingRows[0]?.avg_floors
          ? Math.round(parseFloat(buildingRows[0].avg_floors) * 10) / 10
          : null;
        const avgYear = buildingRows[0]?.avg_year
          ? Math.round(parseFloat(buildingRows[0].avg_year))
          : null;

        setStats({
          topZones: zones.map((z) => ({
            zone: z.zonedist1,
            count: parseInt(z.count, 10) || 0,
          })),
          landUse: landUseRows
            .filter((r) => r.landuse)
            .map((r) => ({
              code: r.landuse,
              label: LAND_USE_LABELS[r.landuse] ?? `Type ${r.landuse}`,
              count: parseInt(r.count, 10) || 0,
            })),
          avgFloors,
          avgYearBuilt: avgYear,
          totalLots,
        });
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [zipCode]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-40 bg-slate-200 rounded" />
          <div className="h-4 w-full bg-slate-200 rounded" />
          <div className="h-16 w-full bg-slate-200 rounded" />
        </div>
      </section>
    );
  }

  if (!stats) return null;

  const commercialPct =
    stats.landUse.length > 0
      ? Math.round(
          (stats.landUse
            .filter((l) => ["4", "5"].includes(l.code))
            .reduce((s, l) => s + l.count, 0) /
            stats.landUse.reduce((s, l) => s + l.count, 0)) *
            100,
        )
      : null;

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
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <h2 className="text-lg font-semibold text-slate-900">
            Zoning & Land Use
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          NYC PLUTO dataset — property characteristics for zip {zipCode}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
          <p className="text-2xl font-bold text-slate-900">
            {stats.totalLots.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Tax lots</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
          <p className="text-2xl font-bold text-slate-900">
            {stats.avgFloors ?? "—"}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Avg. floors</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
          <p className="text-2xl font-bold text-slate-900">
            {stats.avgYearBuilt ?? "—"}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Avg. year built</p>
        </div>
      </div>

      {stats.topZones.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">
            Top zoning districts
          </p>
          <div className="flex flex-wrap gap-1.5">
            {stats.topZones.map((z) => (
              <span
                key={z.zone}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700"
              >
                {z.zone}
                <span className="ml-1.5 text-slate-400">{z.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {stats.landUse.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">
            Land use breakdown
            {commercialPct !== null && (
              <span className="ml-1 text-slate-400">
                · {commercialPct}% commercial/mixed-use
              </span>
            )}
          </p>
          <div className="space-y-1.5">
            {stats.landUse.slice(0, 4).map((l) => {
              const pct = Math.round(
                (l.count / stats.landUse.reduce((s, x) => s + x.count, 0)) *
                  100,
              );
              return (
                <div key={l.code} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="text-slate-700 truncate">{l.label}</span>
                      <span className="text-slate-400 ml-2">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
        Source: NYC Dept. of City Planning via{" "}
        <a
          href="https://data.cityofnewyork.us/City-Government/Primary-Land-Use-Tax-Lot-Output-PLUTO-/64uk-42ks"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-600"
        >
          NYC Open Data (PLUTO)
        </a>
      </p>
    </section>
  );
}
