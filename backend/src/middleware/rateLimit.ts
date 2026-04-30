import { Request, Response, NextFunction } from 'express';

type Bucket = { windowStartMs: number; count: number };

export function createRateLimiter(args: { windowMs: number; max: number; key: (req: Request) => string }) {
  const buckets = new Map<string, Bucket>();

  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const key = args.key(req);
    const now = Date.now();
    const b = buckets.get(key);

    if (!b || now - b.windowStartMs >= args.windowMs) {
      buckets.set(key, { windowStartMs: now, count: 1 });
      next();
      return;
    }

    if (b.count >= args.max) {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait a moment and try again.',
      });
      return;
    }

    b.count += 1;
    next();
  };
}

