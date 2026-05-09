import { Hono } from 'hono';
import { dbGet, dbAll, dbRun, dbInsert, validateId, validateString } from '../db/index';
import { authMiddleware } from '../middleware/auth';

export const templateRoutes = new Hono();
templateRoutes.use('*', authMiddleware);

// Get all templates
templateRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const templates = await dbAll(
    c.env.DB,
    'SELECT * FROM message_templates WHERE user_id = ? ORDER BY created_at DESC',
    userId
  );
  return c.json({ templates });
});

// Get single template
templateRoutes.get('/:id', async (c) => {
  const userId = c.get('userId');
  const id = validateId(c.req.param('id'));
  if (id === null) return c.json({ error: '无效 ID' }, 400);

  const template = await dbGet(
    c.env.DB,
    'SELECT * FROM message_templates WHERE id = ? AND user_id = ?',
    id, userId
  );
  if (!template) return c.json({ error: '未找到' }, 404);
  return c.json({ template });
});

// Create template
templateRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: '请求格式错误' }, 400); }

  const name = validateString(body.name, 100);
  const format = ['text', 'markdown'].includes(body.format) ? body.format : 'text';
  const content = validateString(body.content, 5000);
  const description = validateString(body.description, 500);

  if (!name || !content) {
    return c.json({ error: '名称和内容不能为空' }, 400);
  }

  const result = await dbInsert(
    c.env.DB,
    'INSERT INTO message_templates (user_id, name, format, content, description) VALUES (?, ?, ?, ?, ?)',
    userId, name, format, content, description
  );

  const template = await dbGet(c.env.DB, 'SELECT * FROM message_templates WHERE id = ?', result.meta.last_row_id);
  return c.json({ template }, 201);
});

// Update template
templateRoutes.put('/:id', async (c) => {
  const userId = c.get('userId');
  const id = validateId(c.req.param('id'));
  if (id === null) return c.json({ error: '无效 ID' }, 400);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: '请求格式错误' }, 400); }

  const name = validateString(body.name, 100);
  const format = ['text', 'markdown'].includes(body.format) ? body.format : 'text';
  const content = validateString(body.content, 5000);
  const description = validateString(body.description, 500);

  if (!name || !content) {
    return c.json({ error: '名称和内容不能为空' }, 400);
  }

  const existing = await dbGet(
    c.env.DB,
    'SELECT * FROM message_templates WHERE id = ? AND user_id = ?',
    id, userId
  );
  if (!existing) return c.json({ error: '未找到' }, 404);

  await dbRun(
    c.env.DB,
    `UPDATE message_templates SET name = ?, format = ?, content = ?, description = ?, updated_at = datetime('now') WHERE id = ?`,
    name, format, content, description, id
  );

  const template = await dbGet(c.env.DB, 'SELECT * FROM message_templates WHERE id = ?', id);
  return c.json({ template });
});

// Delete template
templateRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = validateId(c.req.param('id'));
  if (id === null) return c.json({ error: '无效 ID' }, 400);

  const existing = await dbGet(
    c.env.DB,
    'SELECT * FROM message_templates WHERE id = ? AND user_id = ?',
    id, userId
  );
  if (!existing) return c.json({ error: '未找到' }, 404);

  await dbRun(c.env.DB, 'DELETE FROM message_templates WHERE id = ?', id);
  return c.json({ ok: true });
});

// Preview template
templateRoutes.post('/:id/preview', async (c) => {
  const userId = c.get('userId');
  const id = validateId(c.req.param('id'));
  if (id === null) return c.json({ error: '无效 ID' }, 400);

  let body: any;
  try { body = await c.req.json(); } catch { body = {}; }

  const template = await dbGet<any>(
    c.env.DB,
    'SELECT * FROM message_templates WHERE id = ? AND user_id = ?',
    id, userId
  );
  if (!template) return c.json({ error: '未找到' }, 404);

  // Replace {{variable}} placeholders
  let preview = template.content;
  const variables = body.variables || {};
  if (typeof variables === 'object') {
    for (const [key, value] of Object.entries(variables)) {
      const safeKey = validateString(key, 50);
      const safeValue = validateString(String(value), 500);
      if (safeKey) {
        preview = preview.replace(new RegExp(`\\{\\{${safeKey}\\}\\}`, 'g'), safeValue);
      }
    }
  }

  return c.json({ preview, format: template.format });
});
