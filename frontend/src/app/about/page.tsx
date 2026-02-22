import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function AboutPage() {
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
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">About</h1>
        <p className="mt-3 text-slate-600 max-w-2xl leading-relaxed">
          We help put vacant commercial space to work—connecting renters with
          spaces, landlords with tenants, and contractors with maintenance jobs
          so NYC buildings stay active and well maintained.
        </p>

        <section className="mt-12" aria-labelledby="story-heading">
          <h2
            id="story-heading"
            className="text-lg font-semibold text-slate-900 mb-2"
          >
            Our story
          </h2>
          <p className="text-slate-600">
            Commercial Vacancy started from a simple idea: make it easier to
            find, list, and maintain commercial space. More details coming
            soon.
          </p>
        </section>

        <section className="mt-10" aria-labelledby="contact-heading">
          <h2
            id="contact-heading"
            className="text-lg font-semibold text-slate-900 mb-2"
          >
            Contact
          </h2>
          <p className="text-slate-600 mb-4">
            Have questions or feedback? Reach out to our team.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)] transition-colors"
          >
            View team & contact info →
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
