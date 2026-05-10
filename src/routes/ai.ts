import { Hono } from 'hono';
import { dbGet, dbRun } from '../db/index';
import { authMiddleware } from '../middleware/auth';

export const aiRoutes = new Hono();

// Get AI settings (admin only)
aiRoutes.get('/settings', authMiddleware, async (c) => {
  const userId = c.get('userId');
  if (userId !== 1) return c.json({ error: '无权操作' }, 403);

  const settings = await dbGet<any>(c.env.DB, 'SELECT id, api_url, api_key, model, enabled, agent_url, agent_key, agent_enabled, browserless_token, browserless_url FROM ai_settings WHERE id = 1');
  return c.json({ settings: settings || { api_url: '', api_key: '', model: 'mimo-v2.5', enabled: 0, agent_url: '', agent_key: '', agent_enabled: 0 } });
});

// Update AI settings (admin only)
aiRoutes.put('/settings', authMiddleware, async (c) => {
  const userId = c.get('userId');
  if (userId !== 1) return c.json({ error: '无权操作' }, 403);

  const { api_url, api_key, model, enabled, agent_url, agent_key, agent_enabled, browserless_token, browserless_url } = await c.req.json();

  if (!api_url || typeof api_url !== 'string') return c.json({ error: 'API 地址必填' }, 400);
  if (!api_key || typeof api_key !== 'string') return c.json({ error: 'API 密钥必填' }, 400);
  if (!model || typeof model !== 'string') return c.json({ error: '模型名称必填' }, 400);

  try { new URL(api_url); } catch { return c.json({ error: 'API 地址格式错误' }, 400); }
  if (agent_url) { try { new URL(agent_url); } catch { return c.json({ error: 'Agent URL 格式错误' }, 400); } }

  await dbRun(c.env.DB, `
    INSERT INTO ai_settings (id, api_url, api_key, model, enabled, agent_url, agent_key, agent_enabled, browserless_token, browserless_url, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET api_url=?, api_key=?, model=?, enabled=?, agent_url=?, agent_key=?, agent_enabled=?, browserless_token=?, browserless_url=?, updated_at=datetime('now')
  `, api_url, api_key, model, enabled ? 1 : 0, agent_url || '', agent_key || '', agent_enabled ? 1 : 0, browserless_token || '', browserless_url || 'https://chrome.browserless.io/content',
     api_url, api_key, model, enabled ? 1 : 0, agent_url || '', agent_key || '', agent_enabled ? 1 : 0, browserless_token || '', browserless_url || 'https://chrome.browserless.io/content');

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
    const useAgent = settings.agent_enabled && settings.agent_url;
    const apiUrl = useAgent ? settings.agent_url : settings.api_url;
    const apiKey = useAgent ? settings.agent_key : settings.api_key;
    const mdl = useAgent ? 'hermes-agent' : settings.model;

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: mdl,
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
  const settings = await dbGet<any>(c.env.DB, 'SELECT api_url, api_key, model, enabled, agent_url, agent_key, agent_enabled, browserless_token, browserless_url FROM ai_settings WHERE id = 1');

  if (!settings || !settings.enabled) {
    return c.json({ error: 'AI 功能未启用，请在 AI 设置中配置' }, 400);
  }

  const { message, messages: hist } = await c.req.json();
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

  const systemPrompt = `你是一个企微推送任务创建助手。用户会用自然语言描述想要创建的推送任务。

你的工作流程：
1. 先理解用户需求，如果信息不足就追问（比如：推送到哪里？多久推一次？）
2. 信息足够后，生成 JSON 配置
3. 生成配置时，严格输出以下 JSON，不要输出任何其他内容：
{
  "task_name": "任务名称",
  "webhook_id": 现有webhook的id或0,
  "webhook_name": "webhook名称（新建时需要）",
  "webhook_url": "webhook URL（新建时需要）",
  "source_id": 现有内容源id或0,
  "source_type": "rss/website/server-monitor/news-briefing/api-call/browser-render/none",
  "source_url": "内容源URL",
  "source_config": {},
  "template_name": "模板名称",
  "template_format": "markdown",
  "template_content": "模板内容（用 {{title}} {{content}} {{date}} 占位符）",
  "schedule_type": "cron 或 interval",
  "cron_expr": "cron表达式",
  "interval_minutes": 间隔分钟数,
  "enabled": 1
}

## Webhook：
${webhookList || '暂无'}

## 内容源：
${sourceList || '暂无'}

## 模板：
${templateList || '暂无'}

## 规则：
- 推送到xxx → 匹配 webhook
- 爬取xxx → website 类型
- 定时 → cron/interval
- 没指定时间 → 默认每小时
- 只推送固定文字 → source_type=none
- markdown 格式优先
- 模板默认格式：emoji+标题\n📅 {{date}}\n\n{{content}}`;

  // Build messages array: system + history + current user message
  const msgArr = [{ role: 'system', content: systemPrompt }];
  if (Array.isArray(hist) && hist.length > 0) {
    // Keep last 10 messages for context
    const recent = hist.slice(-10);
    for (const m of recent) {
      if (m.role === 'user' || m.role === 'assistant') {
        msgArr.push({ role: m.role, content: m.content });
      }
    }
  }
  msgArr.push({ role: 'user', content: message });

  try {
    // Use agent if configured, otherwise use model API
    const useAgent = settings.agent_enabled && settings.agent_url;
    const apiUrl = useAgent ? settings.agent_url : settings.api_url;
    const apiKey = useAgent ? settings.agent_key : settings.api_key;
    const mdl = useAgent ? 'hermes-agent' : settings.model;

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: mdl,
        messages: msgArr,
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

    // Try to parse JSON from AI response; if not JSON, return as conversational reply
    let taskConfig: any;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('not json');
      taskConfig = JSON.parse(jsonMatch[0]);
    } catch (e: any) {
      // Return as conversational reply
      return c.json({ ok: true, reply: result.slice(0, 2000) });
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
