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
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-lg mb-3">🔍</div>
            <h2 className="text-lg font-semibold text-slate-900">Renters</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>Browse and search available commercial spaces</li>
              <li>Save listings and request tours or contact landlords</li>
              <li>View neighborhood data — vacancy rates, zoning, and transit</li>
              <li>Message landlords directly through the platform</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-lg mb-3">🏢</div>
            <h2 className="text-lg font-semibold text-slate-900">Landlords</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>List properties with photos, pricing, and details</li>
              <li>Review and respond to tour and contact requests</li>
              <li>Search for contractors and request maintenance jobs</li>
              <li>Track job status and communicate with all parties</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-lg mb-3">🔧</div>
            <h2 className="text-lg font-semibold text-slate-900">Contractors</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>Create a profile with services, rates, and availability</li>
              <li>Receive job requests from landlords</li>
              <li>Accept, decline, or mark jobs as completed</li>
              <li>Build reputation through reviews from landlords</li>
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
