"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, isLandlord, loading: authLoading } = useAuth();
  const fromUpgrade = searchParams.get("upgrade") === "1";
  const [showModal, setShowModal] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { refreshProfile } = useAuth();

  const handleUpgradeConfirm = async () => {
    if (!user?.id) return;
    setUpgrading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/profiles/upgrade-landlord`, {
        method: "POST",
        headers: {
          "X-User-Id": user.id,
        },
      });

      const body = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (!res.ok || !body?.success) {
        throw new Error(body?.error || "Failed to upgrade. Try again.");
      }

      await refreshProfile();
      setShowModal(false);
      router.push("/dashboard/landlord");
      router.refresh();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
        return;
      }
      if (typeof err === "string") {
        setError(err);
        return;
      }
      if (err && typeof err === "object" && "message" in err) {
        const msg = (err as { message?: unknown }).message;
        if (typeof msg === "string" && msg.trim()) {
          setError(msg);
          return;
        }
      }
      try {
        setError(JSON.stringify(err));
      } catch {
        setError("Failed to upgrade. Try again.");
      }
    } finally {
      setUpgrading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
          <Navbar />
        </header>
        <main className="max-w-2xl mx-auto px-6 py-16">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-slate-200 rounded" />
            <div className="h-4 w-full bg-slate-200 rounded" />
            <div className="h-32 w-full bg-slate-200 rounded" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const createdDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : user.created_at
      ? new Date(user.created_at).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  const roleLabel = isLandlord ? "Renter + Landlord" : "Renter";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <Navbar />
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <Link
          href="/dashboard/renter"
          className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 rounded mb-6"
        >
          ← Back to dashboard
        </Link>

        <h1 className="text-3xl font-bold text-slate-900">Profile</h1>
        <p className="mt-2 text-slate-600">
          Manage your account and role.
        </p>

        {fromUpgrade && !isLandlord && (
          <div className="mt-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            Upgrade to landlord to create listings and list your space.
          </div>
        )}

        <section className="mt-10 rounded-lg border border-slate-200 bg-white p-6 space-y-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</p>
            <p className="mt-1 text-slate-900">{user.email}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Account created</p>
            <p className="mt-1 text-slate-900">{createdDate}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current role</p>
            <p className="mt-1 text-slate-900">{roleLabel}</p>
          </div>

          {!isLandlord && (
            <div className="pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-600 mb-3">
                Upgrade to landlord to list properties and earn from your spaces.
              </p>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Become a Landlord
              </button>
            </div>
          )}

          {isLandlord && (
            <div className="pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-600">
                You can create listings and manage your properties.
              </p>
              <Link
                href="/dashboard/landlord"
                className="mt-3 inline-flex items-center rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Go to landlord dashboard
              </Link>
            </div>
          )}
        </section>

        {/* Contractor section */}
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Offer services as a contractor
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Create a contractor profile so landlords can find and hire you
                for jobs.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
              Contractor
            </span>
          </div>

          <div className="pt-2">
            <Link
              href="/dashboard/contractor"
              className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
            >
              Go to contractor dashboard
            </Link>
          </div>
        </section>
      </main>

      {/* Confirmation modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          aria-modal="true"
          role="dialog"
          aria-labelledby="modal-title"
        >
          <div
            className="rounded-lg bg-white p-6 shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="modal-title" className="text-lg font-semibold text-slate-900">
              Become a Landlord
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              You&apos;ll be able to list properties and receive booking requests.
              You can still rent spaces as a renter. Continue?
            </p>
            {error && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setError(null);
                }}
                disabled={upgrading}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpgradeConfirm}
                disabled={upgrading}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {upgrading ? "Upgrading…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
