"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { supabase } from "../../lib/supabaseClient";
import { logAuthEvent } from "../../lib/authLogger";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        logAuthEvent("signin", email, false, authError.message);
        setError(authError.message ?? "Sign in failed. Please try again.");
        return;
      }
      if (data.session) {
        logAuthEvent("signin", email, true);
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err) {
      logAuthEvent("signin", email, false, String(err));
      setError("Sign in failed. Please try again.");
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
          <h1 className="text-2xl font-semibold text-center text-slate-900">Sign in to your account</h1>
          <p className="mt-2 text-sm text-slate-600 text-center">Welcome back — enter your details below.</p>

          <form onSubmit={handleSubmit} className="mt-6">
            {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

            <label className="block">
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

            <div className="flex items-center justify-between mt-4">
              <label className="inline-flex items-center text-sm text-slate-600">
                <input type="checkbox" className="form-checkbox h-4 w-4 text-slate-900 border-slate-200 rounded" />
                <span className="ml-2">Remember me</span>
              </label>

              <Link href="/forgot" className="text-sm text-slate-700 hover:underline">
                Forgot password?
              </Link>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>

              <Link
                href="/signup"
                className="flex-1 text-center inline-flex items-center justify-center px-4 py-2 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Create Account
              </Link>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
