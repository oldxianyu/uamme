-- 全局 Browserless 配置
ALTER TABLE ai_settings ADD COLUMN browserless_token TEXT DEFAULT '';
ALTER TABLE ai_settings ADD COLUMN browserless_url TEXT DEFAULT 'https://chrome.browserless.io/content';
