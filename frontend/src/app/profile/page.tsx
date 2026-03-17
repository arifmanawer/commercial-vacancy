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
  const { user, profile, isLandlord, isContractor, loading: authLoading, refreshProfile } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [profilePictureUrl, setProfilePictureUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(t);
  }, [success]);

  useEffect(() => {
    setUsername(profile?.username ?? "");
    setFirstName(profile?.first_name ?? "");
    setLastName(profile?.last_name ?? "");
    setAddress(profile?.address ?? "");
    setDescription(profile?.description ?? "");
    setProfilePictureUrl(profile?.profile_picture_url ?? "");
  }, [profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user?.id) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${getApiUrl()}/api/profile/avatar`, {
        method: "POST",
        headers: {
          "X-User-Id": user.id,
        },
        body: formData,
      });

      const data = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string; data?: { profile_picture_url: string } }
        | null;

      if (!res.ok || !data?.success || !data.data?.profile_picture_url) {
        throw new Error(data?.error || "Failed to upload profile picture");
      }

      setProfilePictureUrl(data.data.profile_picture_url);
      await refreshProfile();
      router.refresh();
      setSuccess("Profile picture updated.");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message === "Failed to fetch"
            ? "Could not connect to the API. Make sure the backend is running (npm run dev in backend/)."
            : err.message
          : "Failed to upload profile picture.";
      setError(msg);
    } finally {
      setAvatarUploading(false);
      // clear the file input value so the same file can be reselected if needed
      e.target.value = "";
    }
  };

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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setUpdating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/profiles/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": user.id,
        },
        body: JSON.stringify({
          username: username.trim() || null,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          address: address.trim() || null,
          description: description.trim() || null,
          profile_picture_url: profilePictureUrl.trim() || null,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to update profile. Try again.");
      }

      await refreshProfile();
      router.refresh();
      setSuccess("Profile updated.");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message === "Failed to fetch"
            ? "Could not connect to the API. Make sure the backend is running (npm run dev in backend/)."
            : err.message
          : "Failed to update profile.";
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

        <section className="mt-10 rounded-lg border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
              {profilePictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profilePictureUrl} alt="Profile picture" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-slate-500">No photo</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {[firstName, lastName].filter(Boolean).join(" ") || username || user.email}
              </p>
              <p className="text-xs text-slate-500 truncate">Update your public profile info.</p>
              <div className="mt-2">
                <label className="inline-flex items-center text-xs font-medium text-slate-700 cursor-pointer">
                  <span className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50">
                    {avatarUploading ? "Uploading..." : "Change photo"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    disabled={avatarUploading}
                  />
                </label>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-green-600" role="status">
              {success}
            </p>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <label className="block">
              <span className="text-sm text-slate-700">Username</span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm text-slate-700">First name</span>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="block">
                <span className="text-sm text-slate-700">Last name</span>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm text-slate-700">Address (optional)</span>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="block">
              <span className="text-sm text-slate-700">Description</span>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="block">
              <span className="text-sm text-slate-700">Profile picture URL</span>
              <input
                type="url"
                required
                value={profilePictureUrl}
                onChange={(e) => setProfilePictureUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="submit"
                disabled={updating}
                className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-60"
              >
                {updating ? "Saving..." : "Save profile"}
              </button>
            </div>
          </form>
        </section>

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
