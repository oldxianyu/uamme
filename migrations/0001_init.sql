-- 优安米 (UAMME) - Database Schema
-- Cloudflare D1 (SQLite)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Webhook configurations
CREATE TABLE IF NOT EXISTS webhook_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Message templates
CREATE TABLE IF NOT EXISTS message_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'text', -- text, markdown, custom
  content TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Content sources (RSS, website, keyword, article)
CREATE TABLE IF NOT EXISTS content_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL, -- rss, website, keyword, article
  source_url TEXT DEFAULT '',
  keyword TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  fetch_interval INTEGER DEFAULT 3600, -- seconds
  last_fetched_at TEXT,
  config TEXT DEFAULT '{}', -- JSON config for extra options
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Custom content
CREATE TABLE IF NOT EXISTS custom_contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  template_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES message_templates(id) ON DELETE SET NULL
);

-- Push logs
CREATE TABLE IF NOT EXISTS push_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  webhook_id INTEGER NOT NULL,
  template_id INTEGER,
  content_source_id INTEGER,
  custom_content_id INTEGER,
  title TEXT DEFAULT '',
  body_preview TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, success, failed
  response_code INTEGER,
  response_body TEXT DEFAULT '',
  error_message TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (webhook_id) REFERENCES webhook_configs(id) ON DELETE CASCADE
);

-- Sessions (for auth)
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_configs_user ON webhook_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_user ON message_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_content_sources_user ON content_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_contents_user ON custom_contents(user_id);
CREATE INDEX IF NOT EXISTS idx_push_logs_user ON push_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_push_logs_webhook ON push_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Default admin user (password: admin123, bcrypt hash)
INSERT INTO users (username, password_hash, display_name) VALUES
  ('admin', '$2b$10$YourHashHere', '管理员');
