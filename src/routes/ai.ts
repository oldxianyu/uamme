import { Hono } from 'hono';
import { dbGet, dbRun, dbAll } from '../db/index';
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

  const { message } = await c.req.json();
  if (!message || typeof message !== 'string') {
    return c.json({ error: '请输入描述' }, 400);
  }
  if (message.length > 2000) {
    return c.json({ error: '描述过长，最多 2000 字' }, 400);
  }

  // Save user message to database
  try {
    await dbRun(c.env.DB, 'INSERT INTO ai_conversations (user_id, role, content) VALUES (?, ?, ?)', userId, 'user', message);
  } catch (e: any) {
    console.error('Failed to save conversation:', e.message);
  }

  // Load conversation history from database (last 20 messages)
  let history: {role: string, content: string}[] = [];
  try {
    history = await dbAll<{role: string, content: string}>(c.env.DB, 'SELECT role, content FROM ai_conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', userId);
    history.reverse(); // oldest first
  } catch (e: any) {
    console.error('Failed to load conversation history:', e.message);
  }

  // Get existing webhooks, templates, sources, tasks for context
  let webhooks: any[] = [];
  let templates: any[] = [];
  let sources: any[] = [];
  let tasks: any[] = [];
  try {
    webhooks = await dbAll<any>(c.env.DB, 'SELECT id, name, webhook_url FROM webhook_configs WHERE user_id = ?', userId);
    templates = await dbAll<any>(c.env.DB, 'SELECT id, name, format, content FROM message_templates WHERE user_id = ?', userId);
    sources = await dbAll<any>(c.env.DB, 'SELECT id, name, source_type, source_url FROM content_sources WHERE user_id = ?', userId);
    tasks = await dbAll<any>(c.env.DB, `SELECT st.id, t.name as task_name, st.cron_expr, st.interval_minutes, st.enabled, st.source_id, st.webhook_id, st.template_id FROM scheduled_tasks st LEFT JOIN message_templates t ON st.template_id = t.id WHERE st.user_id = ?`, userId);
  } catch (e: any) {
    console.error('Failed to load context:', e.message);
  }

  const webhookList = webhooks.map((w: any) => `id=${w.id} name="${w.name}" url=${w.webhook_url}`).join('\n');
  const templateList = templates.map((t: any) => `id=${t.id} name="${t.name}" format=${t.format} content="${(t.content||'').slice(0,100)}"`).join('\n');
  const sourceList = sources.map((s: any) => `id=${s.id} name="${s.name}" type=${s.source_type} url=${s.source_url}`).join('\n');
  const taskList = tasks.map((t: any) => `id=${t.id} name="${t.task_name || '未命名'}" schedule=${t.cron_expr || `每${t.interval_minutes}分钟`} source_id=${t.source_id} webhook_id=${t.webhook_id} template_id=${t.template_id} enabled=${t.enabled ? '启用' : '停用'}`).join('\n');

  const systemPrompt = `你是 Uamme 企微推送机器人的 AI 管家。

=== 核心原则 ===
1. 果断执行：用户说创建/帮我做/搞一个，直接生成 JSON 配置，不要反问
2. 智能推断：没说的字段用默认值(频率每小时，webhook用第一个)
3. 一次到位：输出完整 JSON，不要分步确认

=== 用户现有资源 ===

Webhook:
${webhookList || '暂无'}

内容源:
${sourceList || '暂无'}

模板:
${templateList || '暂无'}

已创建的任务:
${taskList || '暂无'}

=== 支持的操作 ===

创建任务：用户说创建/新建/帮我搞 -> 输出 JSON 配置
修改任务：用户说改一下/调整/改成 -> 找到对应任务，输出带 action: update 和 task_id 的 JSON
删除任务：用户说删掉/停掉/不要了 -> 输出 {"action": "delete", "task_id": ID}
查询闲聊：用户问有什么任务/状态怎么样 -> 直接自然语言回答，不输出 JSON

=== 内容源类型 ===
- website：抓网页，自动检测JS渲染并用Browserless渲染
- browser-render：用浏览器渲染SPA页面
- api-call：调用REST API
- server-monitor：服务器状态监控
- news-briefing：每日新闻早报
- none：不从内容源获取，直接用模板中的固定文字

=== 模板规则(必须严格遵守) ===

模板中有效占位符:
1. title = 模板名称
2. content = 第一个内容源抓取到的内容
3. date = 当前时间
4. body = 第二个内容源抓取到的内容(仅多源时有效)

使用规则:
- 单源任务：只用 content，不要写 body
- 双源任务：用 content 放第一个源，body 放第二个源
- source_url 用逗号分隔多个URL，顺序对应 content 和 body
- 例如：source_url="https://a.com,https://b.com" 则 content=第一个URL的内容，body=第二个URL的内容
- 不要写多个 content

正确的双源模板格式:
emoji 标题

日期 date

第一个源标题
content

---

第二个源标题
body

例如:
🔥 娱乐推送

📅 date

🟢 36氪热搜 TOP10
content

---

🔴 微博热搜 TOP10
body

一个任务可以配多个内容源:
- source_url 用逗号分隔多个URL
- 每个URL的内容分别填充 content 和 body
- 每个源取前10条，在 source_config 中设置 {"limit": 10}

=== 输出格式 ===

创建任务时严格输出以下JSON:
{
  "task_name": "任务名称",
  "webhook_id": webhook的id,
  "source_id": 内容源id(没有则为0),
  "source_type": "website/api-call/server-monitor/news-briefing/browser-render/none",
  "source_url": "内容源URL(新建内容源时需要)",
  "source_config": {},
  "template_name": "模板名称",
  "template_format": "markdown",
  "template_content": "模板内容",
  "schedule_type": "cron或interval",
  "cron_expr": "cron表达式",
  "interval_minutes": 分钟数,
  "enabled": 1
}

修改任务时加上 "action": "update", "task_id": ID
删除任务时输出 {"action": "delete", "task_id": ID}

=== 智能推断 ===
- 没指定webhook -> 用第一个可用的
- 没指定频率 -> 默认每60分钟
- 没指定内容源类型 -> 根据URL自动判断(有url->website, 无url->none)
- 没指定模板格式 -> markdown
- 没指定模板内容 -> 使用默认格式
- 用户提到之前的/那个/改一下 -> 从已有任务列表匹配并修改
- 停掉xxx -> action=delete
- 改成每30分钟 -> 修改 interval_minutes=30
- 闲聊/问候/问题 -> 直接自然语言回复，不输出 JSON`;

  // Build messages array: system + history + current user message
  const msgArr = [{ role: 'system', content: systemPrompt }];
  for (const m of history) {
    msgArr.push({ role: m.role, content: m.content });
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
      // Save assistant reply to database
      await dbRun(c.env.DB, 'INSERT INTO ai_conversations (user_id, role, content) VALUES (?, ?, ?)', userId, 'assistant', result.slice(0, 2000));
      // Return as conversational reply
      return c.json({ ok: true, reply: result.slice(0, 2000) });
    }

    // Save assistant reply to database
    await dbRun(c.env.DB, 'INSERT INTO ai_conversations (user_id, role, content) VALUES (?, ?, ?)', userId, 'assistant', JSON.stringify(taskConfig));

    return c.json({ ok: true, config: taskConfig });
  } catch (err: any) {
    return c.json({ error: `AI 请求异常: ${err.message}` }, 502);
  }
});

// Clear conversation history
aiRoutes.delete('/conversations', authMiddleware, async (c) => {
  const userId = c.get('userId');
  await dbRun(c.env.DB, 'DELETE FROM ai_conversations WHERE user_id = ?', userId);
  return c.json({ ok: true });
});

// Get conversation history
aiRoutes.get('/conversations', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const messages = await dbAll<any>(c.env.DB, 'SELECT role, content, created_at FROM ai_conversations WHERE user_id = ? ORDER BY created_at ASC LIMIT 50', userId);
  return c.json({ ok: true, messages });
});

// Confirm and create task from AI config
aiRoutes.post('/confirm-task', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const { config } = await c.req.json();
  if (!config) return c.json({ error: '缺少任务配置' }, 400);

  const { dbAll: dbAllFn, dbInsert } = await import('../db/index');

  // Handle DELETE action
  if (config.action === 'delete' && config.task_id) {
    await dbRun(c.env.DB, 'DELETE FROM scheduled_tasks WHERE id = ? AND user_id = ?', config.task_id, userId);
    return c.json({ ok: true, message: `任务 ID ${config.task_id} 已删除` });
  }

  // Handle UPDATE action
  if (config.action === 'update' && config.task_id) {
    const existing = await (await import('../db/index')).dbGet<any>(c.env.DB, 'SELECT * FROM scheduled_tasks WHERE id = ? AND user_id = ?', config.task_id, userId);
    if (!existing) return c.json({ error: `任务 ID ${config.task_id} 不存在` }, 404);

    // Update schedule fields
    const updates: string[] = [];
    const params: any[] = [];
    if (config.interval_minutes !== undefined) { updates.push('interval_minutes = ?'); params.push(config.interval_minutes); }
    if (config.cron_expr !== undefined) { updates.push('cron_expr = ?'); params.push(config.cron_expr); }
    if (config.enabled !== undefined) { updates.push('enabled = ?'); params.push(config.enabled ? 1 : 0); }
    if (config.webhook_id !== undefined) { updates.push('webhook_id = ?'); params.push(config.webhook_id); }
    if (config.source_id !== undefined) { updates.push('source_id = ?'); params.push(config.source_id); }
    if (config.template_id !== undefined) { updates.push('template_id = ?'); params.push(config.template_id); }
    if (updates.length > 0) {
      updates.push('updated_at = datetime("now")');
      params.push(config.task_id, userId);
      await dbRun(c.env.DB, `UPDATE scheduled_tasks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, ...params);
    }

    // Update template content if provided
    if (config.template_content && existing.template_id) {
      await dbRun(c.env.DB, 'UPDATE message_templates SET content = ?, name = COALESCE(?, name) WHERE id = ?',
        config.template_content, config.template_name || null, existing.template_id);
    }

    return c.json({ ok: true, message: `任务 ID ${config.task_id} 已更新` });
  }

  // Handle CREATE action (default)
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
