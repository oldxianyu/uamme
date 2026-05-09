import { Hono } from 'hono';
import { dbGet, dbAll } from '../db/index';
import { authMiddleware } from '../middleware/auth';

export const dashboardRoutes = new Hono();
dashboardRoutes.use('*', authMiddleware);

// Get dashboard stats
dashboardRoutes.get('/stats', async (c) => {
  const userId = c.get('userId');

  const webhooks = await dbGet<{ count: number }>(
    c.env.DB,
    'SELECT COUNT(*) as count FROM webhook_configs WHERE user_id = ?',
    userId
  );

  const templates = await dbGet<{ count: number }>(
    c.env.DB,
    'SELECT COUNT(*) as count FROM message_templates WHERE user_id = ?',
    userId
  );

  const sources = await dbGet<{ count: number }>(
    c.env.DB,
    'SELECT COUNT(*) as count FROM content_sources WHERE user_id = ?',
    userId
  );

  const customContents = await dbGet<{ count: number }>(
    c.env.DB,
    'SELECT COUNT(*) as count FROM custom_contents WHERE user_id = ?',
    userId
  );

  const totalPushes = await dbGet<{ count: number }>(
    c.env.DB,
    'SELECT COUNT(*) as count FROM push_logs WHERE user_id = ?',
    userId
  );

  const successPushes = await dbGet<{ count: number }>(
    c.env.DB,
    "SELECT COUNT(*) as count FROM push_logs WHERE user_id = ? AND status = 'success'",
    userId
  );

  const failedPushes = await dbGet<{ count: number }>(
    c.env.DB,
    "SELECT COUNT(*) as count FROM push_logs WHERE user_id = ? AND status = 'failed'",
    userId
  );

  return c.json({
    stats: {
      webhooks: webhooks?.count || 0,
      templates: templates?.count || 0,
      sources: sources?.count || 0,
      customContents: customContents?.count || 0,
      totalPushes: totalPushes?.count || 0,
      successPushes: successPushes?.count || 0,
      failedPushes: failedPushes?.count || 0,
    }
  });
});

// Get recent push logs
dashboardRoutes.get('/recent-pushes', async (c) => {
  const userId = c.get('userId');
  const logs = await dbAll(
    c.env.DB,
    `SELECT pl.*, wc.name as webhook_name
     FROM push_logs pl
     LEFT JOIN webhook_configs wc ON pl.webhook_id = wc.id
     WHERE pl.user_id = ?
     ORDER BY pl.created_at DESC
     LIMIT 10`,
    userId
  );
  return c.json({ logs });
});

// Get recent failures
dashboardRoutes.get('/recent-failures', async (c) => {
  const userId = c.get('userId');
  const logs = await dbAll(
    c.env.DB,
    `SELECT pl.*, wc.name as webhook_name
     FROM push_logs pl
     LEFT JOIN webhook_configs wc ON pl.webhook_id = wc.id
     WHERE pl.user_id = ? AND pl.status = 'failed'
     ORDER BY pl.created_at DESC
     LIMIT 10`,
    userId
  );
  return c.json({ logs });
});
