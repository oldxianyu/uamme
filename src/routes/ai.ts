import { Hono } from 'hono';
import { dbGet, dbRun } from '../db/index';
import { authMiddleware } from '../middleware/auth';

export const aiRoutes = new Hono();

// Get AI settings (admin only)
aiRoutes.get('/settings', authMiddleware, async (c) => {
  const userId = c.get('userId');
  if (userId !== 1) return c.json({ error: '无权操作' }, 403);

  const settings = await dbGet<any>(c.env.DB, 'SELECT id, api_url, api_key, model, enabled FROM ai_settings WHERE id = 1');
  return c.json({ settings: settings || { api_url: '', api_key: '', model: 'mimo-v2.5', enabled: 0 } });
});

// Update AI settings (admin only)
aiRoutes.put('/settings', authMiddleware, async (c) => {
  const userId = c.get('userId');
  if (userId !== 1) return c.json({ error: '无权操作' }, 403);

  const { api_url, api_key, model, enabled } = await c.req.json();

  if (!api_url || typeof api_url !== 'string') return c.json({ error: 'API 地址必填' }, 400);
  if (!api_key || typeof api_key !== 'string') return c.json({ error: 'API 密钥必填' }, 400);
  if (!model || typeof model !== 'string') return c.json({ error: '模型名称必填' }, 400);

  // Validate URL format
  try { new URL(api_url); } catch { return c.json({ error: 'API 地址格式错误' }, 400); }

  await dbRun(c.env.DB, `
    INSERT INTO ai_settings (id, api_url, api_key, model, enabled, updated_at)
    VALUES (1, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET api_url=?, api_key=?, model=?, enabled=?, updated_at=datetime('now')
  `, api_url, api_key, model, enabled ? 1 : 0, api_url, api_key, model, enabled ? 1 : 0);

  return c.json({ ok: true });
});

// Optimize content with AI
aiRoutes.post('/optimize', authMiddleware, async (c) => {
  const settings = await dbGet<any>(c.env.DB, 'SELECT api_url, api_key, model, enabled FROM ai_settings WHERE id = 1');

  if (!settings || !settings.enabled) {
    return c.json({ error: 'AI 功能未启用，请在设置中配置' }, 400);
  }

  const { content, action } = await c.req.json();

  if (!content || typeof content !== 'string') {
    return c.json({ error: '请输入内容' }, 400);
  }

  if (content.length > 5000) {
    return c.json({ error: '内容过长，最多 5000 字' }, 400);
  }

  const prompts: Record<string, string> = {
    'summarize': '请将以下内容精简为适合企业微信推送的摘要，保留关键信息，控制在 200 字以内：\n\n',
    'rewrite': '请润色以下推送内容，使其更专业、更易读，保持原意：\n\n',
    'title': '请为以下内容生成一个简洁有力的标题（10字以内）：\n\n',
    'markdown': '请将以下内容转换为适合企业微信 Markdown 推送的格式：\n\n',
    'emoji': '请为以下推送内容添加合适的 emoji，使其更生动：\n\n',
  };

  const prompt = prompts[action] || prompts['rewrite'];
  const fullPrompt = prompt + content;

  try {
    const resp = await fetch(settings.api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.api_key}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: 'user', content: fullPrompt }],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    const data = await resp.json() as any;

    if (!resp.ok) {
      return c.json({ error: `AI 请求失败: ${data.error?.message || resp.statusText}` }, 502);
    }

    const result = data.choices?.[0]?.message?.content;
    if (!result) {
      return c.json({ error: 'AI 返回为空' }, 502);
    }

    return c.json({ ok: true, result: result.trim() });
  } catch (err: any) {
    return c.json({ error: `AI 请求异常: ${err.message}` }, 502);
  }
});
