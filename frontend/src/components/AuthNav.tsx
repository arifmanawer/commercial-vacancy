"use client";

import { useRef, useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthNav() {
  const router = useRouter();
  const { user, loading, signOut, isLandlord, isContractor, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    await signOut();
    router.push("/");
    router.refresh();
  };

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open]);

  const linkBase =
    "text-[13px] font-medium transition-all duration-150 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:ring-offset-1";
  const btnOutline =
    "px-3 py-1.5 border border-slate-200 text-slate-700 hover:border-[var(--brand)] hover:text-[var(--brand)]";
  const btnPrimary =
    "px-3 py-1.5 bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]";

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[13px] text-slate-400">Loading...</span>
      </div>
    );
  }

  if (user) {
    const fullName =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      profile?.username ||
      user.user_metadata?.full_name ||
      user.email ||
      "Account";
    const initials = String(fullName)
      .split(/\s+/)
      .map((s: string) => s[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

    const dashboardLinks: { label: string; href: string }[] = [
      { label: "Renter", href: "/dashboard/renter" },
      ...(isLandlord ? [{ label: "Landlord", href: "/dashboard/landlord" }] : []),
      ...(isContractor ? [{ label: "Contractor", href: "/dashboard/contractor" }] : []),
    ];

    return (
      <div className="relative flex items-center gap-2" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
          aria-expanded={open}
          aria-haspopup="true"
          aria-label="Account menu"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/10 text-xs font-semibold text-[var(--brand)] overflow-hidden">
            {profile?.profile_picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.profile_picture_url}
                alt={typeof fullName === "string" ? fullName : "Account"}
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </span>
          <span className="hidden max-w-[120px] truncate text-[13px] text-slate-700 sm:inline-block">
            {typeof fullName === "string" ? fullName.split("@")[0] : fullName}
          </span>
          <svg
            className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div
            className="absolute right-0 top-full z-50 mt-1.5 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            role="menu"
          >
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="truncate text-xs font-medium text-slate-900">
                {fullName}
              </p>
              <p className="truncate text-[11px] text-slate-500">{user.email}</p>
            </div>
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50"
              role="menuitem"
            >
              Profile
            </Link>
            <div className="border-t border-slate-100">
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Dashboard
              </p>
              {dashboardLinks.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-1.5 pl-4 text-[13px] text-slate-700 hover:bg-slate-50"
                  role="menuitem"
                >
                  {label}
                </Link>
              ))}
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleSignOut}
              className="block w-full px-3 py-2 text-left text-[13px] font-medium text-red-600 hover:bg-red-50"
              role="menuitem"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/signin" className={`hidden sm:inline-flex ${linkBase} ${btnOutline}`}>
        Sign In
      </Link>
      <Link href="/signup" className={`inline-flex ${linkBase} ${btnPrimary}`}>
        Sign Up
      </Link>
    </div>
  );
}
