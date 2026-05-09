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

// Static files
app.get('*', async (c) => {
  // Production: use ASSETS binding
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  // Local dev: serve from public/ via node:fs
  try {
    const url = new URL(c.req.url);
    let path = url.pathname;
    if (path === '/') path = '/index.html';
    if (path.endsWith('/')) path += 'index.html';

    const fs = await import('node:fs/promises');
    const { join } = await import('node:path');
    const filePath = join(process.cwd(), 'public', path);

    const content = await fs.readFile(filePath);
    const ext = path.split('.').pop() || 'html';
    const mimeTypes: Record<string, string> = {
      html: 'text/html; charset=utf-8',
      css: 'text/css; charset=utf-8',
      js: 'application/javascript; charset=utf-8',
      json: 'application/json; charset=utf-8',
      png: 'image/png',
      jpg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',
      woff: 'font/woff',
      woff2: 'font/woff2',
    };
    return new Response(content, {
      headers: { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' },
    });
  } catch {
    return c.text('Not Found', 404);
  }
});

// Error handler
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: '服务器内部错误' }, 500);
});

export default app;
