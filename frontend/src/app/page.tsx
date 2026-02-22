import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import LookupCards from "../components/LookupCards";
import Features from "../components/Features";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
        <Navbar />
      </header>

      <main className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <Hero />

        <section className="mt-[var(--section-gap)]">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-900">
            What are you looking for?
          </h2>
          <p className="mt-3 text-center text-slate-600 max-w-xl mx-auto leading-relaxed">
            Whether you need a space to rent or a venue for your next event
          </p>
          <div className="mt-12">
            <LookupCards />
          </div>
        </section>

        <section className="mt-[var(--section-gap)]">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-900">
            Why Choose Us
          </h2>
          <p className="mt-3 text-center text-slate-600 max-w-xl mx-auto leading-relaxed">
            A trusted platform for commercial space discovery and booking
          </p>
          <div className="mt-12">
            <Features />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
