"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Review } from "@/types/database";
import Link from "next/link";
import { getApiUrl } from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StarIcon({ filled, className = "" }: { filled: boolean; className?: string }) {
  return (
    <svg
      className={`w-5 h-5 transition-colors ${
        filled ? "text-amber-400" : "text-slate-200"
      } ${className}`}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon key={star} filled={star <= Math.round(rating)} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProfileReviewsProps {
  targetUserId: string;
}

export default function ProfileReviews({ targetUserId }: ProfileReviewsProps) {
  const { user } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form state
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [roleContext, setRoleContext] = useState<"landlord" | "contractor" | "renter">("landlord");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch reviews
  // ---------------------------------------------------------------------------
  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/profiles/${targetUserId}/reviews`);
      const result = await res.json();
      if (!res.ok || !result.success) {
        setFetchError(result.error ?? "Failed to load reviews");
        return;
      }
      setReviews(result.data as Review[]);
    } catch {
      setFetchError("Could not reach the server. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setFetchError(null);

    (async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/profiles/${targetUserId}/reviews`);
        const result = await res.json();
        if (cancelled) return;
        if (!res.ok || !result.success) {
          setFetchError(result.error ?? "Failed to load reviews");
          return;
        }
        setReviews(result.data as Review[]);
      } catch {
        if (!cancelled) setFetchError("Could not reach the server. Please try again later.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const currentUserReview = user
    ? reviews.find((r) => r.reviewer_id === user.id)
    : null;

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  // ---------------------------------------------------------------------------
  // Submit review
  // ---------------------------------------------------------------------------
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || rating === 0 || !content.trim()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`${getApiUrl()}/api/profiles/${targetUserId}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": user.id,
        },
        body: JSON.stringify({ rating, role_context: roleContext, content: content.trim() }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        setSubmitError(result.error ?? "Failed to submit review. Please try again.");
        return;
      }

      // Prepend the new review returned by the API (has de-normalised reviewer info)
      setReviews((prev) => [result.data as Review, ...prev]);
      setRating(0);
      setContent("");
      setSubmitSuccess(true);
    } catch {
      setSubmitError("Could not reach the server. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="mt-12 w-full">
      {/* Section header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pt-6 border-t border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Reviews</h2>
          <p className="text-slate-500 mt-1">What others are saying about this user</p>
        </div>

        {!loading && reviews.length > 0 && (
          <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl">
            <div className="text-3xl font-bold text-slate-900 leading-none">
              {avgRating.toFixed(1)}
            </div>
            <div>
              <StarRating rating={avgRating} />
              <div className="text-xs font-medium text-slate-500 mt-0.5">
                Based on {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* ---------------------------------------------------------------- */}
        {/* Reviews list                                                      */}
        {/* ---------------------------------------------------------------- */}
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="space-y-6">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse bg-slate-50 rounded-2xl p-6 border border-slate-100"
                >
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-slate-200 rounded-full" />
                    <div className="flex-1 space-y-3 py-1">
                      <div className="h-4 bg-slate-200 rounded w-1/4" />
                      <div className="h-3 bg-slate-200 rounded w-24" />
                      <div className="space-y-2 pt-2">
                        <div className="h-3 bg-slate-200 rounded w-full" />
                        <div className="h-3 bg-slate-200 rounded w-5/6" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : fetchError ? (
            <div className="bg-red-50 rounded-2xl p-6 border border-red-100 text-center">
              <p className="text-red-600 font-medium text-sm">{fetchError}</p>
              <button
                onClick={fetchReviews}
                className="mt-3 text-sm text-red-700 underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          ) : reviews.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl p-10 text-center border border-slate-100 border-dashed">
              <svg
                className="w-10 h-10 text-slate-300 mx-auto mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <h3 className="text-lg font-medium text-slate-900">No reviews yet</h3>
              <p className="text-slate-500 mt-1 max-w-sm mx-auto text-sm">
                Be the first to leave a review and share your experience with others.
              </p>
            </div>
          ) : (
            <ul className="space-y-6">
              {reviews.map((review) => {
                const isRenter = review.role_context === "renter";
                const isContractor = review.role_context === "contractor";

                return (
                  <li
                    key={review.id}
                    className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {review.reviewer_avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={review.reviewer_avatar}
                              alt={review.reviewer_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-slate-500 text-xs font-semibold">
                              {review.reviewer_name.substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{review.reviewer_name}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(review.created_at).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end">
                        <StarRating rating={review.rating} />
                        <span
                          className={`mt-1.5 inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                            isContractor
                              ? "bg-blue-50 text-blue-700"
                              : isRenter
                              ? "bg-purple-50 text-purple-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          Reviewed as {review.role_context}
                        </span>
                      </div>
                    </div>

                    <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                      {review.content}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Leave a review form                                               */}
        {/* ---------------------------------------------------------------- */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-lg shadow-slate-200/40 sticky top-24">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Leave a Review</h3>

            {!user ? (
              /* Not signed in */
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 text-center">
                <p className="text-slate-600 text-sm mb-4">
                  You must be signed in to share your experience.
                </p>
                <Link
                  href={`/signin?redirect=/user/${targetUserId}`}
                  className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Sign In
                </Link>
              </div>
            ) : user.id === targetUserId ? (
              /* Own profile */
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-amber-800 text-sm">
                You cannot leave a review for your own profile.
              </div>
            ) : currentUserReview ? (
              /* Already reviewed */
              <div className="bg-green-50 rounded-xl p-5 border border-green-100 text-center">
                <svg
                  className="w-8 h-8 text-green-500 mx-auto mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-green-800 font-medium text-sm">You&apos;ve already reviewed this user.</p>
                <p className="text-green-700 text-xs mt-1">
                  You gave them {currentUserReview.rating} star{currentUserReview.rating !== 1 ? "s" : ""}.
                </p>
              </div>
            ) : submitSuccess ? (
              /* Just submitted */
              <div className="bg-green-50 rounded-xl p-5 border border-green-100 text-center">
                <svg
                  className="w-8 h-8 text-green-500 mx-auto mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-green-800 font-medium text-sm">Review submitted! Thank you.</p>
              </div>
            ) : (
              /* Review form */
              <form onSubmit={handleSubmitReview} className="space-y-5">
                {/* Rating stars */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Rating
                  </label>
                  <div className="flex gap-1" onMouseLeave={() => setHoverRating(0)}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        className="p-1 focus:outline-none transform hover:scale-110 transition-transform"
                      >
                        <StarIcon
                          filled={star <= (hoverRating || rating)}
                          className="w-8 h-8 drop-shadow-sm"
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interaction type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Interaction Type
                  </label>
                  <select
                    value={roleContext}
                    onChange={(e) => setRoleContext(e.target.value as typeof roleContext)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-[var(--brand)] focus:border-[var(--brand)] block p-2.5 transition-colors"
                  >
                    <option value="landlord">They were a Landlord</option>
                    <option value="contractor">They were a Contractor</option>
                    <option value="renter">They were a Renter</option>
                  </select>
                </div>

                {/* Content */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Your Experience
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Tell others what it was like working with this person..."
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-[var(--brand)] focus:border-[var(--brand)] block p-3 resize-none transition-colors placeholder:text-slate-400"
                  />
                </div>

                {/* Error message */}
                {submitError && (
                  <div className="bg-red-50 rounded-lg px-4 py-3 border border-red-100">
                    <p className="text-red-700 text-sm">{submitError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || rating === 0 || !content.trim()}
                  className="w-full text-white bg-[var(--brand)] hover:bg-[var(--brand-dark)] focus:ring-4 focus:ring-[var(--brand)]/20 font-medium rounded-lg text-sm px-5 py-3 text-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[var(--brand)]/20"
                >
                  {submitting ? "Submitting…" : "Submit Review"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
