import Link from "next/link";

export default function LookupCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
      <article className="group flex flex-col gap-4 p-5 sm:p-6 md:p-7 bg-white border border-slate-200/70 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md hover:border-[var(--brand)]/20 transition-all duration-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[var(--brand-muted)] rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--brand)]/15 transition-colors">
            <span className="text-[var(--brand)] text-lg font-bold">🏢</span>
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-900">Rent a Space</h4>
            <p className="mt-1.5 text-slate-600 leading-relaxed">
              Find short-term and long-term commercial rentals.
            </p>
          </div>
        </div>
        <div className="mt-auto pt-1">
          <Link
            href="/browse"
            className="inline-flex items-center text-sm font-medium px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:border-[var(--brand)] hover:text-[var(--brand)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
          >
            Explore Rentals →
          </Link>
        </div>
      </article>

      <article className="group flex flex-col gap-4 p-5 sm:p-6 md:p-7 bg-white border border-slate-200/70 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md hover:border-[var(--brand)]/20 transition-all duration-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[var(--brand-muted)] rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--brand)]/15 transition-colors">
            <span className="text-[var(--brand)] text-lg font-bold">🎉</span>
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-900">Host an Event</h4>
            <p className="mt-1.5 text-slate-600 leading-relaxed">
              Book venues for pop-ups, workshops, and corporate events.
            </p>
          </div>
        </div>
        <div className="mt-auto pt-1">
          <Link
            href="/browse"
            className="inline-flex items-center text-sm font-semibold px-4 py-2 rounded-lg bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)] shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
          >
            Find Event Spaces →
          </Link>
        </div>
      </article>
    </div>
  );
}
