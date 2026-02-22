import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function HowItWorksPage() {
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
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">How It Works</h1>
        <p className="mt-3 text-slate-600 max-w-2xl leading-relaxed">
          Commercial Vacancy connects renters, landlords, and contractors so
          vacant commercial space gets used and maintenance gets done.
        </p>

        <section
          className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6"
          aria-label="Roles"
        >
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold text-slate-900">Renters</h2>
            <p className="mt-2 text-sm text-slate-600">
              Search and browse available spaces, submit maintenance requests
              for your rental, and track their status.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold text-slate-900">Landlords</h2>
            <p className="mt-2 text-sm text-slate-600">
              List your properties, view maintenance requests from renters, and
              assign jobs to contractors.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold text-slate-900">Contractors</h2>
            <p className="mt-2 text-sm text-slate-600">
              Manage your profile, view assigned jobs, and update progress and
              completion status.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
