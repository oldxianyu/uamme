import { Hono } from 'hono';
import { dbGet, dbAll, dbRun, dbInsert, validateId, validateString } from '../db/index';
import { authMiddleware } from '../middleware/auth';

export const customContentRoutes = new Hono();
customContentRoutes.use('*', authMiddleware);

// Get all custom contents
customContentRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const contents = await dbAll(
    c.env.DB,
    'SELECT * FROM custom_contents WHERE user_id = ? ORDER BY created_at DESC',
    userId
  );
  return c.json({ contents });
});

// Get single custom content
customContentRoutes.get('/:id', async (c) => {
  const userId = c.get('userId');
  const id = validateId(c.req.param('id'));
  if (id === null) return c.json({ error: '无效 ID' }, 400);

  const content = await dbGet(
    c.env.DB,
    'SELECT * FROM custom_contents WHERE id = ? AND user_id = ?',
    id, userId
  );
  if (!content) return c.json({ error: '未找到' }, 404);
  return c.json({ content });
});

// Create custom content
customContentRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: '请求格式错误' }, 400); }

  const title = validateString(body.title, 200);
  const contentBody = validateString(body.body, 10000);
  const template_id = body.template_id ? validateId(String(body.template_id)) : null;

  if (!title) {
    return c.json({ error: '标题不能为空' }, 400);
  }

  const result = await dbInsert(
    c.env.DB,
    'INSERT INTO custom_contents (user_id, title, body, template_id) VALUES (?, ?, ?, ?)',
    userId, title, contentBody, template_id
  );

  const content = await dbGet(c.env.DB, 'SELECT * FROM custom_contents WHERE id = ?', result.meta.last_row_id);
  return c.json({ content }, 201);
});

// Update custom content
customContentRoutes.put('/:id', async (c) => {
  const userId = c.get('userId');
  const id = validateId(c.req.param('id'));
  if (id === null) return c.json({ error: '无效 ID' }, 400);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: '请求格式错误' }, 400); }

  const title = validateString(body.title, 200);
  const contentBody = validateString(body.body, 10000);
  const template_id = body.template_id ? validateId(String(body.template_id)) : null;

  if (!title) {
    return c.json({ error: '标题不能为空' }, 400);
  }

  const existing = await dbGet(
    c.env.DB,
    'SELECT * FROM custom_contents WHERE id = ? AND user_id = ?',
    id, userId
  );
  if (!existing) return c.json({ error: '未找到' }, 404);

  await dbRun(
    c.env.DB,
    `UPDATE custom_contents SET title=?, body=?, template_id=?, updated_at=datetime('now') WHERE id=?`,
    title, contentBody, template_id, id
  );

  const content = await dbGet(c.env.DB, 'SELECT * FROM custom_contents WHERE id = ?', id);
  return c.json({ content });
});

// Delete custom content
customContentRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = validateId(c.req.param('id'));
  if (id === null) return c.json({ error: '无效 ID' }, 400);

  const existing = await dbGet(
    c.env.DB,
    'SELECT * FROM custom_contents WHERE id = ? AND user_id = ?',
    id, userId
  );
  if (!existing) return c.json({ error: '未找到' }, 404);

  await dbRun(c.env.DB, 'DELETE FROM custom_contents WHERE id = ?', id);
  return c.json({ ok: true });
});
