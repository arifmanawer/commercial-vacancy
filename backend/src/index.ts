import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import apiRoutes from './routes';
import { stripeWebhookHandler } from './routes/stripeWebhook';

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (no Origin header)
      if (!origin) return callback(null, true);

      // In dev, allow any origin so LAN access (e.g. http://192.168.x.x:3000) works.
      if (config.nodeEnv === 'development') return callback(null, true);

      // In non-dev, lock down to the configured frontend URL
      return callback(null, origin === config.frontendUrl);
    },
    credentials: true,
  })
);

// Stripe webhooks need the raw body for signature verification.
// This route MUST be registered before JSON body parsing middleware.
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

// Request parsing for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Root — browsers hitting the API host see this instead of a 404 JSON body
app.get('/', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>Commercial Vacancy API</title></head>
<body>
  <h1>Commercial Vacancy API</h1>
  <p>This URL is the <strong>API server</strong>, not the website. The web app is served separately.</p>
  <ul>
    <li><a href="/api/">API root (JSON)</a></li>
    <li><a href="/health">Health check</a></li>
    <li><a href="/test">Test</a></li>
  </ul>
  <p>end</p>
</body>
</html>`);
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Simple browser-friendly check (open https://your-host/test in a tab)
app.get('/test', (_req, res) => {
  res.type('text/plain').send(
    `Commercial Vacancy API — test OK\n${new Date().toISOString()}\n`
  );
});

// API routes
app.use('/api', apiRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
});

export default app;

