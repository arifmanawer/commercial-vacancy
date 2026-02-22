"use client";

import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import MapView from "../../components/MapView";

export default function MapPage() {
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

        <section className="mt-8">
          <MapView />
        </section>
      </main>

      <Footer />
    </div>
  );
}

