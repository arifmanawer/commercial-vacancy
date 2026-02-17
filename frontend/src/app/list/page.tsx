import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function ListPage() {
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
        <h1 className="text-3xl font-bold text-slate-900">List Your Space</h1>
        <p className="mt-2 text-slate-600">
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
          <Link
            href="/signup"
            className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            Sign up to list your space
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
