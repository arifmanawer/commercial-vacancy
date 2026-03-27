import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const teamMembers = [
  {
    name: "Ahmed Hamouda",
    role: "Full-Stack Developer",
    linkedIn: "https://www.linkedin.com/in/ahmedhamouda1/",
  },
  {
    name: "Abdul Muswara",
    role: "Full-Stack Developer",
    linkedIn:
      "https://www.linkedin.com/in/abdul-ruhman-muswara-03433b279/",
  },
  {
    name: "Mohammad Kabir",
    role: "Full-Stack Developer",
    linkedIn: "https://www.linkedin.com/in/mohammad-kabir-196a5020a/",
  },
];

export default function AboutPage() {
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
          About
        </h1>
        <p className="mt-3 text-slate-600 max-w-2xl leading-relaxed">
          We help put vacant commercial space to work — connecting renters with
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
          <p className="text-slate-600 max-w-2xl leading-relaxed">
            Smart Vacancy Reuse started as a senior-design project at CUNY, born
            from a simple observation: thousands of commercial storefronts sit
            empty across New York City while small businesses struggle to find
            affordable space. We built a platform that layers real NYC Open Data
            — vacancy registries, zoning maps, transit proximity — on top of a
            modern listing and messaging workflow so every stakeholder can make
            informed decisions faster.
          </p>
        </section>

        <section className="mt-14" aria-labelledby="team-heading">
          <h2
            id="team-heading"
            className="text-xl font-bold text-slate-900 mb-6"
          >
            Meet the Team
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamMembers.map((member) => (
              <article
                key={member.linkedIn}
                className="flex flex-col p-5 sm:p-6 bg-white border border-slate-200/70 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-lg font-bold text-slate-500 mb-4">
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <h3 className="font-bold text-slate-900">{member.name}</h3>
                <p className="text-sm text-slate-600 mt-0.5">{member.role}</p>
                <a
                  href={member.linkedIn}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)] transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                  Connect on LinkedIn
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-14 p-5 sm:p-6 bg-white border border-slate-200/70 rounded-xl sm:rounded-2xl shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-2">
            Get in touch
          </h2>
          <p className="text-slate-600 mb-4">
            Have questions about listing your space, booking a venue, or
            partnership opportunities? Drop us a line.
          </p>
          <a
            href="mailto:team@smartvacancy.nyc"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)] transition-colors"
          >
            <svg
              className="w-5 h-5"
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
        </section>
      </main>
      <Footer />
    </div>
  );
}
