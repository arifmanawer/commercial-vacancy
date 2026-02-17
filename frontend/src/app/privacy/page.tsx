import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function PrivacyPage() {
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
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
          Privacy Policy
        </h1>
        <p className="mt-3 text-slate-600 max-w-2xl leading-relaxed">
          Privacy policy for Smart Vacancy Reuse Platform. This page will be
          updated with our data practices when the platform launches.
        </p>
        <p className="mt-6 text-slate-500 text-sm">
          Last updated: {new Date().toLocaleDateString("en-US")}
        </p>
      </main>
      <Footer />
    </div>
  );
}
