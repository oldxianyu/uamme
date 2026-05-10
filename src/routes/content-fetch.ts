const TZ = 'Asia/Shanghai';

// ===== Server Monitor Fetcher =====
export async function fetchServerStatus(config: any): Promise<string> {
  const baseUrl = config.base_url;
  if (!baseUrl) throw new Error('缺少 base_url 配置');

  const ignore: Set<string> = new Set((config.ignore_nodes || '').split(',').map((s: string) => s.trim()).filter(Boolean));

  // Fetch nodes list
  const nodesResp = await fetch(`${baseUrl}/api/nodes`, { signal: AbortSignal.timeout(15000) });
  if (!nodesResp.ok) throw new Error(`节点列表获取失败: ${nodesResp.status}`);
  const nodesData: any = await nodesResp.json();
  const nodes = nodesData.data || [];

  const now = new Date();
  const rows: any[] = [];

  for (const n of nodes) {
    if (ignore.has(n.name)) continue;
    const region = n.region || '';
    let daysLeft: number | null = null;
    if (n.expired_at) {
      const expired = new Date(n.expired_at);
      daysLeft = Math.floor((expired.getTime() - now.getTime()) / 86400000);
    }

    let recent: any;
    try {
      const r = await fetch(`${baseUrl}/api/recent/${n.uuid}`, { signal: AbortSignal.timeout(10000) });
      const d = await r.json();
      recent = d.data;
    } catch (e: any) {
      rows.push({ name: n.name, region, status: '异常', issue: `接口异常: ${e.message}`, daysLeft });
      continue;
    }

    if (!recent || !recent.length) {
      rows.push({ name: n.name, region, status: '异常', issue: '无最近监控数据/疑似离线', daysLeft });
      continue;
    }

    const x = recent[0];
    const ramTotal = x.ram?.total || 0;
    const ramUsed = x.ram?.used || 0;
    const diskTotal = x.disk?.total || 0;
    const diskUsed = x.disk?.used || 0;
    const issues: string[] = [];

    if (diskTotal && diskUsed / diskTotal >= 0.85) issues.push(`磁盘高 ${(diskUsed / diskTotal * 100).toFixed(1)}%`);
    if (ramTotal && ramUsed / ramTotal >= 0.85) issues.push(`内存高 ${(ramUsed / ramTotal * 100).toFixed(1)}%`);
    if (x.cpu?.usage >= 85) issues.push(`CPU高 ${x.cpu.usage.toFixed(1)}%`);
    if (daysLeft !== null) {
      if (daysLeft < 0) issues.push(`已过期 ${-daysLeft} 天`);
      else if (daysLeft <= 7) issues.push(`即将到期 ${daysLeft} 天`);
      else if (daysLeft <= 14) issues.push(`14天内到期 ${daysLeft} 天`);
    }

    rows.push({
      name: n.name, region,
      status: issues.length ? '注意' : '正常',
      issue: issues.join('；'),
      cpu: x.cpu?.usage?.toFixed(1) || '0',
      ramPct: ramTotal ? (ramUsed / ramTotal * 100).toFixed(1) : '0',
      diskPct: diskTotal ? (diskUsed / diskTotal * 100).toFixed(1) : '0',
      upKbs: ((x.network?.up || 0) / 1024).toFixed(1),
      downKbs: ((x.network?.down || 0) / 1024).toFixed(1),
      upTotalGb: ((x.network?.totalUp || 0) / 1073741824).toFixed(1),
      downTotalGb: ((x.network?.totalDown || 0) / 1073741824).toFixed(1),
      daysLeft,
    });
  }

  // Format as markdown
  const bad = rows.filter(r => r.status !== '正常');
  const expiring = rows.filter(r => r.daysLeft !== null && r.daysLeft <= 14);
  const topDown = [...rows].sort((a, b) => parseFloat(b.downKbs) - parseFloat(a.downKbs)).slice(0, 3);
  const topTotal = [...rows].sort((a, b) => parseFloat(b.downTotalGb) - parseFloat(a.downTotalGb)).slice(0, 3);

  const lines: string[] = [];
  lines.push('# 🌅 每日晨报');
  lines.push(`> 节点数：${rows.length}`);
  lines.push('');
  lines.push('## 🚨 异常 / 需关注');
  if (bad.length) {
    for (const r of bad) lines.push(`- **${r.name}** ${r.region}：${r.issue || r.status}`);
  } else {
    lines.push('- 今日暂无明显异常');
  }
  lines.push('');
  lines.push('## ⏰ 到期提醒');
  if (expiring.length) {
    expiring.sort((a, b) => (a.daysLeft || 0) - (b.daysLeft || 0));
    for (const r of expiring) {
      const tag = r.daysLeft! < 0 ? `已过期 ${-r.daysLeft!} 天` : r.daysLeft! <= 7 ? `🚨 ${r.daysLeft} 天内到期` : `${r.daysLeft} 天内到期`;
      lines.push(`- **${r.name}** ${r.region}：${tag}`);
    }
  } else {
    lines.push('- 14 天内暂无到期机器');
  }
  lines.push('');
  lines.push('## 📶 实时流量 Top 3（下载）');
  for (const r of topDown) lines.push(`- **${r.name}**：↓ ${r.downKbs} KB/s ｜ ↑ ${r.upKbs} KB/s`);
  lines.push('');
  lines.push('## 📦 累计流量 Top 3（下载）');
  for (const r of topTotal) lines.push(`- **${r.name}**：↓ ${r.downTotalGb} GB ｜ ↑ ${r.upTotalGb} GB`);
  lines.push('');
  lines.push('## 🖥️ 全部服务器');
  for (const r of rows) {
    const emoji = r.status === '正常' ? '🟢' : '🟠';
    const extra = r.issue ? ` ｜ ${r.issue}` : '';
    lines.push(`- ${emoji} **${r.name}** ${r.region} ｜ CPU ${r.cpu}% ｜ 内存 ${r.ramPct}% ｜ 磁盘 ${r.diskPct}% ｜ ↓ ${r.downKbs} KB/s${extra}`);
  }

  return lines.join('\n');
}

// ===== News Briefing Fetcher =====
function cleanText(s: string): string {
  return (s || '').replace(/\s+/g, ' ').trim();
}

async function fetchGoogleNews(query: string, limit = 30): Promise<any[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const xml = await resp.text();
  const items: any[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) && items.length < limit) {
    const block = m[1];
    const title = cleanText((block.match(/<title[^>]*>([^<]+)<\/title>/) || [])[1] || '');
    const link = cleanText((block.match(/<link[^>]*>([^<]+)<\/link>/) || (block.match(/<link>([^<]+)<\/link>/) || []))[1] || '');
    const pub = cleanText((block.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/) || [])[1] || '');
    if (title && link) items.push({ title, link, pub });
  }
  return items;
}

async function fetchBingNews(query: string, limit = 30): Promise<any[]> {
  try {
    const resp = await fetch(`https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`, { signal: AbortSignal.timeout(20000) });
    const xml = await resp.text();
    const items: any[] = [];
    const re = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = re.exec(xml)) && items.length < limit) {
      const block = m[1];
      const title = cleanText((block.match(/<title[^>]*>([^<]+)<\/title>/) || [])[1] || '');
      const link = cleanText((block.match(/<link[^>]*>([^<]+)<\/link>/) || (block.match(/<link>([^<]+)<\/link>/) || []))[1] || '');
      const pub = cleanText((block.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/) || [])[1] || '');
      if (title && link) items.push({ title, link, pub });
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchNHSA(): Promise<any[]> {
  try {
    const resp = await fetch('https://www.nhsa.gov.cn/col/col157/index.html', { signal: AbortSignal.timeout(20000) });
    const html = await resp.text();
    const items: any[] = [];
    // Match: <li>...<a href="...">title</a>...<span>date</span>...</li>
    const re = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?(\d{4}-\d{2}-\d{2})/g;
    let m;
    while ((m = re.exec(html)) && items.length < 8) {
      let href = m[1];
      const title = cleanText(m[2]);
      const date = m[3];
      if (!title || title.length < 4) continue;
      if (!href.startsWith('http')) href = 'https://www.nhsa.gov.cn' + (href.startsWith('/') ? '' : '/') + href;
      items.push({ title: `【国家医保局】${title}`, link: href, pub: date });
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchWeather(ak: string, cityCode: string): Promise<string> {
  try {
    const baseResp = await fetch(`https://restapi.amap.com/v3/weather/weatherInfo?key=${ak}&city=${cityCode}&extensions=base&output=JSON`, { signal: AbortSignal.timeout(10000) });
    const baseData: any = await baseResp.json();
    if (baseData.status !== '1' || !baseData.lives?.length) return '天气获取失败';
    const cur = baseData.lives[0];
    return `济南：${cur.weather}，当前${cur.temperature}℃，湿度${cur.humidity}%，${cur.winddirection}风${cur.windpower}级`;
  } catch {
    return '天气获取失败';
  }
}

export async function fetchNewsBriefing(config: any): Promise<string> {
  const ak = config.weather_api_key || '';
  const cityCode = config.city_adcode || '370100';
  const newsQuery = config.news_query || '(零售药店 OR 连锁药店 OR 药店) (监管 OR 处罚 OR 约谈 OR 医保 OR 转型 OR 健康驿站)';
  const newsDays = parseInt(config.news_days) || 3;
  const newsLimit = parseInt(config.news_limit) || 8;

  const cutoff = Date.now() - newsDays * 86400000;

  // Fetch all sources in parallel
  const [weather, official, googleNews, bingNews] = await Promise.all([
    ak ? fetchWeather(ak, cityCode) : Promise.resolve('未配置天气API'),
    fetchNHSA(),
    fetchGoogleNews(newsQuery, 60),
    fetchBingNews(newsQuery, 60),
  ]);

  // Filter recent only
  const recentOnly = (items: any[]) => items.filter(it => {
    if (!it.pub) return false;
    try {
      const dt = new Date(it.pub);
      return dt.getTime() >= cutoff;
    } catch {
      return false;
    }
  });

  // Merge + deduplicate
  const pool = [...official, ...recentOnly(googleNews), ...recentOnly(bingNews)];
  const seen = new Set<string>();
  const news: any[] = [];
  for (const it of pool) {
    if (!it.title || seen.has(it.title)) continue;
    seen.add(it.title);
    news.push(it);
    if (news.length >= newsLimit) break;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', { timeZone: TZ });
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = weekdays[now.getDay()];
  const timeStr = now.toLocaleString('zh-CN', { timeZone: TZ, hour12: false });

  const lines: string[] = [];
  lines.push('# 🌤️ 每日早报');
  lines.push(`> 时间：${timeStr}`);
  lines.push(`> 日期：${dateStr} ${weekday}`);
  lines.push('');
  lines.push('## 🌡️ 济南天气');
  lines.push(`- ${weather}`);
  lines.push('');
  lines.push('## 📰 中国药店行业简讯');
  lines.push(`> 口径：Google News + Bing News + 国家医保局｜近 ${newsDays} 天`);
  if (!news.length) {
    lines.push('- 今日新闻暂无结果（将于明日重试）。');
  } else {
    for (let i = 0; i < news.length; i++) {
      const it = news[i];
      const pub = it.pub ? `（${it.pub}）` : '';
      lines.push(`${i + 1}. [${it.title}](${it.link})${pub}`);
    }
  }
  lines.push('');
  lines.push('**关键词：零售药店 / 监管 / 连锁 / 医保 / 处罚 / 健康驿站**');

  return lines.join('\n');
}

// ===== Dispatcher =====
export async function fetchBySourceType(sourceType: string, config: any): Promise<string> {
  const cfg = typeof config === 'string' ? JSON.parse(config || '{}') : (config || {});
  switch (sourceType) {
    case 'server-monitor': return fetchServerStatus(cfg);
    case 'news-briefing': return fetchNewsBriefing(cfg);
    case 'api-call': return fetchApiCall(cfg);
    case 'browser-render': return fetchBrowserRender(cfg);
    default: throw new Error(`未知的内容源类型: ${sourceType}`);
  }
}

// ===== API Call Fetcher =====
async function fetchApiCall(config: any): Promise<string> {
  const { url, method = 'GET', headers = {}, body, json_path, item_separator = '\n', max_items = 20, template } = config;
  if (!url) throw new Error('缺少 API URL 配置');

  const fetchOpts: RequestInit = {
    method: method.toUpperCase(),
    headers: { 'Content-Type': 'application/json', ...headers },
    signal: AbortSignal.timeout(15000),
  };
  if (method.toUpperCase() === 'POST' && body) {
    fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const resp = await fetch(url, fetchOpts);
  if (!resp.ok) throw new Error(`API 请求失败: ${resp.status} ${resp.statusText}`);

  const data = await resp.json();

  // Extract data by json_path (e.g. "data.news" or "data.items")
  let items: any = data;
  if (json_path) {
    for (const key of json_path.split('.')) {
      if (items && typeof items === 'object') {
        items = items[key];
      } else {
        throw new Error(`JSON 路径 '${json_path}' 解析失败，在 '${key}' 处中断`);
      }
    }
  }

  if (items === undefined || items === null) {
    throw new Error(`JSON 路径 '${json_path}' 未找到数据`);
  }

  // If items is an array, format each item
  if (Array.isArray(items)) {
    const limited = items.slice(0, max_items);
    if (template) {
      // Use template to format each item
      return limited.map((item: any) => {
        let line = template;
        if (typeof item === 'object') {
          for (const [k, v] of Object.entries(item)) {
            line = line.replace(new RegExp(`\{\{${k}\}\}`, 'g'), String(v ?? ''));
          }
        } else {
          line = line.replace(/\{\{\?\}\}/g, String(item));
        }
        return line;
      }).join(item_separator);
    }
    // Default: stringify each item
    return limited.map((item: any) => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(item_separator);
  }

  // If items is a string, return directly
  if (typeof items === 'string') return items;

  // Otherwise stringify
  return JSON.stringify(items, null, 2);
}

// ===== Browser Render Fetcher (Browserless / compatible) =====
async function fetchBrowserRender(config: any): Promise<string> {
  const { url, api_url = 'https://chrome.browserless.io/content', api_token, selector, wait_seconds = 3 } = config;
  if (!url) throw new Error('缺少目标 URL 配置');
  if (!api_token) throw new Error('缺少 Browserless API Token');

  // Build request body (Browserless v2 only accepts url, selector, gotoOptions)
  const body: any = {
    url,
  };
  if (selector) body.selector = selector;
  body.gotoOptions = {
    waitUntil: 'networkidle0',
    timeout: 30000,
  };

  const resp = await fetch(`${api_url}?token=${api_token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`浏览器渲染失败: ${resp.status} ${errText.slice(0, 200)}`);
  }

  const html = await resp.text();

  // Strip script/style tags
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  // If a CSS selector is provided, try to extract that element's content
  if (selector) {
    const re = new RegExp(`<[^>]*class="[^"]*${selector}[^"]*"[^>]*>([\\s\\S]*?)</`, 'i');
    const match = cleaned.match(re);
    if (match) {
      const inner = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (inner.length > 50) return inner.slice(0, 4000);
    }
  }

  // Smart extraction: find numbered list items (e.g. hot search rankings)
  const lines = cleaned.split(/<[^>]+>/).map((s: string) => s.trim()).filter(Boolean);
  const numbered: string[] = [];
  for (const line of lines) {
    // Match patterns like "1 王楚钦..." or "1. 王楚钦..."
    const m = line.match(/^\d{1,3}[.\s、]+(.+)/);
    if (m && m[1].length > 1 && m[1].length < 100) {
      numbered.push(line.replace(/^\d{1,3}[.\s、]+/, ''));
    }
  }

  if (numbered.length >= 5) {
    return numbered.slice(0, 50).map((item, i) => `${i + 1}. ${item}`).join('\n');
  }

  // Fallback: return cleaned text
  const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length < 50) {
    throw new Error('渲染后页面内容为空，可能需要配置 CSS 选择器 (selector)');
  }
  return text.slice(0, 4000);
}
