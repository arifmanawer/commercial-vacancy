import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendReservationEmails } from '../services/reservationEmails';

const router = Router();

function isProd() {
  return (process.env.NODE_ENV || 'development') === 'production';
}

function checkDevSecret(req: Request): boolean {
  const required = process.env.DEV_EMAIL_TEST_SECRET?.trim();
  if (!required) return true; // allow if unset (dev convenience)
  const got = (req.headers['x-dev-secret'] as string | undefined)?.trim() || '';
  return got === required;
}

/**
 * POST /api/dev/test-reservation-email
 * Body: { bookingId: string }
 *
 * Dev-only endpoint to trigger reservation emails for an existing booking.
 * Guard with NODE_ENV !== production and optional X-Dev-Secret header.
 */
router.post(
  '/test-reservation-email',
  asyncHandler(async (req: Request, res: Response) => {
    if (isProd()) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }

    if (!checkDevSecret(req)) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const bookingId = String(req.body?.bookingId || '').trim();
    if (!bookingId) {
      res.status(400).json({ success: false, error: 'bookingId is required' });
      return;
    }

    const result = await sendReservationEmails(bookingId);
    res.status(200).json({ success: true, data: result });
  })
);

export default router;

