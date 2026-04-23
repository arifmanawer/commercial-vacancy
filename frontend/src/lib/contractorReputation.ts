import type { Contractor } from "@/types/database";

/**
 * Shown next to the star rating. Uses live review count from the API when available;
 * otherwise shows completed job count from the contractor row.
 */
export function contractorRatingCaption(c: Contractor): string {
  if (c.review_count > 0) {
    const r = c.review_count === 1 ? "review" : "reviews";
    if (c.total_jobs_completed > 0) {
      return `(${c.review_count} ${r} · ${c.total_jobs_completed} jobs)`;
    }
    return `(${c.review_count} ${r})`;
  }
  return `(${c.total_jobs_completed} jobs)`;
}
