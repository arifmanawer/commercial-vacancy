"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import AuthNav from "./AuthNav";
import { useAuth } from "@/contexts/AuthContext";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/list", label: "List Space" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/about", label: "About" },
  { href: "/map", label: "Map" },
  { href: "/contact", label: "Contact" },
];

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isHome = href === "/";
  const isActive = isHome
    ? pathname === "/"
    : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`
        text-[13px] font-medium transition-all duration-150 px-2.5 py-1.5 rounded-md
        focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:ring-offset-1
        ${isActive
          ? "text-[var(--brand)] bg-[var(--brand-muted)]"
          : "text-slate-600 hover:text-[var(--brand)] hover:bg-slate-50/80"
        }
      `}
    >
      {label}
    </Link>
  );
}

export default function Navbar() {
  const { isLandlord, loading } = useAuth();

  return (
    <nav className="relative h-[var(--nav-height)] max-w-[var(--container)] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
      <div className="flex items-center justify-between w-full min-w-0">
        {/* Logo + desktop nav */}
        <div className="flex items-center gap-8 lg:gap-10 min-w-0">
          <Link
            href="/"
            className="flex items-center shrink-0 py-1 -ml-1"
            aria-label="Home"
          >
            <Image
              src="/logo.png"
              alt="Smart Vacancy Reuse Platform"
              width={40}
              height={40}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>

          <div className="hidden md:flex gap-8 ml-6">
            <Link
              href="/browse"
              className="text-sm text-slate-700 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 rounded"
            >
              Browse Spaces
            </Link>
            {!loading && isLandlord && (
              <>
                <Link
                  href="/dashboard/landlord"
                  className="text-sm text-slate-700 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 rounded"
                >
                  My Listings
                </Link>
                <Link
                  href="/list"
                  className="text-sm text-slate-700 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 rounded"
                >
                  Create Listing
                </Link>
              </>
            )}
            <Link
              href="/how-it-works"
              className="text-sm text-slate-700 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 rounded"
            >
              How It Works
            </Link>
            <Link
              href="/about"
              className="text-sm text-slate-700 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 rounded"
            >
              About
            </Link>
            <Link
              href="/map"
              className="text-sm text-slate-700 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 rounded"
            >
              Map
            </Link>
          </div>
        </div>

        {/* Auth + mobile menu */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 -mr-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-expanded={mobileOpen}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <AuthNav />
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="lg:hidden absolute top-full left-4 right-4 mt-2 bg-white rounded-xl border border-slate-200/80 shadow-lg py-2 z-50">
          <div className="flex flex-col max-h-[70vh] overflow-y-auto">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block"
              >
                <NavLink href={link.href} label={link.label} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
