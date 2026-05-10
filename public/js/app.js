// 优安米 - Main Application Logic
(function() {
  // Auth check
  if (!localStorage.getItem('uamme_token')) {
    window.location.href = '/login.html';
    return;
  }

  let currentPage = 'dashboard';
  let currentUser = null;

  // ===== Navigation =====
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      navigateTo(page);
    });
  });

  function navigateTo(page) {
    currentPage = page;
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${page}`)?.classList.remove('hidden');

    const titles = { dashboard:'控制台', webhooks:'Webhook 配置', templates:'推送模板', sources:'内容源管理', custom:'自定义内容', push:'推送记录', schedule:'定时推送', settings:'账户设置', users:'用户管理', 'ai-settings':'AI 配置' };
    document.getElementById('page-title').textContent = titles[page] || page;
    document.getElementById('topbar-actions').innerHTML = '';

    loadPage(page);
  }

  async function loadPage(page) {
    switch(page) {
      case 'dashboard': return loadDashboard();
      case 'webhooks': return loadWebhooks();
      case 'templates': return loadTemplates();
      case 'sources': return loadSources();
      case 'custom': return loadCustom();
      case 'push': return loadPushLogs();
      case 'schedule': return loadScheduleTasks();
      case 'users': return loadUsers();
      case 'ai-settings': return loadAISettings();
    }
  }

  // ===== User Info =====
  async function loadUser() {
    const data = await API.getMe();
    if (data.user) {
      currentUser = data.user;
      document.getElementById('user-display').textContent = data.user.display_name || data.user.username;
    }
  }

  // ===== Dashboard =====
  async function loadDashboard() {
    const [statsData, pushesData, failuresData] = await Promise.all([
      API.getStats(), API.getRecentPushes(), API.getRecentFailures()
    ]);

    const s = statsData.stats || {};
    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card"><div class="stat-value">${s.webhooks||0}</div><div class="stat-label">Webhook 数量</div></div>
      <div class="stat-card"><div class="stat-value">${s.templates||0}</div><div class="stat-label">模板数量</div></div>
      <div class="stat-card"><div class="stat-value">${s.sources||0}</div><div class="stat-label">内容源数量</div></div>
      <div class="stat-card"><div class="stat-value">${s.totalPushes||0}</div><div class="stat-label">总推送次数</div></div>
      <div class="stat-card"><div class="stat-value" style="color:var(--md-success)">${s.successPushes||0}</div><div class="stat-label">成功推送</div></div>
      <div class="stat-card"><div class="stat-value" style="color:var(--md-error)">${s.failedPushes||0}</div><div class="stat-label">失败推送</div></div>
    `;

    renderPushTable(pushesData.logs || [], 'recent-pushes');
    renderPushTable(failuresData.logs || [], 'recent-failures');
  }

  function renderPushTable(logs, containerId) {
    if (!logs.length) {
      document.getElementById(containerId).innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>暂无记录</p></div>';
      return;
    }
    document.getElementById(containerId).innerHTML = `
      <table class="md-table">
        <thead><tr><th>时间</th><th>目标</th><th>内容</th><th>状态</th></tr></thead>
        <tbody>${logs.map(l => `<tr>
          <td>${formatTime(l.created_at)}</td>
          <td>${esc(l.webhook_name||'--')}</td>
          <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.title||l.body_preview||'')}</td>
          <td><span class="status-dot ${l.status}"></span>${l.status==='success'?'成功':'失败'}</td>
        </tr>`).join('')}</tbody>
      </table>
    `;
  }

  // ===== Webhooks =====
  async function loadWebhooks() {
    const data = await API.getWebhooks();
    const webhooks = data.webhooks || [];
    if (!webhooks.length) {
      document.getElementById('webhook-list').innerHTML = '<div class="empty-state"><div class="icon">🔗</div><h3>暂无 Webhook</h3><p>点击上方按钮添加你的第一个 Webhook</p></div>';
      return;
    }
    document.getElementById('webhook-list').innerHTML = webhooks.map(w => `
      <div class="md-card md-card-outlined mb-16">
        <div class="flex-between">
          <div>
            <div class="flex-center gap-8 mb-8">
              <span class="md-title-medium">${esc(w.name)}</span>
              <span class="md-chip ${w.is_active?'active':''}" style="height:24px;font-size:12px">${w.is_active?'启用':'停用'}</span>
            </div>
            <div class="md-body-small" style="color:var(--md-on-surface-variant);word-break:break-all">${esc(w.webhook_url)}</div>
            ${w.description?`<div class="md-body-small mt-16" style="color:var(--md-on-surface-variant)">${esc(w.description)}</div>`:''}
          </div>
          <div class="flex gap-8">
            <button class="md-btn md-btn-tonal md-btn-sm" onclick="testWebhook(${w.id})">测试</button>
            <button class="md-btn md-btn-outlined md-btn-sm" onclick="showWebhookForm(${w.id})">编辑</button>
            <button class="md-btn md-btn-text md-btn-sm" style="color:var(--md-error)" onclick="deleteWebhook(${w.id},'${esc(w.name)}')">删除</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  window.showWebhookForm = async function(id) {
    let webhook = { name:'', webhook_url:'', description:'', is_active:1 };
    if (id) {
      const data = await API.getWebhook(id);
      webhook = data.webhook || webhook;
    }
    showDialog(id?'编辑 Webhook':'新增 Webhook', `
      <div class="md-field"><label>名称</label><input id="wh-name" value="${esc(webhook.name)}" placeholder="如：测试群机器人"></div>
      <div class="md-field"><label>Webhook URL</label><input id="wh-url" value="${esc(webhook.webhook_url)}" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."></div>
      <div class="md-field"><label>描述</label><input id="wh-desc" value="${esc(webhook.description)}" placeholder="可选"></div>
    `, [
      { text:'取消', class:'md-btn md-btn-text', onclick:'hideDialog()' },
      { text:'保存', class:'md-btn md-btn-filled', onclick:`saveWebhook(${id||'null'})` }
    ]);
  };

  window.saveWebhook = async function(id) {
    const data = {
      name: document.getElementById('wh-name').value.trim(),
      webhook_url: document.getElementById('wh-url').value.trim(),
      description: document.getElementById('wh-desc').value.trim(),
      is_active: 1
    };
    if (!data.name || !data.webhook_url) { showSnackbar('请填写名称和 URL'); return; }
    if (id) await API.updateWebhook(id, data);
    else await API.createWebhook(data);
    hideDialog(); showSnackbar(id?'已更新':'已创建'); loadWebhooks();
  };

  window.deleteWebhook = function(id, name) {
    showDialog('确认删除', `<p>确定要删除 Webhook「${esc(name)}」吗？</p>`, [
      { text:'取消', class:'md-btn md-btn-text', onclick:'hideDialog()' },
      { text:'删除', class:'md-btn md-btn-error', onclick:`doDeleteWebhook(${id})` }
    ]);
  };

  window.doDeleteWebhook = async function(id) {
    await API.deleteWebhook(id); hideDialog(); showSnackbar('已删除'); loadWebhooks();
  };

  window.testWebhook = async function(id) {
    showSnackbar('正在发送测试...');
    const data = await API.testWebhook(id, '🏓 优安米测试推送\n\n这是一条测试消息，来自优安米平台。', 'text');
    if (data.ok) showSnackbar('✅ 推送成功');
    else showSnackbar('❌ 推送失败: ' + (data.error || data.response?.errmsg || '未知错误'));
  };

  // ===== Templates =====
  async function loadTemplates() {
    const data = await API.getTemplates();
    const templates = data.templates || [];
    if (!templates.length) {
      document.getElementById('template-list').innerHTML = '<div class="empty-state"><div class="icon">📝</div><h3>暂无模板</h3><p>创建推送模板以复用内容格式</p></div>';
      return;
    }
    document.getElementById('template-list').innerHTML = templates.map(t => `
      <div class="md-card md-card-outlined mb-16">
        <div class="flex-between">
          <div>
            <div class="flex-center gap-8 mb-8">
              <span class="md-title-medium">${esc(t.name)}</span>
              <span class="md-chip" style="height:24px;font-size:12px">${t.format}</span>
            </div>
            <div class="md-body-small" style="color:var(--md-on-surface-variant);white-space:pre-wrap;max-height:60px;overflow:hidden">${esc(t.content)}</div>
            ${t.description?`<div class="md-body-small mt-16" style="color:var(--md-on-surface-variant)">${esc(t.description)}</div>`:''}
          </div>
          <div class="flex gap-8">
            <button class="md-btn md-btn-outlined md-btn-sm" onclick="showTemplateForm(${t.id})">编辑</button>
            <button class="md-btn md-btn-text md-btn-sm" style="color:var(--md-error)" onclick="deleteTemplate(${t.id},'${esc(t.name)}')">删除</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  window.showTemplateForm = async function(id) {
    let tpl = { name:'', format:'text', content:'', description:'' };
    let sched = { enabled: false, interval_minutes: 0, cron_expr: '' };
    if (id) {
      const d = await API.getTemplate(id);
      tpl = d.template || tpl;
      // 加载关联的定时任务
      try {
        const tasks = await API.getScheduleTasks();
        const task = (tasks.tasks || []).find(t => t.template_id == id);
        if (task) {
          sched = {
            enabled: task.enabled === 1,
            interval_minutes: task.interval_minutes || 0,
            cron_expr: task.cron_expr || ''
          };
        }
      } catch {}
    }
    showDialog(id?'编辑模板':'新增模板', `
      <div class="tpl-form-grid">
        <div class="md-field" style="grid-column:1"><label>名称</label><input id="tpl-name" value="${esc(tpl.name)}" placeholder="如：纯文本模板"></div>
        <div class="md-field" style="grid-column:2"><label>格式</label>
          <select id="tpl-format"><option value="text" ${tpl.format==='text'?'selected':''}>纯文本</option><option value="markdown" ${tpl.format==='markdown'?'selected':''}>Markdown</option><option value="custom" ${tpl.format==='custom'?'selected':''}>自定义</option></select>
        </div>
      </div>
      <div class="md-field"><label>内容 <span class="md-body-small" style="color:var(--md-on-surface-variant)">（可用 {{title}} {{body}} {{content}} 变量）</span></label><textarea id="tpl-content" rows="4" style="resize:vertical;min-height:80px">${esc(tpl.content)}</textarea></div>
      <div class="flex gap-8 mb-8 items-center">
        <button class="md-btn md-btn-filled md-btn-sm" onclick="aiGenTemplate()" type="button">🤖 AI 生成</button>
        <span class="md-body-small" style="color:var(--md-on-surface-variant)">|</span>
        <button class="md-btn md-btn-tonal md-btn-sm" onclick="aiOptimize('tpl-content','rewrite','润色改写')">✨ 润色</button>
        <button class="md-btn md-btn-tonal md-btn-sm" onclick="aiOptimize('tpl-content','summarize','精简摘要')">📋 精简</button>
        <button class="md-btn md-btn-tonal md-btn-sm" onclick="aiOptimize('tpl-content','markdown','转 Markdown')">📝 转 MD</button>
      </div>
      <div class="md-field"><label>描述</label><input id="tpl-desc" value="${esc(tpl.description)}" placeholder="可选"></div>
      
      <div class="tpl-sched-section">
        <label class="md-switch-label" style="cursor:pointer" onclick="toggleTemplateSched()">
          <input type="checkbox" id="tpl-sched-enabled" ${sched.enabled?'checked':''} style="display:none">
          <span class="md-switch-track"><span class="md-switch-thumb"></span></span>
          <span>⏰ 定时推送</span>
        </label>
        <div id="tpl-sched-options" class="tpl-sched-body" style="display:${sched.enabled?'block':'none'}">
          <div class="tpl-form-grid">
            <div class="md-field" style="grid-column:1"><label>间隔（分钟）</label><input id="tpl-sched-interval" type="number" min="1" value="${sched.interval_minutes||''}" placeholder="如：60"></div>
            <div class="md-field" style="grid-column:2"><label>Cron 表达式</label><input id="tpl-sched-cron" value="${esc(sched.cron_expr)}" placeholder="如：0 9 * * *"></div>
          </div>
          <div class="md-body-small" style="color:var(--md-on-surface-variant);margin-top:4px">
            <code>*/30 * * *</code> 每30分 · <code>0 9 * * *</code> 每天9点 · <code>0 9,18 * * 1-5</code> 工作日
          </div>
        </div>
      </div>
    `, [
      { text:'取消', class:'md-btn md-btn-text', onclick:'hideDialog()' },
      { text:'保存', class:'md-btn md-btn-filled', onclick:`saveTemplate(${id||'null'})` }
    ]);
  };

  window.toggleTemplateSched = function() {
    const cb = document.getElementById('tpl-sched-enabled');
    const opts = document.getElementById('tpl-sched-options');
    opts.style.display = cb.checked ? 'block' : 'none';
  };

  window.saveTemplate = async function(id) {
    const data = {
      name: document.getElementById('tpl-name').value.trim(),
      format: document.getElementById('tpl-format').value,
      content: document.getElementById('tpl-content').value.trim(),
      description: document.getElementById('tpl-desc').value.trim()
    };
    if (!data.name || !data.content) { showSnackbar('请填写名称和内容'); return; }
    
    let tplId = id;
    if (id) await API.updateTemplate(id, data);
    else {
      const result = await API.createTemplate(data);
      tplId = result.template?.id;
    }
    
    // 处理定时推送配置
    const schedEnabled = document.getElementById('tpl-sched-enabled').checked;
    const interval = parseInt(document.getElementById('tpl-sched-interval').value) || 0;
    const cronExpr = document.getElementById('tpl-sched-cron').value.trim();
    
    if (schedEnabled && tplId) {
      // 获取第一个webhook作为默认
      const webhooks = (await API.getWebhooks()).webhooks || [];
      const webhookId = webhooks[0]?.id;
      if (!webhookId) {
        showSnackbar('请先创建一个Webhook才能启用定时推送');
      } else if (!interval && !cronExpr) {
        showSnackbar('请配置推送间隔或Cron表达式');
      } else {
        // 查找是否已有该模板的定时任务
        const tasks = (await API.getScheduleTasks()).tasks || [];
        const existing = tasks.find(t => t.template_id == tplId);
        
        const schedData = {
          template_id: tplId,
          webhook_id: webhookId,
          interval_minutes: interval,
          cron_expr: cronExpr,
          enabled: 1
        };
        
        if (existing) {
          await API.updateScheduleTask(existing.id, schedData);
        } else {
          await API.createScheduleTask(schedData);
        }
      }
    }
    
    hideDialog(); showSnackbar(id?'已更新':'已创建'); loadTemplates();
  };

  window.deleteTemplate = function(id, name) {
    showDialog('确认删除', `<p>确定要删除模板「${esc(name)}」吗？</p>`, [
      { text:'取消', class:'md-btn md-btn-text', onclick:'hideDialog()' },
      { text:'删除', class:'md-btn md-btn-error', onclick:`doDeleteTemplate(${id})` }
    ]);
  };

  window.doDeleteTemplate = async function(id) {
    await API.deleteTemplate(id); hideDialog(); showSnackbar('已删除'); loadTemplates();
  };

  // ===== Content Sources =====
  async function loadSources() {
    const data = await API.getContentSources();
    const sources = data.sources || [];
    if (!sources.length) {
      document.getElementById('source-list').innerHTML = '<div class="empty-state"><div class="icon">📰</div><h3>暂无内容源</h3><p>添加 RSS、网页、关键词等内容来源</p></div>';
      return;
    }
    const typeLabels = { rss:'RSS', website:'网页', keyword:'关键词', article:'文章', 'server-monitor':'服务器监控', 'news-briefing':'每日早报', 'api-call':'API 调用', 'browser-render':'🌐 浏览器渲染' };
    document.getElementById('source-list').innerHTML = sources.map(s => `
      <div class="md-card md-card-outlined mb-16">
        <div class="flex-between">
          <div>
            <div class="flex-center gap-8 mb-8">
              <span class="md-title-medium">${esc(s.name)}</span>
              <span class="md-chip" style="height:24px;font-size:12px">${typeLabels[s.source_type]||s.source_type}</span>
              <span class="md-chip ${s.is_active?'active':''}" style="height:24px;font-size:12px">${s.is_active?'启用':'停用'}</span>
            </div>
            <div class="md-body-small" style="color:var(--md-on-surface-variant);word-break:break-all">${esc(s.source_url||s.keyword||'')}</div>
          </div>
          <div class="flex gap-8">
            <button class="md-btn md-btn-tonal md-btn-sm" onclick="testSource(${s.id})">测试抓取</button>
            <button class="md-btn md-btn-outlined md-btn-sm" onclick="showSourceForm(${s.id})">编辑</button>
            <button class="md-btn md-btn-text md-btn-sm" style="color:var(--md-error)" onclick="deleteSource(${s.id},'${esc(s.name)}')">删除</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  window.showSourceForm = async function(id) {
    let src = { name:'', source_type:'rss', source_url:'', keyword:'', fetch_interval:3600, is_active:1 };
    if (id) { const d = await API.getContentSource(id); src = d.source || src; }
    showDialog(id?'编辑内容源':'新增内容源', `
      <div class="md-field"><label>名称</label><input id="src-name" value="${esc(src.name)}" placeholder="如：科技新闻 RSS"></div>
      <div class="md-field"><label>类型</label>
        <select id="src-type" onchange="toggleSourceFields()">
          <option value="rss" ${src.source_type==='rss'?'selected':''}>RSS 订阅</option>
          <option value="website" ${src.source_type==='website'?'selected':''}>网页抓取</option>
          <option value="keyword" ${src.source_type==='keyword'?'selected':''}>关键词搜索</option>
          <option value="article" ${src.source_type==='article'?'selected':''}>指定文章</option>
          <option value="server-monitor" ${src.source_type==='server-monitor'?'selected':''}>🖥️ 服务器监控</option>
          <option value="news-briefing" ${src.source_type==='news-briefing'?'selected':''}>📰 每日早报</option>
          <option value="api-call" ${src.source_type==='api-call'?'selected':''}>🔌 API 调用</option>
          <option value="browser-render" ${src.source_type==='browser-render'?'selected':''}>🌐 浏览器渲染</option>
        </select>
      </div>
      <div class="md-field" id="src-url-field"><label>URL</label><input id="src-url" value="${esc(src.source_url)}" placeholder="https://..."></div>
      <div class="md-field hidden" id="src-keyword-field"><label>关键词</label><input id="src-keyword" value="${esc(src.keyword)}" placeholder="输入搜索关键词"></div>
      <div class="md-field hidden" id="src-config-field"><label>配置 JSON</label><textarea id="src-config" rows="6" style="font-family:monospace;font-size:12px">${esc(src.config || '{}')}</textarea></div>
      <div class="md-field"><label>抓取间隔（秒）</label><input type="number" id="src-interval" value="${src.fetch_interval}"></div>
    `, [
      { text:'取消', class:'md-btn md-btn-text', onclick:'hideDialog()' },
      { text:'保存', class:'md-btn md-btn-filled', onclick:`saveSource(${id||'null'})` }
    ]);
    setTimeout(() => toggleSourceFields(), 10);
  };

  window.toggleSourceFields = function() {
    const type = document.getElementById('src-type').value;
    document.getElementById('src-url-field').classList.toggle('hidden', type === 'keyword' || type === 'server-monitor' || type === 'news-briefing');
    document.getElementById('src-keyword-field').classList.toggle('hidden', type !== 'keyword');
    document.getElementById('src-config-field').classList.toggle('hidden', type !== 'server-monitor' && type !== 'news-briefing' && type !== 'api-call' && type !== 'browser-render');
    // Auto-fill config JSON for known types
    if (type === 'server-monitor') {
      document.getElementById('src-config').value = src.config || JSON.stringify({base_url:'https://066609.xyz', ignore_nodes:'美国灵车3.8'}, null, 2);
    } else if (type === 'news-briefing') {
      document.getElementById('src-config').value = src.config || JSON.stringify({weather_api_key:'', city_adcode:'370100', news_query:'(零售药店 OR 连锁药店 OR 药店) (监管 OR 处罚 OR 约谈 OR 医保 OR 转型 OR 健康驿站)', news_days:'3', news_limit:'8'}, null, 2);
    } else if (type === 'api-call') {
      document.getElementById('src-url').placeholder = 'https://api.example.com/data';
      if (!src.config || src.config === '{}') {
        document.getElementById('src-config').value = JSON.stringify({method:'GET', headers:{}, json_path:'data', item_separator:'\n', max_items:20, template:'{{?}}'}, null, 2);
      }
    } else if (type === 'browser-render') {
      document.getElementById('src-url').placeholder = 'https://需要JS渲染的网站.com/page';
      if (!src.config || src.config === '{}') {
        document.getElementById('src-config').value = JSON.stringify({api_url:'https://chrome.browserless.io/content', api_token:'', selector:'', wait_seconds:3}, null, 2);
      }
    }
  };

  window.saveSource = async function(id) {
    const data = {
      name: document.getElementById('src-name').value.trim(),
      source_type: document.getElementById('src-type').value,
      source_url: document.getElementById('src-url')?.value.trim() || '',
      keyword: document.getElementById('src-keyword')?.value.trim() || '',
      fetch_interval: parseInt(document.getElementById('src-interval').value) || 3600,
      config: document.getElementById('src-config')?.value.trim() || '{}',
      is_active: 1
    };
    if (!data.name) { showSnackbar('请填写名称'); return; }
    if (id) await API.updateContentSource(id, data);
    else await API.createContentSource(data);
    hideDialog(); showSnackbar(id?'已更新':'已创建'); loadSources();
  };

  window.deleteSource = function(id, name) {
    showDialog('确认删除', `<p>确定要删除内容源「${esc(name)}」吗？</p>`, [
      { text:'取消', class:'md-btn md-btn-text', onclick:'hideDialog()' },
      { text:'删除', class:'md-btn md-btn-error', onclick:`doDeleteSource(${id})` }
    ]);
  };

  window.doDeleteSource = async function(id) {
    await API.deleteContentSource(id); hideDialog(); showSnackbar('已删除'); loadSources();
  };

  window.testSource = async function(id) {
    showSnackbar('正在测试抓取...');
    const data = await API.testContentSource(id);
    if (data.ok) {
      showDialog('抓取结果', `<div style="max-height:400px;overflow:auto;white-space:pre-wrap;font-size:13px;font-family:monospace">${esc(data.content||'无内容')}</div>`, [
        { text:'关闭', class:'md-btn md-btn-filled', onclick:'hideDialog()' }
      ]);
    } else {
      showSnackbar('❌ 抓取失败: ' + (data.error||'未知错误'));
    }
  };

  // ===== Custom Content =====
  async function loadCustom() {
    const data = await API.getCustomContents();
    const contents = data.contents || [];
    if (!contents.length) {
      document.getElementById('custom-list').innerHTML = '<div class="empty-state"><div class="icon">✏️</div><h3>暂无自定义内容</h3><p>创建自定义推送内容</p></div>';
      return;
    }
    document.getElementById('custom-list').innerHTML = contents.map(c => `
      <div class="md-card md-card-outlined mb-16">
        <div class="flex-between">
          <div style="flex:1;min-width:0">
            <div class="md-title-medium mb-8">${esc(c.title)}</div>
            <div class="md-body-small" style="color:var(--md-on-surface-variant);white-space:pre-wrap;max-height:60px;overflow:hidden">${esc(c.body)}</div>
            <div class="md-body-small mt-16" style="color:var(--md-outline)">${formatTime(c.created_at)}</div>
          </div>
          <div class="flex gap-8">
            <button class="md-btn md-btn-outlined md-btn-sm" onclick="showCustomForm(${c.id})">编辑</button>
            <button class="md-btn md-btn-text md-btn-sm" style="color:var(--md-error)" onclick="deleteCustom(${c.id},'${esc(c.title)}')">删除</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  window.showCustomForm = async function(id) {
    let content = { title:'', body:'' };
    if (id) { const d = await API.getCustomContent(id); content = d.content || content; }
    showDialog(id?'编辑内容':'新增内容', `
      <div class="md-field"><label>标题</label><input id="cc-title" value="${esc(content.title)}" placeholder="输入标题"></div>
      <div class="md-field"><label>正文</label><textarea id="cc-body" rows="8">${esc(content.body)}</textarea></div>
      <div class="flex gap-8 mb-16">
        <button class="md-btn md-btn-tonal md-btn-sm" onclick="aiOptimize('cc-body','rewrite','润色改写')">✨ 润色</button>
        <button class="md-btn md-btn-tonal md-btn-sm" onclick="aiOptimize('cc-body','summarize','精简摘要')">📋 精简</button>
        <button class="md-btn md-btn-tonal md-btn-sm" onclick="aiOptimize('cc-body','markdown','转 Markdown')">📝 转 MD</button>
        <button class="md-btn md-btn-tonal md-btn-sm" onclick="aiOptimize('cc-body','emoji','添加 Emoji')">😊 加 Emoji</button>
        <button class="md-btn md-btn-tonal md-btn-sm" onclick="aiGenTitle('cc-title','cc-body')">🏷️ 生成标题</button>
      </div>
    `, [
      { text:'取消', class:'md-btn md-btn-text', onclick:'hideDialog()' },
      { text:'保存', class:'md-btn md-btn-filled', onclick:`saveCustom(${id||'null'})` }
    ]);
  };

  window.saveCustom = async function(id) {
    const data = {
      title: document.getElementById('cc-title').value.trim(),
      body: document.getElementById('cc-body').value.trim()
    };
    if (!data.title) { showSnackbar('请填写标题'); return; }
    if (id) await API.updateCustomContent(id, data);
    else await API.createCustomContent(data);
    hideDialog(); showSnackbar(id?'已更新':'已创建'); loadCustom();
  };

  window.deleteCustom = function(id, title) {
    showDialog('确认删除', `<p>确定要删除内容「${esc(title)}」吗？</p>`, [
      { text:'取消', class:'md-btn md-btn-text', onclick:'hideDialog()' },
      { text:'删除', class:'md-btn md-btn-error', onclick:`doDeleteCustom(${id})` }
    ]);
  };

  window.doDeleteCustom = async function(id) {
    await API.deleteCustomContent(id); hideDialog(); showSnackbar('已删除'); loadCustom();
  };

  // ===== Push =====
  async function loadPushLogs() {
    const data = await API.getPushLogs();
    const logs = data.logs || [];
    if (!logs.length) {
      document.getElementById('push-logs').innerHTML = '<div class="empty-state"><div class="icon">🚀</div><h3>暂无推送记录</h3><p>发送你的第一次推送吧</p></div>';
      return;
    }
    document.getElementById('push-logs').innerHTML = `
      <table class="md-table">
        <thead><tr><th>时间</th><th>目标</th><th>标题</th><th>状态</th><th>响应码</th></tr></thead>
        <tbody>${logs.map(l => `<tr>
          <td>${formatTime(l.created_at)}</td>
          <td>${esc(l.webhook_name||'--')}</td>
          <td>${esc(l.title||l.body_preview||'')}</td>
          <td><span class="status-dot ${l.status}"></span>${l.status==='success'?'成功':'失败'}</td>
          <td>${l.response_code||'--'}</td>
        </tr>`).join('')}</tbody>
      </table>
    `;
  }

  window.showPushForm = async function() {
    const [whData, tplData, ccData] = await Promise.all([
      API.getWebhooks(), API.getTemplates(), API.getCustomContents()
    ]);
    const webhooks = (whData.webhooks||[]).filter(w=>w.is_active);
    const templates = tplData.templates||[];
    const contents = ccData.contents||[];

    if (!webhooks.length) { showSnackbar('请先创建并启用至少一个 Webhook'); return; }

    showDialog('发送推送', `
      <div class="md-field"><label>选择 Webhook</label>
        <select id="push-wh">${webhooks.map(w=>`<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select>
      </div>
      <div class="md-field"><label>选择模板（可选）</label>
        <select id="push-tpl"><option value="">不使用模板</option>${templates.map(t=>`<option value="${t.id}">${esc(t.name)} (${t.format})</option>`).join('')}</select>
      </div>
      <div class="md-field"><label>选择内容</label>
        <select id="push-content"><option value="">-- 选择内容 --</option>
        ${contents.map(c=>`<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select>
      </div>
      <div class="md-field"><label>或直接输入内容</label><textarea id="push-custom-text" rows="4" placeholder="直接输入要推送的文本..."></textarea></div>
      <div class="md-field"><label>格式</label>
        <select id="push-format"><option value="text">纯文本</option><option value="markdown">Markdown</option></select>
      </div>
    `, [
      { text:'取消', class:'md-btn md-btn-text', onclick:'hideDialog()' },
      { text:'发送', class:'md-btn md-btn-filled', onclick:'doSendPush()' }
    ]);
  };

  window.doSendPush = async function() {
    const webhook_id = parseInt(document.getElementById('push-wh').value);
    const template_id = parseInt(document.getElementById('push-tpl').value) || null;
    const custom_content_id = parseInt(document.getElementById('push-content').value) || null;
    const customText = document.getElementById('push-custom-text').value.trim();
    const format = document.getElementById('push-format').value;

    if (!custom_content_id && !customText) { showSnackbar('请选择内容或输入文本'); return; }

    hideDialog(); showSnackbar('正在推送...');

    // If custom text, create content first
    let content_id = custom_content_id;
    if (!content_id && customText) {
      const created = await API.createCustomContent({ title: '快速推送', body: customText });
      content_id = created.content?.id;
    }

    const data = await API.sendPush({ webhook_id, template_id, custom_content_id: content_id, format });
    if (data.ok) showSnackbar('✅ 推送成功');
    else showSnackbar('❌ 推送失败: ' + (data.error || data.response?.errmsg || '未知错误'));

    loadPushLogs();
  };

  // ===== Helpers =====
  function showDialog(title, body, actions) {
    document.getElementById('dialog-title').textContent = title;
    document.getElementById('dialog-body').innerHTML = body;
    document.getElementById('dialog-actions').innerHTML = actions.map(a =>
      `<button class="${a.class}" onclick="${a.onclick}">${a.text}</button>`
    ).join('');
    document.getElementById('dialog-overlay').classList.add('show');
  }

  window.hideDialog = function() {
    document.getElementById('dialog-overlay').classList.remove('show');
  };

  function showSnackbar(text) {
    document.getElementById('snackbar-text').textContent = text;
    document.getElementById('snackbar').classList.add('show');
    clearTimeout(window._snackbarTimer);
    window._snackbarTimer = setTimeout(() => hideSnackbar(), 4000);
  }

  window.hideSnackbar = function() {
    document.getElementById('snackbar').classList.remove('show');
  };

  function formatTime(str) {
    if (!str) return '--';
    const d = new Date(str + 'Z');
    return d.toLocaleString('zh-CN', { timeZone:'Asia/Shanghai', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  }

  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // ===== Settings & User Management =====
  window.handleChangePassword = async function() {
    const oldPwd = document.getElementById('old-password').value;
    const newPwd = document.getElementById('new-password').value;
    const confirmPwd = document.getElementById('confirm-password').value;

    if (!oldPwd || !newPwd) { showSnackbar('请填写所有字段'); return; }
    if (newPwd.length < 6) { showSnackbar('新密码至少 6 位'); return; }
    if (newPwd !== confirmPwd) { showSnackbar('两次输入的新密码不一致'); return; }

    const data = await API.changePassword(oldPwd, newPwd);
    if (data.ok) {
      showSnackbar('✅ 密码已修改');
      document.getElementById('old-password').value = '';
      document.getElementById('new-password').value = '';
      document.getElementById('confirm-password').value = '';
    } else {
      showSnackbar('❌ ' + (data.error || '修改失败'));
    }
  };

  async function loadUsers() {
    const data = await API.getUsers();
    const users = data.users || [];
    if (!users.length) {
      document.getElementById('user-list').innerHTML = '<div class="empty-state"><div class="icon">👥</div><h3>暂无用户</h3></div>';
      return;
    }
    document.getElementById('user-list').innerHTML = users.map(u => `
      <div class="md-card md-card-outlined mb-16">
        <div class="flex-between">
          <div>
            <div class="md-title-medium mb-8">${esc(u.username)}</div>
            <div class="md-body-small" style="color:var(--md-on-surface-variant)">${esc(u.display_name||'')} · 创建于 ${formatTime(u.created_at)}</div>
          </div>
          <div class="flex gap-8">
            ${u.id !== 1 ? `<button class="md-btn md-btn-text md-btn-sm" style="color:var(--md-error)" onclick="deleteUser(${u.id},'${esc(u.username)}')">删除</button>` : '<span class="md-body-small" style="color:var(--md-outline)">管理员</span>'}
          </div>
        </div>
      </div>
    `).join('');
  }

  window.showUserForm = function() {
    showDialog('新增用户', `
      <div class="md-field"><label>用户名</label><input id="new-username" placeholder="3-30 位"></div>
      <div class="md-field"><label>密码</label><input type="password" id="new-user-pwd" placeholder="至少 6 位"></div>
      <div class="md-field"><label>显示名</label><input id="new-user-display" placeholder="可选"></div>
    `, [
      { text:'取消', class:'md-btn md-btn-text', onclick:'hideDialog()' },
      { text:'创建', class:'md-btn md-btn-filled', onclick:'doCreateUser()' }
    ]);
  };

  window.doCreateUser = async function() {
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-user-pwd').value;
    const display_name = document.getElementById('new-user-display').value.trim();
    if (!username || !password) { showSnackbar('用户名和密码必填'); return; }
    const data = await API.createUser(username, password, display_name);
    if (data.ok) { hideDialog(); showSnackbar('✅ 用户已创建'); loadUsers(); }
    else showSnackbar('❌ ' + (data.error || '创建失败'));
  };

  window.deleteUser = function(id, name) {
    showDialog('确认删除', `<p>确定要删除用户「${esc(name)}」吗？该用户的所有数据将被删除。</p>`, [
      { text:'取消', class:'md-btn md-btn-text', onclick:'hideDialog()' },
      { text:'删除', class:'md-btn md-btn-error', onclick:`doDeleteUser(${id})` }
    ]);
  };

  window.doDeleteUser = async function(id) {
    await API.deleteUser(id); hideDialog(); showSnackbar('已删除'); loadUsers();
  };

  // ===== Scheduled Tasks =====
  async function loadScheduleTasks() {
    const data = await API.getScheduleTasks();
    const tasks = data.tasks || [];
    if (!tasks.length) {
      document.getElementById('schedule-list').innerHTML = '<div class="md-body-medium" style="color:var(--md-on-surface-variant);padding:32px 0;text-align:center;">暂无定时任务，点击上方按钮创建</div>';
      return;
    }

    // Get webhooks and templates for display
    const [webhooksData, templatesData] = await Promise.all([API.getWebhooks(), API.getTemplates()]);
    const webhooks = webhooksData.webhooks || [];
    const templates = templatesData.templates || [];
    const webhookMap = Object.fromEntries(webhooks.map(w => [w.id, w]));
    const templateMap = Object.fromEntries(templates.map(t => [t.id, t]));

    document.getElementById('schedule-list').innerHTML = tasks.map(t => {
      const tpl = templateMap[t.template_id] || {};
      const wh = webhookMap[t.webhook_id] || {};
      const scheduleDesc = t.interval_minutes > 0
        ? `每 ${t.interval_minutes} 分钟`
        : t.cron_expr || '未配置';
      const statusBadge = t.enabled
        ? '<span class="md-badge md-badge-success">启用</span>'
        : '<span class="md-badge">停用</span>';
      const lastRun = t.last_run_at ? new Date(t.last_run_at).toLocaleString('zh-CN', {timeZone:'Asia/Shanghai'}) : '从未执行';
      return `
        <div class="md-card md-card-outlined mb-16">
          <div class="flex-between" style="align-items:flex-start;">
            <div>
              <div class="flex-center gap-8 mb-8">
                <h3 class="md-title-medium">${esc(tpl.name || '模板已删除')}</h3>
                ${statusBadge}
              </div>
              <div class="md-body-small mb-8" style="color:var(--md-on-surface-variant);">
                Webhook: ${esc(wh.name || '未配置')}<br>
                定时: ${esc(scheduleDesc)}<br>
                上次执行: ${lastRun}
              </div>
            </div>
            <div class="flex-center gap-8">
              <button class="md-btn md-btn-text md-btn-sm" onclick="runScheduleNow(${t.id})">▶ 执行</button>
              <button class="md-btn md-btn-text md-btn-sm" onclick="viewScheduleRuns(${t.id})">📋 记录</button>
              <button class="md-btn md-btn-text md-btn-sm" onclick="editScheduleTask(${t.id})">✏️</button>
              <button class="md-btn md-btn-text md-btn-sm md-btn-error" onclick="deleteScheduleTask(${t.id}, '${esc(tpl.name || '任务')}')">🗑</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  window.showScheduleForm = async function() {
    const [webhooksData, templatesData] = await Promise.all([API.getWebhooks(), API.getTemplates()]);
    const webhooks = webhooksData.webhooks || [];
    const templates = templatesData.templates || [];

    showDialog('新增定时推送任务', `
      <div class="md-field mb-16">
        <label>推送模板</label>
        <select id="sched-tpl" class="md-input">
          ${templates.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
        </select>
      </div>
      <div class="md-field mb-16">
        <label>Webhook</label>
        <select id="sched-wh" class="md-input">
          ${webhooks.map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('')}
        </select>
      </div>
      <div class="md-field mb-16">
        <label>定时方式</label>
        <select id="sched-type" class="md-input" onchange="toggleScheduleType()">
          <option value="interval">固定间隔</option>
          <option value="cron">Cron 表达式</option>
        </select>
      </div>
      <div id="sched-interval-wrap" class="md-field mb-16">
        <label>间隔（分钟）</label>
        <input type="number" id="sched-interval" class="md-input" min="1" value="60" placeholder="60">
      </div>
      <div id="sched-cron-wrap" class="md-field mb-16" style="display:none;">
        <label>Cron 表达式</label>
        <input type="text" id="sched-cron" class="md-input" placeholder="0 9 * * * (每天9点)">
        <div class="md-body-small mt-4" style="color:var(--md-on-surface-variant);">格式: 分 时 日 月 周 (例: 0 9 * * * = 每天9:00)</div>
      </div>
      <div class="flex-center gap-8 mb-16">
        <input type="checkbox" id="sched-enabled" checked>
        <label for="sched-enabled">立即启用</label>
      </div>
    `, [
      { text: '取消', class: 'md-btn md-btn-text', onclick: 'hideDialog()' },
      { text: '创建', class: 'md-btn md-btn-filled', onclick: 'doCreateScheduleTask()' }
    ]);
  };

  window.toggleScheduleType = function() {
    const type = document.getElementById('sched-type').value;
    document.getElementById('sched-interval-wrap').style.display = type === 'interval' ? '' : 'none';
    document.getElementById('sched-cron-wrap').style.display = type === 'cron' ? '' : 'none';
  };

  window.doCreateScheduleTask = async function() {
    const template_id = parseInt(document.getElementById('sched-tpl').value);
    const webhook_id = parseInt(document.getElementById('sched-wh').value);
    const type = document.getElementById('sched-type').value;
    const enabled = document.getElementById('sched-enabled').checked;

    const data = { template_id, webhook_id, enabled };
    if (type === 'interval') {
      data.interval_minutes = parseInt(document.getElementById('sched-interval').value) || 60;
    } else {
      data.cron_expr = document.getElementById('sched-cron').value.trim();
      if (!data.cron_expr) { showSnackbar('请填写 cron 表达式'); return; }
    }

    const result = await API.createScheduleTask(data);
    if (result.ok) { hideDialog(); showSnackbar('✅ 任务已创建'); loadScheduleTasks(); }
    else showSnackbar('❌ ' + (result.error || '创建失败'));
  };

  window.editScheduleTask = async function(id) {
    const data = await API.getScheduleTasks();
    const task = (data.tasks || []).find(t => t.id === id);
    if (!task) return;

    const [webhooksData, templatesData] = await Promise.all([API.getWebhooks(), API.getTemplates()]);
    const webhooks = webhooksData.webhooks || [];
    const templates = templatesData.templates || [];
    const isInterval = task.interval_minutes > 0;

    showDialog('编辑定时任务', `
      <div class="md-field mb-16">
        <label>推送模板</label>
        <select id="sched-tpl" class="md-input">
          ${templates.map(t => `<option value="${t.id}" ${t.id===task.template_id?'selected':''}>${esc(t.name)}</option>`).join('')}
        </select>
      </div>
      <div class="md-field mb-16">
        <label>Webhook</label>
        <select id="sched-wh" class="md-input">
          ${webhooks.map(w => `<option value="${w.id}" ${w.id===task.webhook_id?'selected':''}>${esc(w.name)}</option>`).join('')}
        </select>
      </div>
      <div class="md-field mb-16">
        <label>定时方式</label>
        <select id="sched-type" class="md-input" onchange="toggleScheduleType()">
          <option value="interval" ${isInterval?'selected':''}>固定间隔</option>
          <option value="cron" ${!isInterval?'selected':''}>Cron 表达式</option>
        </select>
      </div>
      <div id="sched-interval-wrap" class="md-field mb-16" style="${isInterval?'':'display:none;'}">
        <label>间隔（分钟）</label>
        <input type="number" id="sched-interval" class="md-input" min="1" value="${task.interval_minutes || 60}">
      </div>
      <div id="sched-cron-wrap" class="md-field mb-16" style="${isInterval?'display:none;':''}">
        <label>Cron 表达式</label>
        <input type="text" id="sched-cron" class="md-input" value="${esc(task.cron_expr || '')}" placeholder="0 9 * * *">
      </div>
      <div class="flex-center gap-8 mb-16">
        <input type="checkbox" id="sched-enabled" ${task.enabled?'checked':''}>
        <label for="sched-enabled">启用</label>
      </div>
    `, [
      { text: '取消', class: 'md-btn md-btn-text', onclick: 'hideDialog()' },
      { text: '保存', class: 'md-btn md-btn-filled', onclick: `doUpdateScheduleTask(${id})` }
    ]);
  };

  window.doUpdateScheduleTask = async function(id) {
    const template_id = parseInt(document.getElementById('sched-tpl').value);
    const webhook_id = parseInt(document.getElementById('sched-wh').value);
    const type = document.getElementById('sched-type').value;
    const enabled = document.getElementById('sched-enabled').checked;

    const data = { template_id, webhook_id, enabled };
    if (type === 'interval') {
      data.interval_minutes = parseInt(document.getElementById('sched-interval').value) || 60;
      data.cron_expr = '';
    } else {
      data.cron_expr = document.getElementById('sched-cron').value.trim();
      data.interval_minutes = 0;
      if (!data.cron_expr) { showSnackbar('请填写 cron 表达式'); return; }
    }

    const result = await API.updateScheduleTask(id, data);
    if (result.ok) { hideDialog(); showSnackbar('✅ 已更新'); loadScheduleTasks(); }
    else showSnackbar('❌ ' + (result.error || '更新失败'));
  };

  window.deleteScheduleTask = function(id, name) {
    showDialog('确认删除', `<p>确定要删除定时任务「${esc(name)}」吗？</p>`, [
      { text: '取消', class: 'md-btn md-btn-text', onclick: 'hideDialog()' },
      { text: '删除', class: 'md-btn md-btn-error', onclick: `doDeleteScheduleTask(${id})` }
    ]);
  };

  window.doDeleteScheduleTask = async function(id) {
    await API.deleteScheduleTask(id);
    hideDialog(); showSnackbar('已删除'); loadScheduleTasks();
  };

  window.runScheduleNow = async function(id) {
    showSnackbar('⏳ 正在执行...');
    const result = await API.runScheduleNow(id);
    if (result.ok) {
      showSnackbar(`✅ 执行${result.status === 'success' ? '成功' : '失败'}`);
    } else {
      showSnackbar('❌ ' + (result.error || '执行失败'));
    }
    loadScheduleTasks();
  };

  window.viewScheduleRuns = async function(id) {
    const data = await API.getScheduleRuns(id);
    const runs = data.runs || [];
    if (!runs.length) {
      showDialog('执行记录', '<p style="color:var(--md-on-surface-variant);">暂无执行记录</p>', [
        { text: '关闭', class: 'md-btn md-btn-text', onclick: 'hideDialog()' }
      ]);
      return;
    }
    const rows = runs.slice(0, 20).map(r => {
      const badge = r.status === 'success'
        ? '<span class="md-badge md-badge-success">成功</span>'
        : '<span class="md-badge md-badge-error">失败</span>';
      return `<tr><td>${new Date(r.run_at).toLocaleString('zh-CN', {timeZone:'Asia/Shanghai'})}</td><td>${badge}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(r.result || '-')}</td></tr>`;
    }).join('');
    showDialog('执行记录', `
      <div style="overflow-x:auto;">
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <thead><tr><th style="text-align:left;padding:4px;">时间</th><th style="text-align:left;padding:4px;">状态</th><th style="text-align:left;padding:4px;">结果</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `, [
      { text: '关闭', class: 'md-btn md-btn-text', onclick: 'hideDialog()' }
    ]);
  };

  // ===== AI Settings =====
  async function loadAISettings() {
    const data = await API.getAISettings();
    const s = data.settings || {};
    document.getElementById('ai-api-url').value = s.api_url || '';
    document.getElementById('ai-api-key').value = s.api_key || '';
    document.getElementById('ai-model').value = s.model || 'mimo-v2.5';
    document.getElementById('ai-enabled').checked = !!s.enabled;
    document.getElementById('ai-agent-url').value = s.agent_url || '';
    document.getElementById('ai-agent-key').value = s.agent_key || '';
    document.getElementById('ai-agent-enabled').checked = !!s.agent_enabled;
  }

  window.saveAISettings = async function() {
    const data = {
      api_url: document.getElementById('ai-api-url').value.trim(),
      api_key: document.getElementById('ai-api-key').value.trim(),
      model: document.getElementById('ai-model').value.trim(),
      enabled: document.getElementById('ai-enabled').checked ? 1 : 0,
      agent_url: document.getElementById('ai-agent-url').value.trim(),
      agent_key: document.getElementById('ai-agent-key').value.trim(),
      agent_enabled: document.getElementById('ai-agent-enabled').checked ? 1 : 0,
    };
    if (!data.api_url || !data.api_key || !data.model) {
      showSnackbar('请填写所有字段'); return;
    }
    const result = await API.updateAISettings(data);
    if (result.ok) showSnackbar('✅ AI 配置已保存');
    else showSnackbar('❌ ' + (result.error || '保存失败'));
  };

  // AI optimize helper
  // 保存AI优化前的原文，用于撤回
  const aiOriginals = {};

  async function aiOptimize(textareaId, action, label) {
    const textarea = document.getElementById(textareaId);
    if (!textarea || !textarea.value.trim()) { showSnackbar('请先输入内容'); return; }
    // 保存原文
    aiOriginals[textareaId] = textarea.value;
    showSnackbar('🤖 AI 正在' + label + '...');
    const result = await API.aiOptimize(textarea.value.trim(), action);
    if (result.ok) {
      textarea.value = result.result;
      showSnackbar('✅ ' + label + '完成');
      // 显示撤回按钮
      showUndoButton(textareaId, textarea);
    } else {
      showSnackbar('❌ ' + (result.error || 'AI 请求失败'));
    }
  }
  window.aiOptimize = aiOptimize;

  function showUndoButton(textareaId, textarea) {
    // 移除已有的撤回按钮
    const existing = document.getElementById('undo-' + textareaId);
    if (existing) existing.remove();
    // 在 textarea 后面插入撤回按钮
    const btn = document.createElement('div');
    btn.id = 'undo-' + textareaId;
    btn.className = 'flex gap-8 mb-16';
    btn.innerHTML = `<button class="md-btn md-btn-outlined md-btn-sm" onclick="undoAiOptimize('${textareaId}')">↩️ 撤回，使用原文</button>`;
    textarea.parentNode.insertBefore(btn, textarea.nextSibling);
  }

  window.undoAiOptimize = function(textareaId) {
    const textarea = document.getElementById(textareaId);
    const original = aiOriginals[textareaId];
    if (textarea && original !== undefined) {
      textarea.value = original;
      delete aiOriginals[textareaId];
      const btn = document.getElementById('undo-' + textareaId);
      if (btn) btn.remove();
      showSnackbar('↩️ 已撤回，恢复原文');
    }
  };

  window.aiGenTemplate = async function() {
    const name = document.getElementById('tpl-name')?.value.trim();
    const desc = document.getElementById('tpl-desc')?.value.trim();
    const content = document.getElementById('tpl-content')?.value.trim();
    if (!name) { showSnackbar('请先输入模板名称'); return; }
    const textarea = document.getElementById('tpl-content');
    if (content) aiOriginals['tpl-content'] = content;
    showSnackbar('🤖 AI 正在生成模板内容...');
    const prompt = `请为一个企业微信机器人推送模板生成 Markdown 内容。\n\n模板名称：${name}\n模板描述：${desc || '无'}\n\n格式要求（必须严格遵守）：\n1. 第一行：emoji + 模板名称，如 🔥 微博热搜推送\n2. 空一行后写 📅 {{date}}\n3. 再空一行后写 {{content}}（这是正文内容占位符）\n4. 如果有列表项，用 1. 2. 3. 编号，每条一行\n5. 变量用 {{title}} {{body}} {{content}} {{date}}\n6. 不要加多余的文字说明，直接输出模板内容`;
    const result = await API.aiOptimize(prompt, 'rewrite');
    if (result.ok) {
      textarea.value = result.result;
      showSnackbar('✅ 模板内容已生成');
      showUndoButton('tpl-content', textarea);
    } else {
      showSnackbar('❌ ' + (result.error || 'AI 生成失败'));
    }
  };

  window.aiGenTitle = async function(titleId, bodyId) {
    const body = document.getElementById(bodyId)?.value.trim();
    if (!body) { showSnackbar('请先输入正文内容'); return; }
    showSnackbar('🤖 AI 正在生成标题...');
    const result = await API.aiOptimize(body, 'title');
    if (result.ok) {
      document.getElementById(titleId).value = result.result;
      showSnackbar('✅ 标题已生成');
    } else {
      showSnackbar('❌ ' + (result.error || 'AI 请求失败'));
    }
  };

  // ===== AI Create Task (multi-turn) =====
  const aiCreateHistory = []; // {role, content}

  window.sendAiCreateMsg = async function() {
    const input = document.getElementById('ai-create-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';

    const chat = document.getElementById('ai-create-chat');
    // Add user message
    chat.innerHTML += `<div class="ai-msg user" style="margin-bottom:16px;text-align:right;">
      <div style="background:var(--md-primary);color:var(--md-on-primary);padding:12px 16px;border-radius:12px;display:inline-block;max-width:80%;text-align:left;white-space:pre-wrap;">${esc(msg)}</div>
    </div>`;
    chat.scrollTop = chat.scrollHeight;

    // Add thinking indicator
    chat.innerHTML += `<div class="ai-msg assistant" id="ai-create-thinking" style="margin-bottom:16px;">
      <div style="background:var(--md-primary-container);color:var(--md-on-primary-container);padding:12px 16px;border-radius:12px;display:inline-block;">
        <span class="loading-dots">🤔 正在分析需求</span>
      </div>
    </div>`;
    chat.scrollTop = chat.scrollHeight;

    document.getElementById('ai-create-send').disabled = true;

    // Add to history
    aiCreateHistory.push({ role: 'user', content: msg });

    const result = await API.aiCreateTask(msg, aiCreateHistory.slice(0, -1)); // send history without current msg

    // Add assistant response to history
    if (result.ok) {
      aiCreateHistory.push({ role: 'assistant', content: JSON.stringify(result.config) });
    }

    // Remove thinking indicator
    const thinking = document.getElementById('ai-create-thinking');
    if (thinking) thinking.remove();

    if (result.ok && result.config) {
      const cfg = result.config;
      // Format task summary
      let summary = `<b>📋 任务概览</b>\n`;
      summary += `任务名：${esc(cfg.task_name || cfg.template_name || '未命名')}\n`;
      if (cfg.webhook_id > 0) summary += `Webhook：使用已有 (ID ${cfg.webhook_id})\n`;
      else if (cfg.webhook_url) summary += `Webhook：${esc(cfg.webhook_url)}\n`;
      if (cfg.source_type && cfg.source_type !== 'none') summary += `内容源：${cfg.source_type}` + (cfg.source_url ? ` ${esc(cfg.source_url)}` : '') + '\n';
      summary += `格式：${cfg.template_format || 'markdown'}\n`;
      if (cfg.schedule_type === 'interval') summary += `频率：每 ${cfg.interval_minutes || 60} 分钟\n`;
      else if (cfg.cron_expr) summary += `Cron：${cfg.cron_expr}\n`;

      chat.innerHTML += `<div class="ai-msg assistant" style="margin-bottom:16px;">
        <div style="background:var(--md-primary-container);color:var(--md-on-primary-container);padding:12px 16px;border-radius:12px;display:inline-block;max-width:100%;white-space:pre-wrap;">${summary}</div>
      </div>`;

      chat.innerHTML += `<div class="ai-msg assistant" style="margin-bottom:16px;">
        <div style="display:flex;gap:8px;">
          <button class="md-btn md-btn-filled md-btn-sm" onclick='confirmAiTask(${JSON.stringify(cfg).replace(/'/g, "&#39;")})'>✅ 确认创建</button>
          <button class="md-btn md-btn-outlined md-btn-sm" onclick="document.getElementById('ai-create-input').focus()">✏️ 重新描述</button>
        </div>
      </div>`;
    } else {
      chat.innerHTML += `<div class="ai-msg assistant" style="margin-bottom:16px;">
        <div style="background:var(--md-error-container);color:var(--md-on-error-container);padding:12px 16px;border-radius:12px;display:inline-block;">
          ❌ ${esc(result.error || 'AI 解析失败，请重新描述')}
        </div>
      </div>`;
    }

    chat.scrollTop = chat.scrollHeight;
    document.getElementById('ai-create-send').disabled = false;
  };

  window.confirmAiTask = async function(cfg) {
    showSnackbar('⏳ 正在创建任务...');
    const result = await API.aiConfirmTask(cfg);
    if (result.ok) {
      showSnackbar('✅ ' + (result.message || '任务已创建'));
      const chat = document.getElementById('ai-create-chat');
      chat.innerHTML += `<div class="ai-msg assistant" style="margin-bottom:16px;">
        <div style="background:var(--md-primary-container);color:var(--md-on-primary-container);padding:12px 16px;border-radius:12px;display:inline-block;">
          ✅ 任务创建成功！ID: ${result.task_id}<br>可在「⏰ 定时推送」页面查看和管理。
        </div>
      </div>`;
      chat.scrollTop = chat.scrollHeight;
    } else {
      showSnackbar('❌ ' + (result.error || '创建失败'));
    }
  };

  // ===== Init =====
  loadUser().then(() => {
    if (currentUser && currentUser.id === 1) {
      document.getElementById('nav-users').style.display = '';
      document.getElementById('nav-ai').style.display = '';
    }
  });
  navigateTo('dashboard');
})();
