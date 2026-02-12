import { Router, Request, Response } from 'express';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  const { event, email, success, error, timestamp } = req.body;
  const msg = success
    ? `[Auth] ${event} success: ${email}`
    : `[Auth] ${event} failed: ${email} - ${error || 'unknown error'}`;
  console.log(msg, { timestamp });
  res.status(204).send();
});


export default router;
