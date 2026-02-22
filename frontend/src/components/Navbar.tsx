"use client";

import Link from "next/link";
import AuthNav from "./AuthNav";
import { useAuth } from "@/contexts/AuthContext";

export default function Navbar() {
  const { isLandlord, loading } = useAuth();

  return (
    <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6 w-full">
        <div className="flex items-center gap-6 w-full md:w-auto">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="inline-block border border-slate-200 px-2 py-1 text-sm font-medium rounded">
              LOGO
            </span>
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

        <AuthNav />
      </div>
    </nav>
  );
}
