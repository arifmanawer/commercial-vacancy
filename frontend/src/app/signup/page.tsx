"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { supabase } from "../../lib/supabaseClient";
import { logAuthEvent } from "../../lib/authLogger";
import { getApiUrl } from "../../lib/api";

export default function SignUpPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      logAuthEvent("signup", email, false, "Passwords do not match");
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: `${firstName} ${lastName}`.trim(),
            username: username.trim() || null,
            first_name: firstName.trim() || null,
            last_name: lastName.trim() || null,
            address: address.trim() || null,
            description: description.trim() || null,
          },
        },
      });
      if (authError) {
        logAuthEvent("signup", email, false, authError.message);
        setError(authError.message ?? "Sign up failed. Please try again.");
        return;
      }
      if (data.user) {
        // Persist profile details to public.profiles via backend API (service role).
        // This works even if email confirmation is required because the backend
        // only needs the user id (consistent with current API auth model).
        try {
          await fetch(`${getApiUrl()}/api/profiles/me`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "X-User-Id": data.user.id,
            },
            body: JSON.stringify({
              username: username.trim() || null,
              first_name: firstName.trim() || null,
              last_name: lastName.trim() || null,
              address: address.trim() || null,
              description: description.trim() || null,
            }),
          });
        } catch {
          // Best-effort: role/profile page can be updated later.
        }
        logAuthEvent("signup", email, true);
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      logAuthEvent("signup", email, false, String(err));
      setError("Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-md">
        <Navbar />
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-14 sm:py-20 flex-grow">
        <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-8">
          <h1 className="text-2xl font-semibold text-center text-slate-900">Create your account</h1>
          <p className="mt-2 text-sm text-slate-600 text-center">Get started — create an account to list or book spaces.</p>

          <form onSubmit={handleSubmit} className="mt-6">
            {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

            <label className="block">
              <span className="text-sm text-slate-700">Username</span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. John Doe"
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
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

            <label className="block mt-4">
              <span className="text-sm text-slate-700">Address (optional)</span>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, City, State"
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="block mt-4">
              <span className="text-sm text-slate-700">Description</span>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us a bit about yourself..."
                rows={4}
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="block mt-4">
              <span className="text-sm text-slate-700">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="block mt-4">
              <span className="text-sm text-slate-700">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="block mt-4">
              <span className="text-sm text-slate-700">Confirm password</span>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                {loading ? "Creating account..." : "Create account"}
              </button>

              <Link
                href="/signin"
                className="flex-1 text-center inline-flex items-center justify-center px-4 py-2 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Already have an account?
              </Link>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
