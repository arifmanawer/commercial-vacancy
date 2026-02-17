export default function Hero() {
  return (
    <section className="text-center py-12 sm:py-16 md:py-20">
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900">
        Find Your Perfect Space
      </h1>

      <p className="mt-4 sm:mt-5 text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
        Discover verified commercial spaces, flexible rentals, and event venues
        — all in one place.
      </p>

      <div className="mt-8 sm:mt-10 flex flex-wrap justify-center gap-3 sm:gap-4">
        <a
          href="/browse"
          className="inline-flex items-center px-6 py-3 rounded-xl bg-[var(--brand)] text-white font-semibold text-sm shadow-lg shadow-[var(--brand)]/20 hover:bg-[var(--brand-dark)] hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:ring-offset-2"
        >
          Browse Spaces
        </a>
        <a
          href="/list"
          className="inline-flex items-center px-6 py-3 rounded-xl border-2 border-[var(--brand)] text-[var(--brand)] font-semibold text-sm hover:bg-[var(--brand-muted)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:ring-offset-2"
        >
          List Your Space
        </a>
      </div>
    </section>
  );
}
