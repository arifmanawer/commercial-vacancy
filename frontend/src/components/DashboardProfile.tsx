"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardProfile() {
  const { user, profile, isLandlord, isContractor, loading } = useAuth();

  if (loading || !user) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 animate-pulse">
        <div className="h-14 w-14 rounded-full bg-slate-100" />
        <div className="mt-4 h-5 w-32 bg-slate-100 rounded" />
        <div className="mt-2 h-4 w-48 bg-slate-100 rounded" />
      </section>
    );
  }

  const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
  const memberSince = profile?.created_at || user.created_at
    ? new Date(profile?.created_at || user.created_at!).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  return (
    <section
      aria-labelledby="profile-heading"
      className="rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 id="profile-heading" className="sr-only">
        Profile
      </h2>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-500 text-lg font-semibold">
          {name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-lg font-semibold text-slate-900 truncate">{name}</p>
          <p className="text-sm text-slate-600 truncate">{user.email}</p>
          <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 mt-2">
            <div>
              <span className="sr-only">Member since</span>
              <span>Member since {memberSince}</span>
            </div>
          </dl>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-1 rounded bg-slate-100 text-slate-600">
            {["Renter", isLandlord && "Landlord", isContractor && "Contractor"]
              .filter(Boolean)
              .join(" + ")}
          </span>
          <Link
            href="/profile"
            className="self-start sm:self-center shrink-0 text-sm px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            Profile
          </Link>
        </div>
      </div>
    </section>
  );
}
