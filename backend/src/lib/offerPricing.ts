export function computeOfferAmounts(params: {
  rateAmount: number;
  duration: number;
  platformFeePercent?: number;
}): { subtotal: number; platformFee: number; total: number } {
  const perUnit = Number(params.rateAmount);
  if (!Number.isFinite(perUnit) || perUnit <= 0) {
    throw new Error('rateAmount must be a positive number');
  }
  const duration = params.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('duration must be a positive number');
  }

  const subtotal = Math.round(perUnit * duration * 100);
  const platformPercent =
    typeof params.platformFeePercent === 'number' && params.platformFeePercent >= 0
      ? params.platformFeePercent
      : 10;
  const platformFee = Math.round((subtotal * platformPercent) / 100);
  const total = subtotal + platformFee;
  return { subtotal, platformFee, total };
}
