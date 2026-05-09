import { Hono } from 'hono';
import { dbGet, dbAll, dbInsert, validateId } from '../db/index';
import { authMiddleware } from '../middleware/auth';

export const pushRoutes = new Hono();
pushRoutes.use('*', authMiddleware);

// Get push logs
pushRoutes.get('/logs', async (c) => {
  const userId = c.get('userId');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const offset = Math.max(parseInt(c.req.query('offset') || '0'), 0);

  const logs = await dbAll(
    c.env.DB,
    `SELECT pl.*, wc.name as webhook_name, mt.name as template_name
     FROM push_logs pl
     LEFT JOIN webhook_configs wc ON pl.webhook_id = wc.id
     LEFT JOIN message_templates mt ON pl.template_id = mt.id
     WHERE pl.user_id = ?
     ORDER BY pl.created_at DESC
     LIMIT ? OFFSET ?`,
    userId, limit, offset
  );

  const total = await dbGet<{ count: number }>(
    c.env.DB,
    'SELECT COUNT(*) as count FROM push_logs WHERE user_id = ?',
    userId
  );

  return c.json({ logs, total: total?.count || 0 });
});

// Get single log detail
pushRoutes.get('/logs/:id', async (c) => {
  const userId = c.get('userId');
  const id = validateId(c.req.param('id'));
  if (id === null) return c.json({ error: '无效 ID' }, 400);

  const log = await dbGet(
    c.env.DB,
    `SELECT pl.*, wc.name as webhook_name, wc.webhook_url, mt.name as template_name, mt.content as template_content
     FROM push_logs pl
     LEFT JOIN webhook_configs wc ON pl.webhook_id = wc.id
     LEFT JOIN message_templates mt ON pl.template_id = mt.id
     WHERE pl.id = ? AND pl.user_id = ?`,
    id, userId
  );
  if (!log) return c.json({ error: '未找到' }, 404);
  return c.json({ log });
});

// Send push
pushRoutes.post('/send', async (c) => {
  const userId = c.get('userId');
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: '请求格式错误' }, 400); }

  const webhook_id = validateId(String(body.webhook_id));
  if (webhook_id === null) {
    return c.json({ error: '请选择 Webhook' }, 400);
  }

  const template_id = body.template_id ? validateId(String(body.template_id)) : null;
  const custom_content_id = body.custom_content_id ? validateId(String(body.custom_content_id)) : null;
  const content_source_id = body.content_source_id ? validateId(String(body.content_source_id)) : null;

  // Get webhook
  const webhook = await dbGet<any>(
    c.env.DB,
    'SELECT * FROM webhook_configs WHERE id = ? AND user_id = ?',
    webhook_id, userId
  );
  if (!webhook) return c.json({ error: 'Webhook 不存在' }, 404);

  // SSRF protection
  const allowedDomains = ['qyapi.weixin.qq.com'];
  try {
    const url = new URL(webhook.webhook_url);
    if (!allowedDomains.includes(url.hostname)) {
      return c.json({ error: '仅允许推送到企业微信域名' }, 403);
    }
  } catch {
    return c.json({ error: 'Webhook URL 无效' }, 400);
  }

  // Get content
  let title = '';
  let contentBody = '';

  if (custom_content_id) {
    const content = await dbGet<any>(
      c.env.DB,
      'SELECT * FROM custom_contents WHERE id = ? AND user_id = ?',
      custom_content_id, userId
    );
    if (content) {
      title = content.title;
      contentBody = content.body;
    }
  } else if (content_source_id) {
    const source = await dbGet<any>(
      c.env.DB,
      'SELECT * FROM content_sources WHERE id = ? AND user_id = ?',
      content_source_id, userId
    );
    if (source) {
      title = source.name;
      contentBody = `[${source.source_type}] ${source.source_url || source.keyword}`;
    }
  }

  if (!contentBody) {
    return c.json({ error: '请选择要推送的内容' }, 400);
  }

  // Apply template if provided
  let pushBody = contentBody;
  if (template_id) {
    const template = await dbGet<any>(
      c.env.DB,
      'SELECT * FROM message_templates WHERE id = ? AND user_id = ?',
      template_id, userId
    );
    if (template) {
      pushBody = template.content
        .replace(/\{\{title\}\}/g, title)
        .replace(/\{\{body\}\}/g, contentBody);
    }
  }

  // Build WeChat Work message
  const format = body.format === 'markdown' ? 'markdown' : 'text';
  let payload: any;
  if (format === 'markdown') {
    payload = { msgtype: 'markdown', markdown: { content: pushBody } };
  } else {
    payload = { msgtype: 'text', text: { content: pushBody } };
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
      `INSERT INTO push_logs (user_id, webhook_id, template_id, content_source_id, custom_content_id, title, body_preview, status, response_code, response_body, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      userId, webhook_id, template_id || null, content_source_id || null, custom_content_id || null,
      title, pushBody.slice(0, 200),
      success ? 'success' : 'failed',
      resp.status, respText.slice(0, 1000),
      success ? '' : (respJson?.errmsg || '推送失败')
    );

    return c.json({ ok: success, response: respJson, status: resp.status });
  } catch (err: any) {
    await dbInsert(
      c.env.DB,
      `INSERT INTO push_logs (user_id, webhook_id, template_id, title, body_preview, status, error_message)
       VALUES (?, ?, ?, ?, ?, 'failed', ?)`,
      userId, webhook_id, template_id || null, title, pushBody.slice(0, 200), err.message
    );
    return c.json({ ok: false, error: err.message }, 500);
  }
});
