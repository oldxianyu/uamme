-- Seed data for UAMME
-- Admin user: admin / admin123
-- Password hash generated with PBKDF2-SHA256, 100000 iterations
-- Hash: pbkdf2:100000:<salt>:<hash>

-- Delete existing admin if any
DELETE FROM users WHERE username = 'admin';

-- Insert admin with proper PBKDF2 hash
-- This hash was generated from "admin123" using the auth.ts hashPassword function
INSERT INTO users (id, username, password_hash, display_name) VALUES
  (1, 'admin', 'pbkdf2:100000:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6:212117de3526e58ba8d73e4406c9a40fc39c36a9eec9d5638628c06cc307c0f9', '管理员');

-- Demo webhook (test only)
INSERT INTO webhook_configs (user_id, name, webhook_url, description, is_active) VALUES
  (1, '测试群机器人', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=demo-key', '用于测试推送', 1);

-- Demo templates
INSERT INTO message_templates (user_id, name, format, content, description) VALUES
  (1, '纯文本模板', 'text', '{{title}}

{{body}}', '简单文本推送'),
  (1, 'Markdown模板', 'markdown', '# {{title}}

> {{body}}', 'Markdown格式推送');
