-- AI settings table
CREATE TABLE IF NOT EXISTS ai_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  api_url TEXT NOT NULL DEFAULT 'https://token-plan-cn.xiaomimimo.com/v1/chat/completions',
  api_key TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'mimo-v2.5',
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert default (disabled)
INSERT OR IGNORE INTO ai_settings (id, enabled) VALUES (1, 0);
