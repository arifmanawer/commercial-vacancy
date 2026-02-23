
"use client";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import CreateListingForm from "@/components/CreateListingForm";

export default function ListPage() {
  const { user, isLandlord, loading } = useAuth();

  function handleCreateListing(data: unknown) {
    // TODO: Connect to backend API
    alert("Listing created! (stub)\n" + JSON.stringify(data, null, 2));
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
        <Navbar />
      </header>
      <main className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-[#0d4f4f] transition-colors mb-8"
        >
          ← Back to home
        </Link>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">List Your Space</h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          Landlords can add property listings here. The form will be connected
          when the properties API is ready.
        </p>

        <section className="mt-10" aria-labelledby="what-you-need-heading">
          <h2
            id="what-you-need-heading"
            className="text-lg font-semibold text-slate-900 mb-3"
          >
            What you&apos;ll need
          </h2>
          <ul className="list-disc list-inside text-slate-600 space-y-1">
            <li>Property address and basic details</li>
            <li>Photos of the space</li>
            <li>Description and amenities</li>
            <li>Availability and pricing</li>
          </ul>
        </section>

        <div className="mt-8">
          {loading ? (
            <div>Loading...</div>
          ) : user ? (
            isLandlord ? (
              <div className="bg-white rounded-xl shadow p-6 max-w-2xl">
                <CreateListingForm onSubmit={handleCreateListing} />
              </div>
            ) : (
              <Link
                href="/profile"
                className="inline-flex items-center rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
              >
                Become a landlord to list your space
              </Link>
            )
          ) : (
            <Link
              href="/signup"
              className="inline-flex items-center rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
            >
              Sign up to list your space
            </Link>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
