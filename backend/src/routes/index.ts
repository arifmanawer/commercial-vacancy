import { Router } from 'express';
import userRoutes from './users';
import authEventsRoutes from './authEvents';
import contractorRoutes from './contractors';
import contractorJobsRoutes from './contractorJobs';
import profileRoutes from './profiles';
import listingRoutes from './listings';
import messageRoutes from './messages';
import profileAvatarRoutes from './profileAvatar';

const router = Router();

router.use('/users', userRoutes);
router.use('/auth-events', authEventsRoutes);
router.use('/contractors', contractorRoutes);
router.use('/profiles', profileRoutes);
router.use('/profile/avatar', profileAvatarRoutes);
router.use('/listings', listingRoutes);
router.use('/messages', messageRoutes);
router.use('/contractor-jobs', contractorJobsRoutes);

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


