import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function BrowsePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-100">
        <Navbar />
      </header>
      <main className="max-w-6xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 rounded mb-6"
        >
          ← Back to home
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Browse Spaces</h1>
        <p className="mt-2 text-slate-600 max-w-2xl">
          Search and filter available commercial spaces. Find venues by
          location, type, and budget. Listings will appear here once property
          management is wired up.
        </p>

        <section className="mt-10" aria-label="Filters">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">
            Filter results
          </h2>
          <div className="flex flex-wrap gap-3">
            <select
              aria-label="Location"
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option>Location</option>
            </select>
            <select
              aria-label="Type"
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option>Type</option>
            </select>
            <select
              aria-label="Price"
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option>Price</option>
            </select>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
