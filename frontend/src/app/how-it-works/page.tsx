import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function HowItWorksPage() {
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
        <h1 className="text-3xl font-bold text-slate-900">How It Works</h1>
        <p className="mt-2 text-slate-600 max-w-2xl">
          Commercial Vacancy connects renters, landlords, and contractors so
          vacant commercial space gets used and maintenance gets done.
        </p>

        <section
          className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6"
          aria-label="Roles"
        >
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Renters</h2>
            <p className="mt-2 text-sm text-slate-600">
              Search and browse available spaces, submit maintenance requests
              for your rental, and track their status.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Landlords</h2>
            <p className="mt-2 text-sm text-slate-600">
              List your properties, view maintenance requests from renters, and
              assign jobs to contractors.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-5">
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
