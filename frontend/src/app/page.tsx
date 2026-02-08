import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import LookupCards from "../components/LookupCards";
import Features from "../components/Features";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-100">
        <Navbar />
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <Hero />

        <section className="mt-16 border-t border-slate-100 pt-12">
          <h2 className="text-2xl font-semibold text-center text-slate-900">
            What are you looking for?
          </h2>
          <div className="mt-8">
            <LookupCards />
          </div>
        </section>

        <section className="mt-16 border-t border-slate-100 pt-12">
          <h2 className="text-2xl font-semibold text-center text-slate-900">Why Choose Us</h2>
          <div className="mt-8">
            <Features />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
