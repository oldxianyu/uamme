#!/usr/bin/env python3
import json
import requests
from datetime import datetime
from zoneinfo import ZoneInfo

BASE = "https://066609.xyz"
WEBHOOK = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=ebc2be14-6620-413e-90bf-82de0204634e"
IGNORE = {"美国灵车3.8"}
TZ = ZoneInfo("Asia/Shanghai")


def gb(v):
    return v / 1024 / 1024 / 1024 if v else 0


def get_json(url):
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    return r.json()


def parse_expired_at(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None


def fetch_status():
    nodes = get_json(f"{BASE}/api/nodes")["data"]
    rows = []
    now = datetime.now(TZ)
    for n in nodes:
        name = n["name"]
        if name in IGNORE:
            continue
        region = n.get("region", "")
        expired_at = parse_expired_at(n.get("expired_at"))
        days_left = None
        if expired_at:
            days_left = (expired_at.astimezone(TZ).date() - now.date()).days
        try:
            recent = get_json(f"{BASE}/api/recent/{n['uuid']}")
            data = recent.get("data")
        except Exception as e:
            rows.append({
                "name": name, "region": region, "status": "异常", "issue": f"接口异常: {e}",
                "days_left": days_left, "expired_at": expired_at
            })
            continue
        if not data:
            rows.append({
                "name": name, "region": region, "status": "异常", "issue": "无最近监控数据/疑似离线",
                "days_left": days_left, "expired_at": expired_at
            })
            continue
        x = data[0]
        ram_total = x["ram"]["total"] or 0
        ram_used = x["ram"]["used"] or 0
        disk_total = x["disk"]["total"] or 0
        disk_used = x["disk"]["used"] or 0
        net = x["network"]
        issue = []
        if disk_total and disk_used / disk_total >= 0.85:
            issue.append(f"磁盘高 {disk_used / disk_total * 100:.1f}%")
        if ram_total and ram_used / ram_total >= 0.85:
            issue.append(f"内存高 {ram_used / ram_total * 100:.1f}%")
        if x["cpu"]["usage"] >= 85:
            issue.append(f"CPU高 {x['cpu']['usage']:.1f}%")
        if days_left is not None:
            if days_left < 0:
                issue.append(f"已过期 {-days_left} 天")
            elif days_left <= 7:
                issue.append(f"即将到期 {days_left} 天")
            elif days_left <= 14:
                issue.append(f"14天内到期 {days_left} 天")
        rows.append({
            "name": name,
            "region": region,
            "status": "正常" if not issue else "注意",
            "issue": "；".join(issue),
            "cpu": round(x["cpu"]["usage"], 1),
            "ram_pct": round(ram_used / ram_total * 100, 1) if ram_total else 0,
            "disk_pct": round(disk_used / disk_total * 100, 1) if disk_total else 0,
            "up_kbs": round(net["up"] / 1024, 1),
            "down_kbs": round(net["down"] / 1024, 1),
            "up_total_gb": round(gb(net["totalUp"]), 1),
            "down_total_gb": round(gb(net["totalDown"]), 1),
            "days_left": days_left,
            "expired_at": expired_at,
        })
    return rows


def format_markdown(rows):
    now = datetime.now(TZ).strftime("%Y-%m-%d %H:%M")
    bad = [r for r in rows if r["status"] != "正常"]
    expiring = [r for r in rows if r.get("days_left") is not None and r["days_left"] <= 14]
    top_down = sorted([r for r in rows if "down_kbs" in r], key=lambda x: x["down_kbs"], reverse=True)[:3]
    top_total = sorted([r for r in rows if "down_total_gb" in r], key=lambda x: x["down_total_gb"], reverse=True)[:3]

    lines = []
    lines.append("# 🌅 每日晨报")
    lines.append(f"> 时间：{now}（北京时间）")
    lines.append(f"> 节点数：{len(rows)}")
    lines.append("")

    lines.append("## 🚨 异常 / 需关注")
    if bad:
        for r in bad:
            lines.append(f"- **{r['name']}** {r['region']}：{r['issue'] or r['status']}")
    else:
        lines.append("- 今日暂无明显异常")
    lines.append("")

    lines.append("## ⏰ 到期提醒")
    if expiring:
        expiring.sort(key=lambda x: x['days_left'])
        for r in expiring:
            if r['days_left'] < 0:
                tag = f"已过期 {-r['days_left']} 天"
            elif r['days_left'] <= 7:
                tag = f"🚨 {r['days_left']} 天内到期"
            else:
                tag = f"{r['days_left']} 天内到期"
            lines.append(f"- **{r['name']}** {r['region']}：{tag}")
    else:
        lines.append("- 14 天内暂无到期机器")
    lines.append("")

    lines.append("## 📶 实时流量 Top 3（下载）")
    for r in top_down:
        lines.append(f"- **{r['name']}**：↓ {r['down_kbs']} KB/s ｜ ↑ {r['up_kbs']} KB/s")
    lines.append("")

    lines.append("## 📦 累计流量 Top 3（下载）")
    for r in top_total:
        lines.append(f"- **{r['name']}**：↓ {r['down_total_gb']} GB ｜ ↑ {r['up_total_gb']} GB")
    lines.append("")

    lines.append("## 🖥️ 全部服务器")
    for r in rows:
        status_emoji = "🟢" if r['status'] == '正常' else "🟠"
        extra = f" ｜ {r['issue']}" if r.get('issue') else ""
        lines.append(
            f"- {status_emoji} **{r['name']}** {r['region']} ｜ CPU {r.get('cpu',0)}% ｜ 内存 {r.get('ram_pct',0)}% ｜ 磁盘 {r.get('disk_pct',0)}% ｜ ↓ {r.get('down_kbs',0)} KB/s{extra}"
        )
    return "\n".join(lines)


def send(msg):
    payload = {"msgtype": "markdown", "markdown": {"content": msg[:4000]}}
    r = requests.post(WEBHOOK, json=payload, timeout=20)
    r.raise_for_status()
    print(r.text)


if __name__ == "__main__":
    rows = fetch_status()
    msg = format_markdown(rows)
    send(msg)
