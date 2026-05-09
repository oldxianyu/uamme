# 优安米 (UAMME)

企业微信 Webhook 推送机器人配置平台，支持多用户、模板管理、内容源接入、定时推送。

🌐 **在线体验：** [uamme.171801508.workers.dev](https://uamme.171801508.workers.dev)

## 功能特性

### 🔗 Webhook 管理
- 创建、编辑、删除 Webhook 机器人
- 支持启用/停用切换
- 一键测试推送

### 📝 推送模板
- 纯文本 / Markdown 格式
- 支持 `{{title}}` `{{body}}` 变量占位
- 模板预览（变量替换）

### 📰 内容源管理
- RSS 订阅
- 网页抓取
- 关键词监控
- 自动定时抓取

### ✏️ 自定义内容
- 手动编写推送内容
- 关联模板快速填充

### 🚀 推送引擎
- 选择 Webhook + 模板 + 内容，一键推送
- 推送日志记录（成功/失败/响应详情）
- Dashboard 数据总览

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
│   └── 0002_seed.sql          # 默认管理员
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

## License

MIT
