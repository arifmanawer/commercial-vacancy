"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { supabase } from "../../lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo: `${window.location.origin}/signin` },
      );
      if (resetError) {
        setError(resetError.message ?? "Unable to send reset link.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
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
          <h1 className="text-2xl font-semibold text-center text-slate-900">
            Reset your password
          </h1>
          <p className="mt-2 text-sm text-slate-600 text-center">
            Enter the email address on your account and we&apos;ll send you a
            link to reset your password.
          </p>

          {sent ? (
            <div className="mt-6 rounded-md border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-800 text-center">
              <p className="font-medium">Check your inbox</p>
              <p className="mt-1 text-emerald-700">
                If an account exists for <strong>{email}</strong>, you&apos;ll
                receive a password reset link shortly.
              </p>
              <Link
                href="/signin"
                className="mt-4 inline-block text-sm font-medium text-slate-700 hover:underline"
              >
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6">
              {error && (
                <div className="text-sm text-red-600 mb-3">{error}</div>
              )}

              <label className="block">
                <span className="text-sm text-slate-700">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="you@example.com"
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full inline-flex items-center justify-center px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-60"
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>

              <div className="mt-4 text-center">
                <Link
                  href="/signin"
                  className="text-sm text-slate-600 hover:underline"
                >
                  ← Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
