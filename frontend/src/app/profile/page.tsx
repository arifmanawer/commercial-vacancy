"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/api";

const ROLES = [
  {
    id: "renter",
    label: "Renter",
    description: "Browse and book spaces, submit maintenance requests",
    alwaysOn: true,
  },
  {
    id: "landlord",
    label: "Landlord",
    description: "List properties, manage bookings, assign contractors",
    profileKey: "is_landlord" as const,
  },
  {
    id: "contractor",
    label: "Contractor",
    description: "Offer services, get hired by landlords for maintenance jobs",
    profileKey: "is_contractor" as const,
  },
] as const;

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, isLandlord, isContractor, loading: authLoading } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { refreshProfile } = useAuth();

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const handleRoleChange = async (roleId: string, checked: boolean) => {
    if (!user?.id || roleId === "renter") return;
    setUpdating(true);
    setError(null);
    setSuccess(null);
    try {
      const body =
        roleId === "landlord"
          ? { is_landlord: checked }
          : { is_contractor: checked };

      const res = await fetch(`${getApiUrl()}/api/profiles/roles`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": user.id,
        },
        body: JSON.stringify(body),
      });

      const data = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to update role. Try again.");
      }

      await refreshProfile();
      router.refresh();
      setSuccess("Role updated.");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message === "Failed to fetch"
            ? "Could not connect to the API. Make sure the backend is running (npm run dev in backend/)."
            : err.message
          : "Failed to update role.";
      setError(msg);
    } finally {
      setUpdating(false);
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
          Manage your account and roles.
        </p>

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
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-3">Your roles</p>
            <p className="text-sm text-slate-600 mb-4">
              Add roles that apply to you. You can have multiple roles.
            </p>
            {error && (
              <p className="text-sm text-red-600 mb-3" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-green-600 mb-3" role="status">
                {success}
              </p>
            )}
            <div className="space-y-3">
              {/* Renter: base role, always on, display only */}
              <div
                className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 bg-slate-50/50"
                aria-label="Renter (base role)"
              >
                <div className="mt-1 h-4 w-4 rounded border border-slate-300 bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] text-slate-500">✓</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-900">Renter</span>
                  <span className="ml-2 text-xs text-slate-500">Base role — always</span>
                  <p className="mt-0.5 text-sm text-slate-600">{ROLES[0].description}</p>
                </div>
              </div>

              {/* Landlord & Contractor: selectable */}
              {ROLES.slice(1).map((role) => {
                const isChecked =
                  (role.profileKey === "is_landlord" && isLandlord) ||
                  (role.profileKey === "is_contractor" && isContractor);

                return (
                  <label
                    key={role.id}
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      isChecked
                        ? "border-[var(--brand)]/40 bg-[var(--brand-muted)]"
                        : "border-slate-200 hover:border-slate-300"
                    } ${updating ? "opacity-70 pointer-events-none" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={updating}
                      onChange={(e) =>
                        role.profileKey
                          ? handleRoleChange(role.id, e.target.checked)
                          : undefined
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[var(--brand)] focus:ring-[var(--brand)]"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-slate-900">{role.label}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        {isChecked ? "Active" : "Inactive"}
                      </span>
                      <p className="mt-0.5 text-sm text-slate-600">{role.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3">
            {isLandlord && (
              <Link
                href="/dashboard/landlord"
                className="inline-flex items-center rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Landlord dashboard
              </Link>
            )}
            {isContractor && (
              <Link
                href="/dashboard/contractor"
                className="inline-flex items-center rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Contractor dashboard
              </Link>
            )}
            <Link
              href="/dashboard/renter"
              className="inline-flex items-center rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Renter dashboard
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
