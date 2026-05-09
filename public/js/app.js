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

    const titles = { dashboard:'控制台', webhooks:'Webhook 配置', templates:'推送模板', sources:'内容源管理', custom:'自定义内容', push:'推送记录' };
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
    if (id) { const d = await API.getTemplate(id); tpl = d.template || tpl; }
    showDialog(id?'编辑模板':'新增模板', `
      <div class="md-field"><label>名称</label><input id="tpl-name" value="${esc(tpl.name)}" placeholder="如：纯文本模板"></div>
      <div class="md-field"><label>格式</label>
        <select id="tpl-format"><option value="text" ${tpl.format==='text'?'selected':''}>纯文本</option><option value="markdown" ${tpl.format==='markdown'?'selected':''}>Markdown</option><option value="custom" ${tpl.format==='custom'?'selected':''}>自定义</option></select>
      </div>
      <div class="md-field"><label>内容 <span class="md-body-small">（可用 {{title}} {{body}} 变量）</span></label><textarea id="tpl-content" rows="6">${esc(tpl.content)}</textarea></div>
      <div class="md-field"><label>描述</label><input id="tpl-desc" value="${esc(tpl.description)}" placeholder="可选"></div>
    `, [
      { text:'取消', class:'md-btn md-btn-text', onclick:'hideDialog()' },
      { text:'保存', class:'md-btn md-btn-filled', onclick:`saveTemplate(${id||'null'})` }
    ]);
  };

  window.saveTemplate = async function(id) {
    const data = {
      name: document.getElementById('tpl-name').value.trim(),
      format: document.getElementById('tpl-format').value,
      content: document.getElementById('tpl-content').value.trim(),
      description: document.getElementById('tpl-desc').value.trim()
    };
    if (!data.name || !data.content) { showSnackbar('请填写名称和内容'); return; }
    if (id) await API.updateTemplate(id, data);
    else await API.createTemplate(data);
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
    const typeLabels = { rss:'RSS', website:'网页', keyword:'关键词', article:'文章' };
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
        </select>
      </div>
      <div class="md-field" id="src-url-field"><label>URL</label><input id="src-url" value="${esc(src.source_url)}" placeholder="https://..."></div>
      <div class="md-field hidden" id="src-keyword-field"><label>关键词</label><input id="src-keyword" value="${esc(src.keyword)}" placeholder="输入搜索关键词"></div>
      <div class="md-field"><label>抓取间隔（秒）</label><input type="number" id="src-interval" value="${src.fetch_interval}"></div>
    `, [
      { text:'取消', class:'md-btn md-btn-text', onclick:'hideDialog()' },
      { text:'保存', class:'md-btn md-btn-filled', onclick:`saveSource(${id||'null'})` }
    ]);
    setTimeout(() => toggleSourceFields(), 10);
  };

  window.toggleSourceFields = function() {
    const type = document.getElementById('src-type').value;
    document.getElementById('src-url-field').classList.toggle('hidden', type === 'keyword');
    document.getElementById('src-keyword-field').classList.toggle('hidden', type !== 'keyword');
  };

  window.saveSource = async function(id) {
    const data = {
      name: document.getElementById('src-name').value.trim(),
      source_type: document.getElementById('src-type').value,
      source_url: document.getElementById('src-url')?.value.trim() || '',
      keyword: document.getElementById('src-keyword')?.value.trim() || '',
      fetch_interval: parseInt(document.getElementById('src-interval').value) || 3600,
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
    return d.toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  }

  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  window.handleLogout = async function() {
    await API.logout();
    window.location.href = '/login.html';
  };

  // Init
  loadUser();
  navigateTo('dashboard');
})();
