"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function LandlordPublicProfilePage() {
  const params = useParams<{ id: string | string[] }>();
  const landlordId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
        <Navbar />
      </header>
      <main className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <Link
          href="/browse"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-[var(--brand)] transition-colors mb-8"
        >
          ← Back to browse
        </Link>

        <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Landlord profile
          </h1>
          <p className="mt-3 text-slate-600 max-w-2xl">
            Public landlord profile page is now routed and ready. Full profile
            details and listings UI will be added in the next step.
          </p>
          {landlordId && (
            <p className="mt-4 text-xs text-slate-500">
              Profile ID: <span className="font-mono">{landlordId}</span>
            </p>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
