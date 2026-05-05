import { Router } from 'express';
import userRoutes from './users';
import authEventsRoutes from './authEvents';
import contractorRoutes from './contractors';
import contractorJobsRoutes from './contractorJobs';
import profileRoutes from './profiles';
import listingRoutes from './listings';
import messageRoutes from './messages';
import assistantRoutes from './assistant';
import stripeConnectRoutes from './stripeConnect';
import offerRoutes from './offers';
import bookingRoutes from './bookings';
import devRoutes from './dev';
import renterRoutes from './renters';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.use('/users', requireAuth, userRoutes);
router.use('/auth-events', authEventsRoutes);
router.use('/contractors', contractorRoutes);
router.use('/profiles', profileRoutes);
router.use('/listings', listingRoutes);
router.use('/messages', requireAuth, messageRoutes);
router.use('/assistant', requireAuth, assistantRoutes);
router.use('/contractor-jobs', requireAuth, contractorJobsRoutes);
router.use('/stripe', requireAuth, stripeConnectRoutes);
router.use('/offers', requireAuth, offerRoutes);
router.use('/bookings', requireAuth, bookingRoutes);
router.use('/renters', requireAuth, renterRoutes);

// Dev-only testing routes (hidden in production)
router.use('/dev', devRoutes);

// Default API info route
router.get('/', (_req, res) => {
  res.json({
    name: 'Commercial Vacancy API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
    },
  });
});

export default router;


