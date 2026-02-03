import Link from "next/link";

export default function LookupCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <article className="flex flex-col gap-4 p-6 border border-slate-200 rounded-lg">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-slate-400 text-xs">Icon</span>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-slate-900">Rent a Space</h4>
            <p className="mt-1 text-slate-600">
              Find short-term and long-term commercial rentals.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <Link
            href="/browse"
            className="inline-block text-sm px-4 py-2 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            Explore Rentals
          </Link>
        </div>
      </article>

      <article className="flex flex-col gap-4 p-6 border border-slate-200 rounded-lg">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-slate-400 text-xs">Icon</span>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-slate-900">Host an Event</h4>
            <p className="mt-1 text-slate-600">
              Book venues for pop-ups, workshops, and corporate events.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <Link
            href="/browse"
            className="inline-block text-sm px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            Find Event Spaces
          </Link>
        </div>
      </article>
    </div>
  );
}
