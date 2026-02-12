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

  if (loading) {
    return (
      <div className="ml-auto flex items-center gap-3">
        <span className="text-sm text-slate-500">Loading...</span>
      </div>
    );
  }

  if (user) {
    return (
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden sm:inline-block text-sm text-slate-600 truncate max-w-[160px]">
          {user.email}
        </span>
        <Link
          href="/dashboard/renter"
          className="hidden sm:inline-block text-sm px-4 py-2 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          Dashboard
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="text-sm px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="ml-auto flex items-center gap-3">
      <Link
        href="/signin"
        className="hidden sm:inline-block text-sm px-4 py-2 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
      >
        Sign In
      </Link>
      <Link
        href="/signup"
        className="inline-flex items-center text-sm px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
      >
        Sign Up
      </Link>
    </div>
  );
}
