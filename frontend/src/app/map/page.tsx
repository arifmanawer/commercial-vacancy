"use client";

import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import MapView from "../../components/MapView";

export default function MapPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-100">
        <Navbar />
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <section>
          <h1 className="text-3xl font-semibold text-slate-900">
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

