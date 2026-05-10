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
        max_tokens: 2048,
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

    return c.json({ ok: true, result: result.trim().slice(0, 3800) });
  } catch (err: any) {
    return c.json({ error: `AI 请求异常: ${err.message}` }, 502);
  }
});

// AI create task from natural language
aiRoutes.post('/create-task', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const settings = await dbGet<any>(c.env.DB, 'SELECT api_url, api_key, model, enabled FROM ai_settings WHERE id = 1');

  if (!settings || !settings.enabled) {
    return c.json({ error: 'AI 功能未启用，请在 AI 设置中配置' }, 400);
  }

  const { message } = await c.req.json();
  if (!message || typeof message !== 'string') {
    return c.json({ error: '请输入描述' }, 400);
  }
  if (message.length > 2000) {
    return c.json({ error: '描述过长，最多 2000 字' }, 400);
  }

  // Get existing webhooks, templates, sources for context
  const { dbAll: dbAllFn } = await import('../db/index');
  const webhooks = await dbAllFn(c.env.DB, 'SELECT id, name, webhook_url FROM webhook_configs WHERE user_id = ?', userId);
  const templates = await dbAllFn(c.env.DB, 'SELECT id, name, format, content FROM message_templates WHERE user_id = ?', userId);
  const sources = await dbAllFn(c.env.DB, 'SELECT id, name, source_type, source_url FROM content_sources WHERE user_id = ?', userId);

  const webhookList = webhooks.map((w: any) => `id=${w.id} name="${w.name}" url=${w.webhook_url}`).join('\n');
  const templateList = templates.map((t: any) => `id=${t.id} name="${t.name}" format=${t.format}`).join('\n');
  const sourceList = sources.map((s: any) => `id=${s.id} name="${s.name}" type=${s.source_type} url=${s.source_url || ''}`).join('\n');

  const systemPrompt = `你是一个企微推送任务创建助手。用户会用自然语言描述想要创建的推送任务，你需要解析成结构化的 JSON。

## 输出格式
严格输出以下 JSON，不要输出任何其他内容：
{
  "task_name": "任务名称（简短描述）",
  "webhook_id": 使用现有webhook的id，或0表示新建,
  "webhook_name": "webhook名称（新建时需要）",
  "webhook_url": "webhook URL（新建时需要）",
  "source_id": 使用现有内容源的id，或0表示不需要,
  "source_type": "内容源类型: rss/website/server-monitor/news-briefing/custom/none",
  "source_url": "内容源URL（website/rss类型需要）",
  "source_config": {内容源配置对象，server-monitor/news-briefing需要},
  "template_name": "模板名称",
  "template_format": "markdown 或 text",
  "template_content": "模板内容，用 {{title}} {{url}} {{content}} 等占位符",
  "schedule_type": "cron 或 interval",
  "cron_expr": "cron表达式（schedule_type=cron时）",
  "interval_minutes": 间隔分钟数（schedule_type=interval时）,
  "enabled": true
}

## 用户可选的 webhook：
${webhookList || '暂无'}

## 用户可选的内容源：
${sourceList || '暂无'}

## 用户可选的模板：
${templateList || '暂无'}

## 规则：
- 如果用户说"推送到xxx"，匹配现有 webhook；如果没有匹配，新建
- 如果用户说"爬取xxx网页"，创建 website 类型内容源
- 如果用户说"定时"，设置 cron 或 interval
- 如果用户说"循环"，使用 interval
- 如果用户没指定时间，默认每小时一次
- 如果用户只是想推送一段固定文字，不需要内容源，source_type 用 none
- 推送 markdown 格式优先`;

  try {
    const resp = await fetch(settings.api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.api_key}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        max_tokens: 8192,
        temperature: 0.3,
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

    // Parse JSON from AI response
    let taskConfig: any;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI 未返回有效 JSON');
      taskConfig = JSON.parse(jsonMatch[0]);
    } catch (e: any) {
      return c.json({ error: `AI 解析失败: ${e.message}`, raw: result }, 502);
    }

    return c.json({ ok: true, config: taskConfig });
  } catch (err: any) {
    return c.json({ error: `AI 请求异常: ${err.message}` }, 502);
  }
});

// Confirm and create task from AI config
aiRoutes.post('/confirm-task', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const { config } = await c.req.json();
  if (!config) return c.json({ error: '缺少任务配置' }, 400);

  const { dbAll: dbAllFn, dbInsert } = await import('../db/index');

  // 1. Create or use webhook
  let webhookId = config.webhook_id || 0;
  if (!webhookId && config.webhook_url) {
    const result = await dbInsert(c.env.DB,
      'INSERT INTO webhook_configs (user_id, name, webhook_url) VALUES (?, ?, ?)',
      userId, config.webhook_name || 'AI 创建的 Webhook', config.webhook_url
    );
    webhookId = result.meta?.last_row_id;
  }
  if (!webhookId) return c.json({ error: '请选择或填写 Webhook' }, 400);

  // 2. Create content source (if needed)
  let sourceId = config.source_id || 0;
  if (!sourceId && config.source_type && config.source_type !== 'none') {
    const result = await dbInsert(c.env.DB,
      'INSERT INTO content_sources (user_id, name, source_type, source_url, keyword, fetch_interval, config) VALUES (?, ?, ?, ?, ?, ?, ?)',
      userId, config.template_name || 'AI 创建的内容源', config.source_type,
      config.source_url || '', '', 3600,
      JSON.stringify(config.source_config || {})
    );
    sourceId = result.meta?.last_row_id;
  }

  // 3. Create template
  const tplResult = await dbInsert(c.env.DB,
    'INSERT INTO message_templates (user_id, name, format, content, description) VALUES (?, ?, ?, ?, ?)',
    userId, config.template_name || 'AI 创建的模板',
    config.template_format || 'markdown',
    config.template_content || '{{content}}',
    '由 AI 创建'
  );
  const templateId = tplResult.meta?.last_row_id;

  // 4. Create schedule task
  let nextRunAt = null;
  if (config.schedule_type === 'interval' && config.interval_minutes > 0) {
    nextRunAt = new Date(Date.now() + config.interval_minutes * 60000).toISOString();
  }

  const schedResult = await dbInsert(c.env.DB,
    `INSERT INTO scheduled_tasks (user_id, template_id, webhook_id, source_id, cron_expr, interval_minutes, enabled, next_run_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    userId, templateId, webhookId, sourceId || null,
    config.cron_expr || '', config.interval_minutes || 0,
    config.enabled !== false ? 1 : 0, nextRunAt
  );

  return c.json({
    ok: true,
    task_id: schedResult.meta?.last_row_id,
    message: `任务「${config.task_name || config.template_name}」已创建`
  });
});
