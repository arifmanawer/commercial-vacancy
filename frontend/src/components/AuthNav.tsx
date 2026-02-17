"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthNav() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

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
    return (
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline-block text-[13px] text-slate-500 truncate max-w-[140px]">
          {user.email}
        </span>
        <Link
          href="/dashboard/renter"
          className={`hidden sm:inline-flex ${linkBase} ${btnOutline}`}
        >
          Dashboard
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className={`${linkBase} ${btnPrimary}`}
        >
          Sign Out
        </button>
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
