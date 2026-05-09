#!/usr/bin/env python3
import re
import sys
import requests
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

WEBHOOKS = [
    "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=ebc2be14-6620-413e-90bf-82de0204634e",
]
TZ = ZoneInfo("Asia/Shanghai")
HOLIDAY_API_BASE = "https://api.jiejiariapi.com"
HOLIDAY_API_KEY = "jjr_2sd2zt6x_twjac2qbqok6mga427xytqfxpvwfq5byw2qlyurtygutkir2cgwq"
AMAP_WEATHER_URL = "https://restapi.amap.com/v3/weather/weatherInfo"
AMAP_WEATHER_KEY = "b2bf5c7431d960b813670aa42637c30e"
JINAN_ADCODE = "370100"

# News sources
GOOGLE_NEWS_RSS = "https://news.google.com/rss/search"
BING_NEWS_RSS = "https://www.bing.com/news/search"

# Query is a Google News RSS query. You can tune keywords here.
NEWS_QUERY = "(零售药店 OR 连锁药店 OR 药店) (监管 OR 处罚 OR 约谈 OR 医保 OR 转型 OR 健康驿站)"
NEWS_DAYS = 3  # only keep items within last N days (per 父皇)

# Official sources (lightweight, stable-first): NHSA media reports page
NHSA_MEDIA_URL = "https://www.nhsa.gov.cn/col/col46/index.html"  # 国家医保局·媒体报道


def fetch_weather():
    try:
        base = requests.get(
            AMAP_WEATHER_URL,
            params={
                "key": AMAP_WEATHER_KEY,
                "city": JINAN_ADCODE,
                "extensions": "base",
                "output": "JSON",
            },
            timeout=20,
        )
        base.raise_for_status()
        base_data = base.json()
        if base_data.get("status") != "1" or not base_data.get("lives"):
            raise ValueError(base_data.get("info") or "高德实况天气获取失败")
        cur = base_data["lives"][0]

        forecast = requests.get(
            AMAP_WEATHER_URL,
            params={
                "key": AMAP_WEATHER_KEY,
                "city": JINAN_ADCODE,
                "extensions": "all",
                "output": "JSON",
            },
            timeout=20,
        )
        forecast.raise_for_status()
        forecast_data = forecast.json()

        temp = cur.get("temperature", "?")
        humidity = cur.get("humidity", "?")
        weather = cur.get("weather", "未知")
        wind_dir = cur.get("winddirection", "?")
        wind_power = cur.get("windpower", "?")
        report_time = cur.get("reporttime", "")

        low = high = None
        forecasts = ((forecast_data.get("forecasts") or [{}])[0].get("casts") or []) if forecast_data.get("status") == "1" else []
        if forecasts:
            today = forecasts[0]
            low = today.get("nighttemp")
            high = today.get("daytemp")

        if low is not None and high is not None:
            return f"济南：{weather}，{low}~{high}℃，当前{temp}℃，湿度{humidity}%，{wind_dir}风{wind_power}级（高德 {report_time}）"
        return f"济南：{weather}，当前{temp}℃，湿度{humidity}%，{wind_dir}风{wind_power}级（高德 {report_time}）"
    except Exception:
        return "济南：天气暂时获取失败"


def fetch_next_holiday():
    now = datetime.now(TZ).date()
    year = now.year
    url = f"{HOLIDAY_API_BASE}/v1/holidays/{year}?key={HOLIDAY_API_KEY}"
    data = requests.get(url, timeout=20).json()
    holidays = []
    for _, info in data.items():
        if not info.get("isOffDay"):
            continue
        try:
            dt = datetime.fromisoformat(info["date"]).date()
        except Exception:
            continue
        if dt >= now:
            holidays.append((dt, info.get("name", "节假日")))
    if not holidays:
        return "暂无节假日数据"
    dt, name = sorted(holidays, key=lambda x: x[0])[0]
    days_left = (dt - now).days
    return f"下个节假日：{name}（{dt.month}月{dt.day}日，距今 {days_left} 天）"


def upcoming_weekend():
    now = datetime.now(TZ).date()
    days_to_sat = (5 - now.weekday()) % 7
    sat = now.fromordinal(now.toordinal() + days_to_sat)
    sun = now.fromordinal(sat.toordinal() + 1)
    if days_to_sat == 0:
        return f"本周末：今天（周六）到 {sun.month}月{sun.day}日（周日）"
    if days_to_sat == 1:
        return f"本周末：明天（周六）到 {sun.month}月{sun.day}日（周日）"
    return f"本周末：{sat.month}月{sat.day}日（周六）- {sun.month}月{sun.day}日（周日），还有 {days_to_sat} 天"


def _clean_text(s: str) -> str:
    s = re.sub(r"\s+", " ", (s or "").strip())
    return s


def fetch_google_news_rss(query: str, limit: int = 30):
    r = requests.get(
        GOOGLE_NEWS_RSS,
        params={"q": query, "hl": "zh-CN", "gl": "CN", "ceid": "CN:zh-Hans"},
        timeout=25,
    )
    r.raise_for_status()
    root = ET.fromstring(r.text)
    items = root.findall("./channel/item")
    out = []
    for it in items[:limit]:
        title = _clean_text(it.findtext("title"))
        link = _clean_text(it.findtext("link"))
        pub = _clean_text(it.findtext("pubDate"))
        dt = None
        if pub:
            try:
                dt = parsedate_to_datetime(pub)
            except Exception:
                dt = None
        if title and link:
            out.append({"title": title, "link": link, "dt": dt, "pub": pub})
    return out


def fetch_bing_news_rss(query: str, limit: int = 30):
    # Bing News RSS is sometimes empty for zh queries, so treat as best-effort.
    r = requests.get(BING_NEWS_RSS, params={"q": query, "format": "rss"}, timeout=25)
    r.raise_for_status()
    root = ET.fromstring(r.text)
    items = root.findall("./channel/item")
    out = []
    for it in items[:limit]:
        title = _clean_text(it.findtext("title"))
        link = _clean_text(it.findtext("link"))
        pub = _clean_text(it.findtext("pubDate"))
        dt = None
        if pub:
            try:
                dt = parsedate_to_datetime(pub)
            except Exception:
                dt = None
        if title and link:
            out.append({"title": title, "link": link, "dt": dt, "pub": pub})
    return out


def fetch_nhsa_media(limit: int = 6):
    """Scrape NHSA media reports list page (official). Best-effort.

    This page embeds list items inside <record><![CDATA[ ... ]]></record> blocks.
    We parse those blocks first for accuracy.
    """
    try:
        r = requests.get(NHSA_MEDIA_URL, timeout=25)
        r.encoding = r.apparent_encoding
        html = r.text
    except Exception:
        return []

    out = []

    # Preferred: parse CDATA records that contain clean <li> blocks.
    for cdata in re.findall(r"<record><!\[CDATA\[(.*?)\]\]></record>", html, flags=re.S):
        m = re.search(
            r"<a[^>]+href=\"([^\"]+)\"[^>]*>(.*?)</a>\s*<span[^>]*>(\d{4}-\d{2}-\d{2})</span>",
            cdata,
            flags=re.S,
        )
        if not m:
            continue
        href, title_html, date = m.group(1), m.group(2), m.group(3)
        title = _clean_text(re.sub(r"<.*?>", "", title_html))
        if not title:
            continue
        if not href.startswith("http"):
            href = "https://www.nhsa.gov.cn" + (href if href.startswith("/") else "/" + href)
        out.append({"title": f"【国家医保局】{title}", "link": href, "dt": None, "pub": date})
        if len(out) >= limit:
            return out

    # Fallback: direct <li> pattern on page (may be noisy)
    for href, title_html, date in re.findall(
        r"<li[^>]*>\s*<a[^>]+href=\"([^\"]+)\"[^>]*>(.*?)</a>\s*<span[^>]*>(\d{4}-\d{2}-\d{2})</span>",
        html,
        flags=re.S,
    ):
        title = _clean_text(re.sub(r"<.*?>", "", title_html))
        if not title:
            continue
        if not href.startswith("http"):
            href = "https://www.nhsa.gov.cn" + (href if href.startswith("/") else "/" + href)
        out.append({"title": f"【国家医保局】{title}", "link": href, "dt": None, "pub": date})
        if len(out) >= limit:
            break

    if out:
        return out

    # Last fallback: very lightweight anchor extraction
    anchors = re.findall(r"<a[^>]+href=\"([^\"]+)\"[^>]*>([^<]{6,80})</a>", html)
    for href, text in anchors:
        text = _clean_text(text)
        if not text or "更多" in text or "首页" in text:
            continue
        if not href.startswith("http"):
            href = "https://www.nhsa.gov.cn" + (href if href.startswith("/") else "/" + href)
        out.append({"title": f"【国家医保局】{text}", "link": href, "dt": None, "pub": ""})
        if len(out) >= limit:
            break
    return out


def fetch_pharmacy_brief(limit: int = 8):
    # Recent-only filter to avoid old articles resurfacing
    now_utc = datetime.now(tz=ZoneInfo("UTC"))
    cutoff = now_utc.timestamp() - NEWS_DAYS * 86400

    # 1) Official items (best-effort, no date filter because page doesn't expose stable pubDate)
    official = fetch_nhsa_media(limit=4)

    # 2) Google News (primary)
    items_g = fetch_google_news_rss(NEWS_QUERY, limit=60)

    # 3) Bing News (fallback/buffer)
    try:
        items_b = fetch_bing_news_rss(NEWS_QUERY, limit=60)
    except Exception:
        items_b = []

    def recent_only(items):
        out=[]
        for it in items:
            dt = it.get('dt')
            if not dt:
                continue
            try:
                ts = dt.timestamp()
            except Exception:
                continue
            if ts >= cutoff:
                out.append(it)
        return out

    pool = official + recent_only(items_g) + recent_only(items_b)

    # Deduplicate by title
    seen = set()
    out = []
    for it in pool:
        t = it.get("title")
        if not t or t in seen:
            continue
        seen.add(t)
        out.append(it)
        if len(out) >= limit:
            break
    return out


def build_message():
    now = datetime.now(TZ)
    date_str = now.strftime("%Y-%m-%d")
    weekday_map = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    weekday = weekday_map[now.weekday()]
    weather = fetch_weather()
    holiday = fetch_next_holiday()
    weekend = upcoming_weekend()
    current_time = now.strftime("%Y-%m-%d %H:%M")

    news = fetch_pharmacy_brief(limit=8)

    lines = []
    lines.append("# 🌤️ 每日早报")
    lines.append(f"> 时间：{current_time}")
    lines.append(f"> 日期：{date_str} {weekday}")
    lines.append("")
    lines.append("## 🌡️ 济南天气")
    lines.append(f"- {weather}")
    lines.append("")
    lines.append("## 📅 节假日提醒")
    lines.append(f"- {holiday}")
    lines.append(f"- {weekend}")
    lines.append("")
    lines.append("## 📰 中国药店行业简讯")
    lines.append(f"> 口径：Google News(主) + Bing News(备) + 国家医保局(官)｜仅近 {NEWS_DAYS} 天")
    if not news:
        lines.append("- 今日新闻抓取失败/暂无结果（将于明日重试）。")
    else:
        for i,it in enumerate(news, 1):
            title = it["title"]
            link = it["link"]
            pub = (it.get("pub") or "").strip()
            suffix = f"（{pub}）" if pub else ""
            lines.append(f"{i}. [{title}]({link}){suffix}")
    lines.append("")
    lines.append("**关键词：零售药店 / 监管 / 连锁 / 医保 / 处罚 / 健康驿站**")
    return "\n".join(lines)


def send(msg):
    payload = {"msgtype": "markdown", "markdown": {"content": msg[:4000]}}
    for webhook in WEBHOOKS:
        r = requests.post(webhook, json=payload, timeout=20)
        r.raise_for_status()
        print(r.text)


if __name__ == "__main__":
    if "--dry-run" in sys.argv:
        # Do not send. Only print the rendered markdown for inspection.
        print(build_message())
        raise SystemExit(0)
    send(build_message())
