import { Hono } from 'hono';
import { dbGet, dbAll, dbRun, dbInsert, validateId, validateString, validateUrl } from '../db/index';
import { authMiddleware } from '../middleware/auth';
import { fetchBySourceType, fetchBrowserRender } from './content-fetch';

export const contentSourceRoutes = new Hono();
contentSourceRoutes.use('*', authMiddleware);

// Get all content sources
contentSourceRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const sources = await dbAll(
    c.env.DB,
    'SELECT * FROM content_sources WHERE user_id = ? ORDER BY created_at DESC',
    userId
  );
  return c.json({ sources });
});

// Get single content source
contentSourceRoutes.get('/:id', async (c) => {
  const userId = c.get('userId');
  const id = validateId(c.req.param('id'));
  if (id === null) return c.json({ error: '无效 ID' }, 400);

  const source = await dbGet(
    c.env.DB,
    'SELECT * FROM content_sources WHERE id = ? AND user_id = ?',
    id, userId
  );
  if (!source) return c.json({ error: '未找到' }, 404);
  return c.json({ source });
});

// Create content source
contentSourceRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: '请求格式错误' }, 400); }

  const name = validateString(body.name, 100);
  const source_type = validateString(body.source_type, 50);
  const source_url = validateString(body.source_url, 500);
  const keyword = validateString(body.keyword, 200);
  const fetch_interval = Math.min(Math.max(parseInt(body.fetch_interval) || 3600, 60), 86400);
  const config = validateString(body.config, 2000);

  if (!name || !source_type) {
    return c.json({ error: '名称和类型不能为空' }, 400);
  }

  const validTypes = ['rss', 'website', 'keyword', 'article', 'server-monitor', 'news-briefing', 'api-call', 'browser-render'];
  if (!validTypes.includes(source_type)) {
    return c.json({ error: '无效的内容类型' }, 400);
  }

  if (source_url && !validateUrl(source_url)) {
    return c.json({ error: 'URL 格式无效' }, 400);
  }

  const result = await dbInsert(
    c.env.DB,
    'INSERT INTO content_sources (user_id, name, source_type, source_url, keyword, fetch_interval, config) VALUES (?, ?, ?, ?, ?, ?, ?)',
    userId, name, source_type, source_url, keyword, fetch_interval, config || '{}'
  );

  const source = await dbGet(c.env.DB, 'SELECT * FROM content_sources WHERE id = ?', result.meta.last_row_id);
  return c.json({ source }, 201);
});

// Update content source
contentSourceRoutes.put('/:id', async (c) => {
  const userId = c.get('userId');
  const id = validateId(c.req.param('id'));
  if (id === null) return c.json({ error: '无效 ID' }, 400);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: '请求格式错误' }, 400); }

  const name = validateString(body.name, 100);
  const source_type = validateString(body.source_type, 50);
  const source_url = validateString(body.source_url, 500);
  const keyword = validateString(body.keyword, 200);
  const fetch_interval = Math.min(Math.max(parseInt(body.fetch_interval) || 3600, 60), 86400);
  const is_active = body.is_active === 1 || body.is_active === 0 ? body.is_active : 1;
  const config = validateString(body.config, 2000);

  if (!name || !source_type) {
    return c.json({ error: '名称和类型不能为空' }, 400);
  }

  const existing = await dbGet(
    c.env.DB,
    'SELECT * FROM content_sources WHERE id = ? AND user_id = ?',
    id, userId
  );
  if (!existing) return c.json({ error: '未找到' }, 404);

  await dbRun(
    c.env.DB,
    `UPDATE content_sources SET name=?, source_type=?, source_url=?, keyword=?, fetch_interval=?, is_active=?, config=?, updated_at=datetime('now') WHERE id=?`,
    name, source_type, source_url, keyword, fetch_interval, is_active, config || '{}', id
  );

  const source = await dbGet(c.env.DB, 'SELECT * FROM content_sources WHERE id = ?', id);
  return c.json({ source });
});

// Delete content source
contentSourceRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = validateId(c.req.param('id'));
  if (id === null) return c.json({ error: '无效 ID' }, 400);

  const existing = await dbGet(
    c.env.DB,
    'SELECT * FROM content_sources WHERE id = ? AND user_id = ?',
    id, userId
  );
  if (!existing) return c.json({ error: '未找到' }, 404);

  await dbRun(c.env.DB, 'DELETE FROM content_sources WHERE id = ?', id);
  return c.json({ ok: true });
});

// Test fetch content source - with SSRF protection
contentSourceRoutes.post('/:id/test', async (c) => {
  const userId = c.get('userId');
  const id = validateId(c.req.param('id'));
  if (id === null) return c.json({ error: '无效 ID' }, 400);

  const source = await dbGet<any>(
    c.env.DB,
    'SELECT * FROM content_sources WHERE id = ? AND user_id = ?',
    id, userId
  );
  if (!source) return c.json({ error: '未找到' }, 404);

  // SSRF protection: validate URL before fetching
  if (source.source_url) {
    try {
      const url = new URL(source.source_url);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return c.json({ error: '仅支持 http/https URL' }, 400);
      }
      // Block private IPs
      const hostname = url.hostname;
      if (
        hostname === 'localhost' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        hostname === '0.0.0.0' ||
        hostname === '[::1]'
      ) {
        return c.json({ error: '不允许访问内网地址' }, 403);
      }
    } catch {
      return c.json({ error: 'URL 格式无效' }, 400);
    }
  }

  try {
    const cfg = typeof source.config === 'string' ? JSON.parse(source.config || '{}') : (source.config || {});
    // Special types with custom fetch handlers
    if (source.source_type === 'server-monitor' || source.source_type === 'news-briefing' || source.source_type === 'api-call' || source.source_type === 'browser-render') {
      if ((source.source_type === 'api-call' || source.source_type === 'browser-render') && source.source_url && !cfg.url) {
        cfg.url = source.source_url;
      }
      const content = await fetchBySourceType(source.source_type, cfg);
      return c.json({ ok: true, content: content.slice(0, 4000) });
    }

    let content = '';

    if (source.source_type === 'rss' && source.source_url) {
      const resp = await fetch(source.source_url, {
        signal: AbortSignal.timeout(10000), // 10s timeout
      });
      const text = await resp.text();
      // Simple RSS parse - extract titles
      const titles = text.match(/<title[^>]*>([^<]+)<\/title>/gi) || [];
      content = titles.slice(0, 5).map((t: string) => t.replace(/<\/?title[^>]*>/gi, '')).join('\n');
    } else if (source.source_type === 'website' && source.source_url) {
      // Multi-URL support: split by comma
      const urls = source.source_url.split(',').map((u: string) => u.trim()).filter(Boolean);
      const firstUrl = urls[0] || source.source_url;
      const resp = await fetch(firstUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UAMME/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      const raw = await resp.text();
      // Detect JS-rendered pages (SPA)
      const textOnly = raw.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const scriptRatio = (raw.match(/<script/gi) || []).length;
      if (textOnly.length < 100 || scriptRatio > 3) {
        // Auto-fallback to Browserless
        const aiSettings = await dbGet<any>(c.env.DB, 'SELECT browserless_token, browserless_url FROM ai_settings WHERE id = 1');
        if (aiSettings?.browserless_token) {
          try {
            content = await fetchBrowserRender({
              url: firstUrl,
              api_token: aiSettings.browserless_token,
              api_url: aiSettings.browserless_url || 'https://chrome.browserless.io/content',
              limit: cfg.limit || 10,
            });
          } catch (e: any) {
            content = '⚠️ 浏览器渲染失败：' + e.message + '\n\n原始 HTML 前 500 字符：\n' + raw.slice(0, 500);
          }
        } else {
          content = '⚠️ 该网站需要 JavaScript 渲染，请在 AI 设置中配置 Browserless API Token 以启用自动渲染。\n\n原始 HTML 前 500 字符：\n' + raw.slice(0, 500);
        }
      } else {
        content = textOnly.slice(0, 3000);
      }
    } else if (source.source_type === 'keyword' && source.keyword) {
      content = `关键词"${source.keyword}"的内容抓取功能开发中...`;
    } else if (source.source_type === 'article' && source.source_url) {
      const artUrl = source.source_url.split(',')[0].trim();
      const resp = await fetch(artUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UAMME/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      const raw = await resp.text();
      const textOnly = raw.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (textOnly.length < 100) {
        // Auto-fallback to Browserless
        const aiSettings = await dbGet<any>(c.env.DB, 'SELECT browserless_token, browserless_url FROM ai_settings WHERE id = 1');
        if (aiSettings?.browserless_token) {
          try {
            content = await fetchBrowserRender({
              url: artUrl,
              api_token: aiSettings.browserless_token,
              api_url: aiSettings.browserless_url || 'https://chrome.browserless.io/content',
              limit: cfg.limit || 10,
            });
          } catch (e: any) {
            content = '⚠️ 浏览器渲染失败：' + e.message;
          }
        } else {
          content = '⚠️ 该文章页面需要 JavaScript 渲染，请在 AI 设置中配置 Browserless API Token。';
        }
      } else {
        content = textOnly.slice(0, 3000);
      }
    }

    return c.json({ ok: true, content: content.slice(0, 2000) });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});
