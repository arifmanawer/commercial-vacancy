/** Must match DB check on listings.rate_type and Buy Now backend. */
export const LISTING_RATE_TYPES = ["hourly", "daily", "weekly", "monthly"] as const;

export type ListingRateType = (typeof LISTING_RATE_TYPES)[number];

export function validateBuyNowListingPricing(input: {
  rateType: string;
  rateAmount: number | null;
  minDuration: number | null;
  maxDuration: number | null;
}): string | null {
  const t = String(input.rateType || "")
    .toLowerCase()
    .trim();
  if (!LISTING_RATE_TYPES.includes(t as ListingRateType)) {
    return "Choose a valid rate type (hourly, daily, weekly, or monthly).";
  }
  if (
    input.rateAmount == null ||
    !Number.isFinite(input.rateAmount) ||
    input.rateAmount <= 0
  ) {
    return "Enter a price greater than zero.";
  }
  if (
    input.minDuration == null ||
    !Number.isInteger(input.minDuration) ||
    input.minDuration < 1
  ) {
    return "Minimum duration must be a whole number of at least 1.";
  }
  if (
    input.maxDuration == null ||
    !Number.isInteger(input.maxDuration) ||
    input.maxDuration < 1
  ) {
    return "Maximum duration must be a whole number of at least 1.";
  }
  if (input.minDuration > input.maxDuration) {
    return "Minimum duration cannot be greater than maximum duration.";
  }
  return null;
}
