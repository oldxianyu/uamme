import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { apiRoutes } from './routes/api';

type Bindings = {
  DB: D1Database;
  ASSETS?: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS for API
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// API routes
app.route('/api', apiRoutes);

// Static files - use ASSETS binding in production
app.get('*', async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('Static file serving not available in local dev', 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: '服务器内部错误' }, 500);
});

export default app;
