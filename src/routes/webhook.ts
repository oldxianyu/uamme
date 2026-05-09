import { Hono } from 'hono';
import { dbGet, dbAll, dbRun, dbInsert, validateId, validateString, validateUrl } from '../db/index';
import { authMiddleware } from '../middleware/auth';

export const webhookRoutes = new Hono();
webhookRoutes.use('*', authMiddleware);

// Get all webhooks
webhookRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const webhooks = await dbAll(
    c.env.DB,
    'SELECT * FROM webhook_configs WHERE user_id = ? ORDER BY created_at DESC',
    userId
  );
  return c.json({ webhooks });
});

// Get single webhook
webhookRoutes.get('/:id', async (c) => {
  const userId = c.get('userId');
  const id = validateId(c.req.param('id'));
  if (id === null) return c.json({ error: '无效 ID' }, 400);

  const webhook = await dbGet(
    c.env.DB,
    'SELECT * FROM webhook_configs WHERE id = ? AND user_id = ?',
    id, userId
  );
  if (!webhook) return c.json({ error: '未找到' }, 404);
  return c.json({ webhook });
});

// Create webhook
webhookRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: '请求格式错误' }, 400); }

  const name = validateString(body.name, 100);
  const webhook_url = validateString(body.webhook_url, 500);
  const description = validateString(body.description, 500);

  if (!name || !webhook_url) {
    return c.json({ error: '名称和 Webhook URL 不能为空' }, 400);
  }

  if (!validateUrl(webhook_url)) {
    return c.json({ error: 'Webhook URL 格式无效，仅支持 http/https' }, 400);
  }

  const result = await dbInsert(
    c.env.DB,
    'INSERT INTO webhook_configs (user_id, name, webhook_url, description) VALUES (?, ?, ?, ?)',
    userId, name, webhook_url, description
  );

  const webhook = await dbGet(c.env.DB, 'SELECT * FROM webhook_configs WHERE id = ?', result.meta.last_row_id);
  return c.json({ webhook }, 201);
});

// Update webhook
webhookRoutes.put('/:id', async (c) => {
  const userId = c.get('userId');
  const id = validateId(c.req.param('id'));
  if (id === null) return c.json({ error: '无效 ID' }, 400);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: '请求格式错误' }, 400); }

  const name = validateString(body.name, 100);
  const webhook_url = validateString(body.webhook_url, 500);
  const description = validateString(body.description, 500);
  const is_active = body.is_active === 1 || body.is_active === 0 ? body.is_active : 1;

  if (!name || !webhook_url) {
    return c.json({ error: '名称和 URL 不能为空' }, 400);
  }

  if (!validateUrl(webhook_url)) {
    return c.json({ error: 'Webhook URL 格式无效' }, 400);
  }

  const existing = await dbGet(
    c.env.DB,
    'SELECT * FROM webhook_configs WHERE id = ? AND user_id = ?',
    id, userId
  );
  if (!existing) return c.json({ error: '未找到' }, 404);

  await dbRun(
    c.env.DB,
    `UPDATE webhook_configs SET name = ?, webhook_url = ?, description = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?`,
    name, webhook_url, description, is_active, id
  );

  const webhook = await dbGet(c.env.DB, 'SELECT * FROM webhook_configs WHERE id = ?', id);
  return c.json({ webhook });
});

// Delete webhook
webhookRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = validateId(c.req.param('id'));
  if (id === null) return c.json({ error: '无效 ID' }, 400);

  const existing = await dbGet(
    c.env.DB,
    'SELECT * FROM webhook_configs WHERE id = ? AND user_id = ?',
    id, userId
  );
  if (!existing) return c.json({ error: '未找到' }, 404);

  await dbRun(c.env.DB, 'DELETE FROM webhook_configs WHERE id = ?', id);
  return c.json({ ok: true });
});

// Test push - with SSRF protection
webhookRoutes.post('/:id/test', async (c) => {
  const userId = c.get('userId');
  const id = validateId(c.req.param('id'));
  if (id === null) return c.json({ error: '无效 ID' }, 400);

  let body: any;
  try { body = await c.req.json(); } catch { body = {}; }

  const webhook = await dbGet(
    c.env.DB,
    'SELECT * FROM webhook_configs WHERE id = ? AND user_id = ?',
    id, userId
  ) as any;
  if (!webhook) return c.json({ error: '未找到' }, 404);

  // SSRF protection: only allow WeChat Work domains
  const allowedDomains = ['qyapi.weixin.qq.com'];
  try {
    const url = new URL(webhook.webhook_url);
    if (!allowedDomains.includes(url.hostname)) {
      return c.json({ error: '仅允许推送到企业微信域名' }, 403);
    }
  } catch {
    return c.json({ error: 'Webhook URL 无效' }, 400);
  }

  const text = validateString(body.content, 2000) || '🏓 优安米测试推送\n\n这是一条来自优安米平台的测试消息。';
  const format = body.format === 'markdown' ? 'markdown' : 'text';

  let payload: any;
  if (format === 'markdown') {
    payload = { msgtype: 'markdown', markdown: { content: text } };
  } else {
    payload = { msgtype: 'text', text: { content: text } };
  }

  try {
    const resp = await fetch(webhook.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const respText = await resp.text();
    let respJson: any;
    try { respJson = JSON.parse(respText); } catch { respJson = null; }

    const success = respJson?.errcode === 0;

    await dbInsert(
      c.env.DB,
      `INSERT INTO push_logs (user_id, webhook_id, title, body_preview, status, response_code, response_body, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      userId, id, '测试推送', text.slice(0, 200),
      success ? 'success' : 'failed',
      resp.status, respText.slice(0, 1000),
      success ? '' : (respJson?.errmsg || '推送失败')
    );

    return c.json({ ok: success, response: respJson, status: resp.status });
  } catch (err: any) {
    await dbInsert(
      c.env.DB,
      `INSERT INTO push_logs (user_id, webhook_id, title, body_preview, status, error_message)
       VALUES (?, ?, ?, ?, 'failed', ?)`,
      userId, id, '测试推送', text.slice(0, 200), err.message
    );
    return c.json({ ok: false, error: err.message }, 500);
  }
});
