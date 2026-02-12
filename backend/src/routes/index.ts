import { Router } from 'express';
import userRoutes from './users';
import authEventsRoutes from './authEvents';

const router = Router();

router.use('/users', userRoutes);
router.use('/auth-events', authEventsRoutes);

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

