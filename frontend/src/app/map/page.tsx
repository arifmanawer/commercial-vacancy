"use client";

import { useState } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import MapView, {
  NearbyListingSummary,
} from "../../components/MapView";

export default function MapPage() {
  const [nearby, setNearby] = useState<NearbyListingSummary[]>([]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
        <Navbar />
      </header>

      <main className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
            Explore Properties on the Map
          </h1>
          <p className="mt-3 text-sm text-slate-600 max-w-2xl">
            See available spaces across New York City and compare neighborhoods
            at a glance.
          </p>
        </section>

        <section className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1.2fr)] gap-6">
          <div className="h-[480px]">
            <MapView onNearbyChange={setNearby} />
          </div>

          <aside className="h-[480px] rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Nearby within 5 miles
                </h2>
                <p className="text-[11px] text-slate-500">
                  Based on your current location
                </p>
              </div>
              <span className="inline-flex items-center justify-center rounded-full bg-slate-900/5 px-2.5 py-0.5 text-[11px] font-medium text-slate-800">
                {nearby.length} listings
              </span>
            </div>

            {nearby.length === 0 ? (
              <div className="flex-1 flex items-center justify-center px-4 text-xs text-slate-500 text-center">
                Move the map or allow location access to see spaces within 5
                miles of you.
              </div>
            ) : (
              <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {nearby.map((listing) => (
                  <li key={listing.id} className="px-4 py-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900 line-clamp-1">
                          {listing.title}
                        </p>
                        <p className="text-slate-600 line-clamp-1">
                          {listing.address}
                          {listing.city ? `, ${listing.city}` : ""}
                        </p>
                        <p className="mt-1 uppercase tracking-wide text-[10px] font-bold text-slate-500">
                          {listing.property_type}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] font-semibold text-slate-900">
                          {listing.distanceMiles.toFixed(1)} mi
                        </p>
                        <p className="text-[10px] text-slate-500">
                          away from you
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </section>
      </main>

      <Footer />
    </div>
  );
}

