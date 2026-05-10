-- Add agent fields to ai_settings
ALTER TABLE ai_settings ADD COLUMN agent_url TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_settings ADD COLUMN agent_key TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_settings ADD COLUMN agent_enabled INTEGER NOT NULL DEFAULT 0;
