-- Seed data for UAMME
-- Admin user: xianyu / xianyu
-- Password hash generated with PBKDF2-SHA256, 100000 iterations

-- Delete existing admin if any
DELETE FROM users WHERE username = 'xianyu';

-- Insert admin with proper PBKDF2 hash
INSERT INTO users (id, username, password_hash, display_name) VALUES
  (1, 'xianyu', 'pbkdf2:100000:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6:78d6845fee2bdf06e200ebd5ce3a93013319d4457200299f0aa78f84eedc410f', '管理员');

-- Demo webhook (test only)
INSERT INTO webhook_configs (user_id, name, webhook_url, description, is_active) VALUES
  (1, '测试群机器人', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=demo-key', '用于测试推送', 1);

-- Demo templates
INSERT INTO message_templates (user_id, name, format, content, description) VALUES
  (1, '纯文本模板', 'text', '{{title}}

{{body}}', '简单文本推送'),
  (1, 'Markdown模板', 'markdown', '# {{title}}

> {{body}}', 'Markdown格式推送');
