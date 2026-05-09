# 优安米 (UAMME)

企业微信 Webhook 推送机器人配置平台，支持多用户、模板管理、内容源接入、定时推送、AI智能优化。

🌐 **在线体验：** [uamme.com](https://uamme.com)

## 功能特性

### 🔗 Webhook 管理
- 创建、编辑、删除 Webhook 机器人
- 支持启用/停用切换
- 一键测试推送

### 📝 推送模板
- 纯文本 / Markdown 格式
- 支持 `{{title}}` `{{body}}` 变量占位
- 模板预览（变量替换）
- **AI智能优化**：一键优化模板内容，提升可读性和专业度

### 📰 内容源管理
- RSS 订阅
- 网页抓取
- 关键词监控
- 自动定时抓取
- **AI智能优化**：自动优化抓取的内容

### ✏️ 自定义内容
- 手动编写推送内容
- 关联模板快速填充
- **AI智能优化**：一键优化内容质量和标题

### 🚀 推送引擎
- 选择 Webhook + 模板 + 内容，一键推送
- 推送日志记录（成功/失败/响应详情）
- Dashboard 数据总览

### ⏰ 定时推送
- 基于 **Cloudflare Cron Triggers**，无需访问网站即可自动执行
- 支持间隔推送（如每30分钟）
- 支持 Cron 表达式（如 `0 9 * * *` 每天9点）
- 任务启停控制
- 推送历史记录
- **在创建模板时可直接配置定时推送**

### 🤖 AI 智能优化
- 可配置自定义 AI API（OpenAI兼容接口）
- 支持任意模型（如 GPT-4、Claude、本地模型等）
- 一键优化内容质量、可读性、专业度
- 自动生成优化标题
- 管理员可在设置中配置 API 地址、密钥、模型

### 👥 多用户系统
- 管理员可创建/删除子账户
- **内容隔离**：每个用户只能看到自己的数据
- 账户设置：登录后可自行修改密码

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Cloudflare Workers |
| 框架 | Hono |
| 数据库 | Cloudflare D1 (SQLite) |
| 前端 | 原生 HTML/CSS/JS + Material Design 3 |
| 认证 | PBKDF2-SHA256 + Token Session |
| AI | OpenAI 兼容接口（可配置） |
| 定时 | Cloudflare Cron Triggers（每分钟轮询） |
| 部署 | GitHub Actions 自动构建部署 |

## 项目结构

```
uamme/
├── src/
│   ├── index.ts              # Worker 入口
│   ├── db/index.ts            # D1 数据库 helper
│   ├── middleware/auth.ts      # 认证中间件
│   └── routes/
│       ├── auth.ts            # 登录/注册/改密/用户管理
│       ├── webhook.ts         # Webhook CRUD
│       ├── template.ts        # 模板 CRUD
│       ├── content.ts         # 内容源 CRUD
│       ├── custom.ts          # 自定义内容 CRUD
│       ├── push.ts            # 推送执行
│       ├── dashboard.ts       # 仪表盘数据
│       ├── ai.ts              # AI 优化接口
│       ├── schedule.ts        # 定时推送任务管理
│       └── api.ts             # API 汇总路由
├── public/
│   ├── index.html             # 首页
│   ├── login.html             # 登录页
│   ├── app.html               # 主应用页
│   ├── css/style.css          # MD3 样式
│   └── js/
│       ├── api.js             # API 客户端
│       └── app.js             # 前端逻辑
├── migrations/
│   ├── 0001_init.sql          # 建表
│   ├── 0002_seed.sql          # 默认管理员
│   ├── 0003_ai_settings.sql   # AI 设置表
│   └── 0004_scheduled_tasks.sql # 定时任务表
├── scripts/
│   ├── build-embedded.js      # 静态资源嵌入构建
│   └── embed-and-deploy.sh    # 构建+部署脚本
├── .github/workflows/
│   └── deploy.yml             # GitHub Actions 自动部署
└── wrangler.toml              # Cloudflare Workers 配置
```

## 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 初始化本地数据库
npx wrangler d1 execute uamme-db --local --file=migrations/0001_init.sql
npx wrangler d1 execute uamme-db --local --file=migrations/0002_seed.sql
npx wrangler d1 execute uamme-db --local --file=migrations/0003_ai_settings.sql
npx wrangler d1 execute uamme-db --local --file=migrations/0004_scheduled_tasks.sql

# 启动开发服务器
npx wrangler dev --port 3000
```

访问 http://localhost:3000，使用默认账号登录：
- 用户名：`admin`
- 密码：`admin123`

### 部署到 Cloudflare

```bash
# 一键构建+部署（需要 Cloudflare API 凭据）
./scripts/embed-and-deploy.sh
```

或通过 GitHub Actions 自动部署：push 到 `master` 分支即可触发。

### 定时推送 Cron Triggers

定时推送使用 Cloudflare Workers 原生 Cron Triggers，每分钟自动触发调度器检查到期任务并执行推送，**无需任何外部访问**。

部署后需手动添加 Cron Trigger（Cloudflare API 不支持通过脚本自动设置）：

```bash
# 设置 Cron Trigger（每分钟执行）
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/scripts/uamme/schedules" \
  -H "X-Auth-Email: {EMAIL}" \
  -H "X-Auth-Key: {API_KEY}" \
  -H "Content-Type: application/json" \
  -d '[{"cron": "* * * * *"}]'
```

> ⚠️ Cron Trigger 最小粒度为1分钟。如需更精确的调度，建议配合 Cloudflare Queues。

## 环境变量

| 变量 | 说明 |
|------|------|
| `CLOUDFLARE_API_EMAIL` | Cloudflare 账户邮箱 |
| `CLOUDFLARE_API_KEY` | Cloudflare Global API Key |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |

## 安全特性

- **PBKDF2-SHA256** 密码哈希（100,000 次迭代）
- **Timing-safe** 密码比对，防时序攻击
- **登录频率限制**：5 次/15 分钟/IP
- **SSRF 防护**：Webhook 仅允许 `qyapi.weixin.qq.com`
- **内容隔离**：所有数据查询强制 `user_id` 过滤

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/change-password` | 修改密码 |
| GET | `/api/auth/users` | 获取用户列表（管理员） |
| POST | `/api/auth/users` | 创建用户（管理员） |
| DELETE | `/api/auth/users/:id` | 删除用户（管理员） |
| GET | `/api/webhooks` | 获取 Webhook 列表 |
| POST | `/api/webhooks` | 创建 Webhook |
| PUT | `/api/webhooks/:id` | 更新 Webhook |
| DELETE | `/api/webhooks/:id` | 删除 Webhook |
| POST | `/api/webhooks/:id/test` | 测试 Webhook |
| GET | `/api/templates` | 获取模板列表 |
| POST | `/api/templates` | 创建模板 |
| PUT | `/api/templates/:id` | 更新模板 |
| DELETE | `/api/templates/:id` | 删除模板 |
| GET | `/api/content-sources` | 获取内容源列表 |
| POST | `/api/content-sources` | 创建内容源 |
| PUT | `/api/content-sources/:id` | 更新内容源 |
| DELETE | `/api/content-sources/:id` | 删除内容源 |
| GET | `/api/custom-contents` | 获取自定义内容列表 |
| POST | `/api/custom-contents` | 创建自定义内容 |
| PUT | `/api/custom-contents/:id` | 更新自定义内容 |
| DELETE | `/api/custom-contents/:id` | 删除自定义内容 |
| POST | `/api/push/send` | 发送推送 |
| GET | `/api/push/logs` | 获取推送日志 |
| GET | `/api/dashboard/stats` | 获取仪表盘统计 |
| GET | `/api/ai/settings` | 获取 AI 设置（管理员） |
| PUT | `/api/ai/settings` | 更新 AI 设置（管理员） |
| POST | `/api/ai/optimize` | AI 优化内容 |
| GET | `/api/schedule/tasks` | 获取定时任务列表 |
| POST | `/api/schedule/tasks` | 创建定时任务 |
| PUT | `/api/schedule/tasks/:id` | 更新定时任务 |
| DELETE | `/api/schedule/tasks/:id` | 删除定时任务 |
| POST | `/api/schedule/tasks/:id/run-now` | 立即执行定时任务 |
| GET | `/api/schedule/tasks/:id/runs` | 获取任务执行历史 |

## License

MIT
