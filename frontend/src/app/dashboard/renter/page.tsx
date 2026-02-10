import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DashboardProfile from "@/components/DashboardProfile";

export default function RenterDashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <Navbar />
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <DashboardProfile />

        <section className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Renter Dashboard
          </h1>
          <p className="text-slate-600 max-w-2xl">
            Track your upcoming bookings, manage saved spaces, and stay on top
            of messages from hosts.
          </p>
        </section>

        <section aria-labelledby="overview-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="overview-heading"
              className="text-lg font-semibold text-slate-900"
            >
              Overview
            </h2>
            <p className="text-xs text-slate-500">
              Summary of your current rental activity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Upcoming booking
              </p>
              <p className="text-sm font-semibold text-slate-900">
                No confirmed bookings
              </p>
              <p className="text-xs text-slate-500">
                Once you book a space, it will appear here.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Saved spaces
              </p>
              <p className="text-2xl font-bold text-slate-900">0</p>
              <p className="text-xs text-slate-500">
                Save spaces from Browse to compare and revisit later.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Messages
              </p>
              <p className="text-2xl font-bold text-slate-900">0</p>
              <p className="text-xs text-slate-500">
                Conversations with hosts will show up here.
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="bookings-heading"
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2
                id="bookings-heading"
                className="text-lg font-semibold text-slate-900"
              >
                Upcoming bookings
              </h2>
              <p className="text-sm text-slate-600">
                View and manage your reservations.
              </p>
            </div>
            <button
              type="button"
              className="hidden sm:inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              View all
            </button>
          </div>

          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            You don&apos;t have any upcoming bookings yet. When you reserve a
            space, the details will appear here.
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section
            aria-labelledby="saved-heading"
            className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2
                  id="saved-heading"
                  className="text-lg font-semibold text-slate-900"
                >
                  Saved spaces
                </h2>
                <p className="text-sm text-slate-600">
                  Quickly jump back to spaces you&apos;ve favorited.
                </p>
              </div>
            </div>

            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              You haven&apos;t saved any spaces yet. Browse listings and tap
              &quot;Save&quot; to add them here.
            </div>
          </section>

          <section
            aria-labelledby="messages-heading"
            className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2
                  id="messages-heading"
                  className="text-lg font-semibold text-slate-900"
                >
                  Messages
                </h2>
                <p className="text-sm text-slate-600">
                  Stay in touch with hosts and keep all your conversations in
                  one place.
                </p>
              </div>
            </div>

            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              No messages yet. When you send inquiries to hosts, your
              conversations will show up here.
            </div>
          </section>
        </section>
      </main>

      <Footer />
    </div>
  );
}
