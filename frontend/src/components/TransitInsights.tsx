"use client";

import { useEffect, useState } from "react";

const MTA_STATIONS_URL = "https://data.ny.gov/resource/39hk-dx4f.json";

type NearbyStation = {
  name: string;
  routes: string;
  distance: number;
  structure: string;
};

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function kmToMiles(km: number): number {
  return km * 0.621371;
}

function formatDistance(miles: number): string {
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  return `${miles.toFixed(2)} mi`;
}

export default function TransitInsights({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}) {
  const [stations, setStations] = useState<NearbyStation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lat || !lng) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchStations() {
      setLoading(true);
      try {
        const res = await fetch(
          `${MTA_STATIONS_URL}?$select=stop_name,daytime_routes,gtfs_latitude,gtfs_longitude,structure&$limit=500`,
        );
        if (!res.ok) throw new Error("Failed to fetch station data");

        const rows = (await res.json()) as {
          stop_name: string;
          daytime_routes: string;
          gtfs_latitude: string;
          gtfs_longitude: string;
          structure: string;
        }[];

        if (cancelled) return;

        const withDistance = rows
          .filter((r) => r.gtfs_latitude && r.gtfs_longitude)
          .map((r) => ({
            name: r.stop_name,
            routes: r.daytime_routes,
            structure: r.structure ?? "",
            distance: kmToMiles(
              haversineKm(
                lat,
                lng,
                parseFloat(r.gtfs_latitude),
                parseFloat(r.gtfs_longitude),
              ),
            ),
          }))
          .sort((a, b) => a.distance - b.distance);

        const seen = new Set<string>();
        const unique: NearbyStation[] = [];
        for (const s of withDistance) {
          if (!seen.has(s.name) && unique.length < 5) {
            seen.add(s.name);
            unique.push(s);
          }
        }

        setStations(unique);
      } catch {
        if (!cancelled) setStations([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStations();
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-36 bg-slate-200 rounded" />
          <div className="h-4 w-full bg-slate-200 rounded" />
          <div className="h-16 w-full bg-slate-200 rounded" />
        </div>
      </section>
    );
  }

  if (stations.length === 0) return null;

  const closestMiles = stations[0]?.distance ?? 0;
  const walkability =
    closestMiles <= 0.15
      ? { label: "Excellent transit access", color: "text-emerald-600" }
      : closestMiles <= 0.3
        ? { label: "Good transit access", color: "text-emerald-600" }
        : closestMiles <= 0.5
          ? { label: "Moderate transit access", color: "text-amber-600" }
          : { label: "Limited transit access", color: "text-red-600" };

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
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
          <h2 className="text-lg font-semibold text-slate-900">
            Nearby Transit
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          MTA subway stations closest to this listing
          <span className={`ml-2 font-medium ${walkability.color}`}>
            · {walkability.label}
          </span>
        </p>
      </div>

      <div className="space-y-2">
        {stations.map((s, i) => (
          <div
            key={`${s.name}-${i}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {s.name}
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {s.routes.split(" ").map((route) => (
                  <span
                    key={route}
                    className="inline-flex items-center justify-center h-5 min-w-[1.25rem] rounded-full bg-slate-900 text-[10px] font-bold text-white px-1"
                  >
                    {route}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-slate-900">
                {formatDistance(s.distance)}
              </p>
              <p className="text-[10px] text-slate-400">{s.structure}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
        Source: MTA via{" "}
        <a
          href="https://data.ny.gov/Transportation/MTA-Subway-Stations/39hk-dx4f"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-600"
        >
          NY Open Data
        </a>
      </p>
    </section>
  );
}
