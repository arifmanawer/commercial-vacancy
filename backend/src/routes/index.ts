import { Router } from 'express';
import userRoutes from './users';
import authEventsRoutes from './authEvents';
import contractorRoutes from './contractors';
import profileRoutes from './profiles';
import listingRoutes from './listings';
import messageRoutes from './messages';

const router = Router();

router.use('/users', userRoutes);
router.use('/auth-events', authEventsRoutes);
router.use('/contractors', contractorRoutes);
router.use('/profiles', profileRoutes);
router.use('/listings', listingRoutes);
router.use('/messages', messageRoutes);

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


