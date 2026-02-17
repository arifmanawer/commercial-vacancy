import Link from "next/link";
import Image from "next/image";

const exploreLinks = [
  { href: "/browse", label: "Browse Spaces" },
  { href: "/map", label: "Explore Map" },
  { href: "/list", label: "List Your Space" },
];

const companyLinks = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const linkClass =
  "text-sm text-slate-600 hover:text-[var(--brand)] transition-colors duration-150";

export default function Footer() {
  return (
    <footer className="mt-[var(--section-gap)] border-t border-slate-200/80 bg-slate-50/60">
      <div className="max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-12 md:gap-16">
          <div className="flex flex-col gap-4 max-w-sm">
            <Link href="/" className="shrink-0 w-fit">
              <Image
                src="/logo.png"
                alt="Smart Vacancy Reuse Platform"
                width={36}
                height={36}
                className="h-9 w-auto object-contain opacity-90"
              />
            </Link>
            <p className="text-sm text-slate-600 leading-relaxed">
              Connecting vacant commercial spaces with renters, event hosts, and
              landlords across NYC.
            </p>
          </div>

          <div className="flex flex-wrap gap-12 md:gap-16">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
                Explore
              </h3>
              <ul className="space-y-3">
                {exploreLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
                Company
              </h3>
              <ul className="space-y-3">
                {companyLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} Smart Vacancy Reuse Platform</span>
          <div className="flex gap-8">
            <Link href="/terms" className={linkClass}>
              Terms
            </Link>
            <Link href="/privacy" className={linkClass}>
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
