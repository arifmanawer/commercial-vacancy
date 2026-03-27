import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const teamMembers = [
  {
    name: "Ahmed Hamouda",
    role: "Full-Stack Developer",
    linkedIn: "https://www.linkedin.com/in/ahmedhamouda1/",
    color: "from-teal-400 to-emerald-500",
  },
  {
    name: "Arif Manawer",
    role: "Full-Stack Developer",
    linkedIn: "https://www.linkedin.com/in/arif-manawer/",
    color: "from-blue-400 to-indigo-500",
  },
  {
    name: "Abdul Muswara",
    role: "Full-Stack Developer",
    linkedIn: "https://www.linkedin.com/in/abdul-ruhman-muswara-03433b279/",
    color: "from-violet-400 to-purple-500",
  },
  {
    name: "Muhammad Ahmed",
    role: "Full-Stack Developer",
    linkedIn: "https://www.linkedin.com/in/muhammad-a-67356b205/",
    color: "from-amber-400 to-orange-500",
  },
  {
    name: "Mohammad Kabir",
    role: "Full-Stack Developer",
    linkedIn: "https://www.linkedin.com/in/mohammad-kabir-196a5020a/",
    color: "from-rose-400 to-pink-500",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
        <Navbar />
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(13,79,79,0.4),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(13,79,79,0.25),transparent_50%)]" />
          <div className="relative max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
            <Link
              href="/"
              className="inline-flex items-center text-sm font-medium text-slate-400 hover:text-white transition-colors mb-8"
            >
              ← Back to home
            </Link>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight max-w-2xl">
              Putting vacant space
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-emerald-300">
                back to work.
              </span>
            </h1>
            <p className="mt-5 text-lg text-slate-300 max-w-xl leading-relaxed">
              We connect renters with spaces, landlords with tenants, and
              contractors with maintenance jobs — so NYC buildings stay active
              and well maintained.
            </p>
          </div>
        </section>

        {/* Story */}
        <section className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand)] mb-3">
              Our story
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Born from a senior-design project at CUNY
            </h2>
            <p className="mt-5 text-slate-600 leading-relaxed">
              Thousands of commercial storefronts sit empty across New York City
              while small businesses struggle to find affordable space. We built
              Smart Vacancy Reuse to bridge that gap — layering real NYC Open
              Data (vacancy registries, zoning maps, transit proximity) on top of
              a modern listing and messaging workflow so every stakeholder can
              make informed decisions faster.
            </p>
          </div>
        </section>

        {/* Team */}
        <section className="bg-slate-50/60 border-t border-b border-slate-200/80">
          <div className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <div className="text-center mb-12">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand)] mb-3">
                The team
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Meet the people behind the platform
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
              {teamMembers.map((member) => (
                <article
                  key={member.name}
                  className="group relative flex flex-col items-center text-center p-6 bg-white rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                >
                  <div
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${member.color} flex items-center justify-center text-xl font-bold text-white shadow-sm mb-4`}
                  >
                    {member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <h3 className="font-semibold text-slate-900">
                    {member.name}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">{member.role}</p>
                  {member.linkedIn !== "#" && (
                    <a
                      href={member.linkedIn}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-[#0A66C2] transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                      </svg>
                      LinkedIn
                    </a>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-lg mx-auto text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand)] mb-3">
              Get in touch
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Questions or feedback?
            </h2>
            <p className="mt-4 text-slate-600">
              Whether you want to list a space, find one, or explore partnership
              opportunities — we&apos;d love to hear from you.
            </p>
            <a
              href="mailto:team@smartvacancy.nyc"
              className="mt-6 inline-flex items-center gap-2.5 rounded-xl bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800 transition-colors shadow-sm"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              team@smartvacancy.nyc
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
