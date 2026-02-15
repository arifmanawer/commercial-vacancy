import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function AboutPage() {
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
        <h1 className="text-3xl font-bold text-slate-900">About</h1>
        <p className="mt-2 text-slate-600 max-w-2xl">
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
          <p className="text-slate-600">
            Have questions or feedback? Reach out—we&apos;ll add contact details
            here soon.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
