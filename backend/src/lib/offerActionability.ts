export type OfferStatusForAction =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'cancelled'
  | 'countered';

export interface OfferActionabilityInput {
  status: OfferStatusForAction;
  created_by: string;
  landlord_id: string;
  renter_id: string;
}

export interface OfferActionability {
  canAccept: boolean;
  canReject: boolean;
  canCounter: boolean;
  canWithdraw: boolean;
  reasonIfDisabled: string | null;
}

export function computeOfferActionability(
  offer: OfferActionabilityInput | null,
  userId: string
): OfferActionability {
  const none: OfferActionability = {
    canAccept: false,
    canReject: false,
    canCounter: false,
    canWithdraw: false,
    reasonIfDisabled: 'No pending offer',
  };

  if (!offer || offer.status !== 'pending') {
    return none;
  }

  const isParticipant = userId === offer.landlord_id || userId === offer.renter_id;
  if (!isParticipant) {
    return {
      ...none,
      reasonIfDisabled: 'Not a participant',
    };
  }

  const isCreator = userId === offer.created_by;
  const isRecipient = !isCreator;

  const canAccept = isRecipient;
  const canReject = isRecipient;
  const canCounter = isRecipient;
  const canWithdraw = isCreator;
  const hasAnyAction = canAccept || canReject || canCounter || canWithdraw;

  return {
    canAccept,
    canReject,
    canCounter,
    canWithdraw,
    reasonIfDisabled: hasAnyAction ? null : 'No actions available',
  };
}
