// Schedule routes: CRUD for scheduled tasks + scheduler logic
import { Hono } from 'hono';
import { dbGet, dbAll, dbInsert } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { fetchBySourceType, fetchBrowserRender } from './content-fetch.js';

const schedule = new Hono();
schedule.use('*', authMiddleware);

// Helper to get DB from context
function getDB(c: any): D1Database {
  return c.env.DB;
}

// Simple cron parser for basic expressions (supports timezone)
function parseCron(expr: string, tz: string = 'Asia/Shanghai'): ((date: Date) => boolean) | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return null;
  const [min, hour, dom, month, dow] = parts;

  function matchField(field: string, val: number): boolean {
    if (field === '*') return true;
    const stepMatch = field.match(/^\*\/(\d+)$/);
    if (stepMatch) return val % parseInt(stepMatch[1]) === 0;
    if (field.includes(',')) return field.split(',').some(v => matchField(v.trim(), val));
    const rangeMatch = field.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) return val >= parseInt(rangeMatch[1]) && val <= parseInt(rangeMatch[2]);
    return parseInt(field) === val;
  }

  return (date: Date) => {
    // Convert UTC to target timezone
    const local = new Date(date.toLocaleString('en-US', { timeZone: tz }));
    return (
      matchField(min, local.getMinutes()) &&
      matchField(hour, local.getHours()) &&
      matchField(dom, local.getDate()) &&
      matchField(month, local.getMonth() + 1) &&
      matchField(dow, local.getDay())
    );
  };
}

function computeNextInterval(lastRunAt: string | null, intervalMinutes: number): string {
  const now = new Date();
  if (lastRunAt) {
    const last = new Date(lastRunAt);
    const next = new Date(last.getTime() + intervalMinutes * 60000);
    if (next > now) return next.toISOString();
  }
  return new Date(now.getTime() + intervalMinutes * 60000).toISOString();
}

function computeNextCron(expr: string, lastRunAt: string | null): string | null {
  const matcher = parseCron(expr);
  if (!matcher) return null;
  const start = lastRunAt ? new Date(lastRunAt) : new Date();
  for (let i = 1; i <= 1440; i++) {
    const candidate = new Date(start.getTime() + i * 60000);
    if (matcher(candidate)) return candidate.toISOString();
  }
  return null;
}

// GET /api/schedule/tasks
schedule.get('/tasks', async (c) => {
  const db = getDB(c);
  const userId = c.get('userId') as number;
  const tasks = await dbAll(db,
    `SELECT s.*, m.name as template_name, w.name as webhook_name, w.webhook_url as webhook_url
     FROM scheduled_tasks s
     LEFT JOIN message_templates m ON s.template_id = m.id
     LEFT JOIN webhook_configs w ON s.webhook_id = w.id
     WHERE s.user_id = ? ORDER BY s.created_at DESC`,
    userId
  );
  for (const task of (tasks as any[])) {
    const lastRun = await dbGet(db,
      `SELECT status, run_at FROM schedule_runs WHERE task_id = ? ORDER BY run_at DESC LIMIT 1`,
      task.id
    );
    task.last_status = (lastRun as any)?.status || null;
  }
  return c.json({ tasks });
});

// POST /api/schedule/tasks
schedule.post('/tasks', async (c) => {
  const db = getDB(c);
  const userId = c.get('userId') as number;
  const body = await c.req.json();
  const { template_id, webhook_id, source_id, cron_expr, interval_minutes, enabled } = body;

  if (!template_id || !webhook_id) {
    return c.json({ error: '模板和 Webhook 必填' }, 400);
  }
  if (!cron_expr && !interval_minutes) {
    return c.json({ error: '请配置定时规则（cron 表达式或间隔分钟数）' }, 400);
  }

  let next_run_at: string | null = null;
  if (interval_minutes > 0) {
    next_run_at = computeNextInterval(null, interval_minutes);
  } else if (cron_expr) {
    next_run_at = computeNextCron(cron_expr, null);
    if (!next_run_at) return c.json({ error: 'cron 表达式无效' }, 400);
  }

  try {
    const result = await dbInsert(db,
      `INSERT INTO scheduled_tasks (user_id, template_id, webhook_id, source_id, cron_expr, interval_minutes, enabled, next_run_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      userId, template_id, webhook_id, source_id || null, cron_expr || '', interval_minutes || 0, enabled !== undefined ? (enabled ? 1 : 0) : 1, next_run_at
    );
    return c.json({ ok: true, task_id: result.meta?.last_row_id });
  } catch (e: any) {
    return c.json({ error: '数据库错误: ' + e.message }, 500);
  }
});

// PUT /api/schedule/tasks/:id
schedule.put('/tasks/:id', async (c) => {
  const db = getDB(c);
  const userId = c.get('userId') as number;
  const taskId = parseInt(c.req.param('id'));
  if (isNaN(taskId)) return c.json({ error: '无效ID' }, 400);

  const existing = await dbGet(db, 'SELECT * FROM scheduled_tasks WHERE id = ? AND user_id = ?', taskId, userId) as any;
  if (!existing) return c.json({ error: '任务不存在' }, 404);

  const body = await c.req.json();
  const { template_id, webhook_id, source_id, cron_expr, interval_minutes, enabled } = body;

  let next_run_at = existing.next_run_at;
  if (interval_minutes !== undefined && interval_minutes > 0) {
    next_run_at = computeNextInterval(existing.last_run_at, interval_minutes);
  } else if (cron_expr !== undefined && cron_expr) {
    next_run_at = computeNextCron(cron_expr, existing.last_run_at);
  }

  await dbInsert(db,
    `UPDATE scheduled_tasks SET template_id=?, webhook_id=?, source_id=?, cron_expr=?, interval_minutes=?, enabled=?, next_run_at=?, updated_at=datetime('now')
     WHERE id=? AND user_id=?`,
    template_id || existing.template_id,
    webhook_id || existing.webhook_id,
    source_id !== undefined ? (source_id || null) : existing.source_id,
    cron_expr !== undefined ? cron_expr : existing.cron_expr,
    interval_minutes !== undefined ? interval_minutes : existing.interval_minutes,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    next_run_at, taskId, userId
  );

  return c.json({ ok: true });
});

// DELETE /api/schedule/tasks/:id
schedule.delete('/tasks/:id', async (c) => {
  const db = getDB(c);
  const userId = c.get('userId') as number;
  const taskId = parseInt(c.req.param('id'));
  if (isNaN(taskId)) return c.json({ error: '无效ID' }, 400);

  const existing = await dbGet(db, 'SELECT id FROM scheduled_tasks WHERE id = ? AND user_id = ?', taskId, userId);
  if (!existing) return c.json({ error: '任务不存在' }, 404);

  await dbInsert(db, 'DELETE FROM schedule_runs WHERE task_id = ?', taskId);
  await dbInsert(db, 'DELETE FROM scheduled_tasks WHERE id = ? AND user_id = ?', taskId, userId);

  return c.json({ ok: true });
});

// GET /api/schedule/tasks/:id/runs
schedule.get('/tasks/:id/runs', async (c) => {
  const db = getDB(c);
  const userId = c.get('userId') as number;
  const taskId = parseInt(c.req.param('id'));
  if (isNaN(taskId)) return c.json({ error: '无效ID' }, 400);

  const existing = await dbGet(db, 'SELECT id FROM scheduled_tasks WHERE id = ? AND user_id = ?', taskId, userId);
  if (!existing) return c.json({ error: '任务不存在' }, 404);

  const runs = await dbAll(db, 'SELECT * FROM schedule_runs WHERE task_id = ? ORDER BY run_at DESC LIMIT 50', taskId);
  return c.json({ runs });
});

// POST /api/schedule/tasks/:id/run-now
schedule.post('/tasks/:id/run-now', async (c) => {
  const db = getDB(c);
  const userId = c.get('userId') as number;
  const taskId = parseInt(c.req.param('id'));
  if (isNaN(taskId)) return c.json({ error: '无效ID' }, 400);

  const task = await dbGet(db,
    `SELECT s.*, w.webhook_url as webhook_url
     FROM scheduled_tasks s
     LEFT JOIN webhook_configs w ON s.webhook_id = w.id
     WHERE s.id = ? AND s.user_id = ?`,
    taskId, userId
  ) as any;
  if (!task) return c.json({ error: '任务不存在' }, 404);
  if (!task.webhook_url) return c.json({ error: 'Webhook 未配置' }, 400);

  const tpl = await dbGet(db, 'SELECT * FROM message_templates WHERE id = ? AND user_id = ?', task.template_id, userId) as any;
  if (!tpl) return c.json({ error: '模板不存在' }, 404);

  let content = tpl.content;
  if (task.source_id) {
    const source = await dbGet(db, 'SELECT * FROM content_sources WHERE id = ? AND user_id = ?', task.source_id, userId) as any;
    if (source) {
      try {
        const cfg = typeof source.config === 'string' ? JSON.parse(source.config || '{}') : (source.config || {});
        if (source.source_type === 'server-monitor' || source.source_type === 'news-briefing' || source.source_type === 'api-call' || source.source_type === 'browser-render') {
          if ((source.source_type === 'api-call' || source.source_type === 'browser-render') && source.source_url && !cfg.url) cfg.url = source.source_url;
          const fetched = await fetchBySourceType(source.source_type, cfg);
          content = content.replace(/\{\{content\}\}/g, fetched);
          content = content.replace(/\{\{date\}\}/g, new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
          content = content.replace(/\{\{title\}\}/g, tpl.name || '');
          content = content.replace(/\{\{body\}\}/g, fetched);
        } else if (source.source_url) {
          const urls = source.source_url.split(',').map((u: string) => u.trim()).filter(Boolean);
      const aiBl = await dbGet(db, 'SELECT browserless_token, browserless_url FROM ai_settings WHERE id = 1') as any;
      const fetchedContents: string[] = [];
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        try {
          if (aiBl?.browserless_token) {
            const f = await fetchBrowserRender({ url, api_token: aiBl.browserless_token, api_url: aiBl.browserless_url || 'https://chrome.browserless.io/content', limit: cfg.limit || 10 });
            fetchedContents.push(f);
          } else {
            const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
            if (resp.ok) fetchedContents.push(await resp.text());
          }
        } catch {}
      }
      if (fetchedContents.length > 0) {
        content = content.replace(/\{\{content\}\}/g, fetchedContents[0] || '');
        content = content.replace(/\{\{body\}\}/g, fetchedContents[1] || fetchedContents[0] || '');
      } else {
        // plain website without browserless
        const resp = await fetch(source.source_url, { signal: AbortSignal.timeout(10000) });
        if (resp.ok) {
          const fetched = await resp.text();
          content = content.replace(/\{\{content\}\}/g, fetched);
          content = content.replace(/\{\{body\}\}/g, fetched);
        }
      }
      content = content.replace(/\{\{date\}\}/g, new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
      content = content.replace(/\{\{title\}\}/g, tpl.name || '');
        }
      } catch {}
    }
  }

  // WeChat Work markdown limit: 4096 chars
  if (tpl.format === 'markdown' && content.length > 4000) {
    content = content.substring(0, 4000) + '\n\n---\n⚠️ 内容过长已截断';
  }

  const body: Record<string, any> = {};
  if (tpl.format === 'markdown') {
    body.msgtype = 'markdown';
    body.markdown = { content };
  } else {
    body.msgtype = 'text';
    body.text = { content: content.substring(0, 2048) };
  }

  let status = 'success';
  let result = '';
  try {
    const resp = await fetch(task.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    result = await resp.text();
    if (!resp.ok) status = 'failed';
  } catch (e: any) {
    status = 'failed';
    result = e.message || 'push failed';
  }

  await dbInsert(db, 'INSERT INTO schedule_runs (task_id, user_id, status, result) VALUES (?, ?, ?, ?)', taskId, userId, status, result);

  // Write to push_logs for dashboard stats
  await dbInsert(db, 'INSERT INTO push_logs (user_id, webhook_id, template_id, status, response_body) VALUES (?, ?, ?, ?, ?)', userId, task.webhook_id, task.template_id, status, result);

  let nextRun: string | null = null;
  if (task.interval_minutes > 0) {
    nextRun = computeNextInterval(new Date().toISOString(), task.interval_minutes);
  } else if (task.cron_expr) {
    nextRun = computeNextCron(task.cron_expr, new Date().toISOString());
  }
  await dbInsert(db, "UPDATE scheduled_tasks SET last_run_at = datetime('now'), next_run_at = ? WHERE id = ?", nextRun, taskId);

  return c.json({ ok: true, status, result: JSON.parse(result || '{}') });
});

// ===== Scheduler: run due tasks =====
export async function runScheduler(db: D1Database): Promise<void> {
  const now = new Date().toISOString();

  const dueTasks = await dbAll(db,
    `SELECT s.*, w.webhook_url as webhook_url
     FROM scheduled_tasks s
     LEFT JOIN webhook_configs w ON s.webhook_id = w.id
     WHERE s.enabled = 1 AND s.next_run_at IS NOT NULL AND s.next_run_at <= ?`,
    [now]
  );

  for (const task of (dueTasks as any[])) {
    if (!task.webhook_url) continue;

    const tpl = await dbGet(db, 'SELECT * FROM message_templates WHERE id = ?', task.template_id) as any;
    if (!tpl) continue;

    let content = tpl.content;
    if (task.source_id) {
      const source = await dbGet(db, 'SELECT * FROM content_sources WHERE id = ?', task.source_id) as any;
      if (source) {
        try {
          const cfg = typeof source.config === 'string' ? JSON.parse(source.config || '{}') : (source.config || {});
          if (source.source_type === 'server-monitor' || source.source_type === 'news-briefing' || source.source_type === 'api-call' || source.source_type === 'browser-render') {
            if ((source.source_type === 'api-call' || source.source_type === 'browser-render') && source.source_url && !cfg.url) cfg.url = source.source_url;
            const fetched = await fetchBySourceType(source.source_type, cfg);
            content = content.replace(/\{\{content\}\}/g, fetched);
            content = content.replace(/\{\{date\}\}/g, new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
            content = content.replace(/\{\{title\}\}/g, tpl.name || '');
            content = content.replace(/\{\{body\}\}/g, fetched);
          } else if (source.source_url) {
            const urls = source.source_url.split(',').map((u: string) => u.trim()).filter(Boolean);
            const aiBl = await dbGet(db, 'SELECT browserless_token, browserless_url FROM ai_settings WHERE id = 1') as any;
            const fetchedContents: string[] = [];
            for (let i = 0; i < urls.length; i++) {
              const url = urls[i];
              try {
                if (aiBl?.browserless_token) {
                  const f = await fetchBrowserRender({ url, api_token: aiBl.browserless_token, api_url: aiBl.browserless_url || 'https://chrome.browserless.io/content', limit: cfg.limit || 10 });
                  fetchedContents.push(f);
                } else {
                  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
                  if (resp.ok) fetchedContents.push(await resp.text());
                }
              } catch {}
            }
            if (fetchedContents.length > 0) {
              content = content.replace(/\{\{content\}\}/g, fetchedContents[0] || '');
              content = content.replace(/\{\{body\}\}/g, fetchedContents[1] || fetchedContents[0] || '');
            } else {
              const resp = await fetch(source.source_url.split(',')[0].trim(), { signal: AbortSignal.timeout(10000) });
              if (resp.ok) {
                const fetched = await resp.text();
                content = content.replace(/\{\{content\}\}/g, fetched);
                content = content.replace(/\{\{body\}\}/g, fetched);
              }
            }
            content = content.replace(/\{\{date\}\}/g, new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
            content = content.replace(/\{\{title\}\}/g, tpl.name || '');
          }
        } catch {}
      }
    }

    // WeChat Work markdown limit: 4096 chars
    if (tpl.format === 'markdown' && content.length > 4000) {
      content = content.substring(0, 4000) + '\n\n---\n⚠️ 内容过长已截断';
    }

    const body: Record<string, any> = {};
    if (tpl.format === 'markdown') {
      body.msgtype = 'markdown';
      body.markdown = { content };
    } else {
      body.msgtype = 'text';
      body.text = { content: content.substring(0, 2048) };
    }

    let status = 'success';
    let result = '';
    try {
      const resp = await fetch(task.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      result = await resp.text();
      if (!resp.ok) status = 'failed';
    } catch (e: any) {
      status = 'failed';
      result = e.message;
    }

    await dbInsert(db, 'INSERT INTO schedule_runs (task_id, user_id, status, result) VALUES (?, ?, ?, ?)', task.id, task.user_id, status, result);

    // Write to push_logs for dashboard stats
    await dbInsert(db, 'INSERT INTO push_logs (user_id, webhook_id, template_id, status, response_body) VALUES (?, ?, ?, ?, ?)', task.user_id, task.webhook_id, task.template_id, status, result);

    let nextRun: string | null = null;
    if (task.interval_minutes > 0) {
      nextRun = computeNextInterval(task.last_run_at, task.interval_minutes);
    } else if (task.cron_expr) {
      nextRun = computeNextCron(task.cron_expr, task.last_run_at);
    }

    await dbInsert(db, "UPDATE scheduled_tasks SET last_run_at = datetime('now'), next_run_at = ? WHERE id = ?", nextRun, task.id);
  }
}

export default schedule;
