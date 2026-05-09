-- 0004: Add scheduled_tasks table for periodic push scheduling
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  template_id INTEGER NOT NULL,
  webhook_id INTEGER NOT NULL,
  source_id INTEGER,
  cron_expr TEXT NOT NULL DEFAULT '',
  interval_minutes INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  next_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS schedule_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  run_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES scheduled_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON scheduled_tasks(enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user ON scheduled_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_runs_task ON schedule_runs(task_id, run_at);
