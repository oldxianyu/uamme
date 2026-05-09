import { Hono } from 'hono';
import { dbGet, dbAll, dbInsert, dbRun } from '../db/index';
import { authMiddleware } from '../middleware/auth';

export const authRoutes = new Hono();

// ===== Password hashing (Web Crypto API, Cloudflare Workers compatible) =====

// Generate a salted hash using PBKDF2 (Workers-compatible, no bcrypt needed)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  // Format: iterations:hex(salt):hex(hash)
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:100000:${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Support our PBKDF2 format
  if (storedHash.startsWith('pbkdf2:')) {
    const [, iterations, saltHex, expectedHash] = storedHash.split(':');
    const encoder = new TextEncoder();
    const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const hash = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: parseInt(iterations), hash: 'SHA-256' },
      keyMaterial, 256
    );
    const computedHash = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    return timingSafeEqual(computedHash, expectedHash);
  }

  // Legacy SHA-256 (no salt — insecure, migrate away)
  if (storedHash.startsWith('sha256:')) {
    const inputHash = await sha256(password);
    return timingSafeEqual(inputHash, storedHash.slice(7));
  }

  return false;
}

async function sha256(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// ===== Login rate limiting (simple in-memory, per-IP) =====
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 }); // 15 min window
    return true;
  }
  if (record.count >= 5) return false; // 5 attempts per 15 min
  record.count++;
  return true;
}

// ===== Routes =====

// Login
authRoutes.post('/login', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';

  if (!checkRateLimit(ip)) {
    return c.json({ error: '登录尝试过于频繁，请 15 分钟后重试' }, 429);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求格式错误' }, 400);
  }

  const { username, password } = body;

  if (!username || !password) {
    return c.json({ error: '请输入用户名和密码' }, 400);
  }

  if (typeof username !== 'string' || typeof password !== 'string') {
    return c.json({ error: '参数类型错误' }, 400);
  }

  if (username.length > 50 || password.length > 128) {
    return c.json({ error: '输入过长' }, 400);
  }

  const user = await dbGet<{ id: number; username: string; password_hash: string; display_name: string }>(
    c.env.DB,
    'SELECT id, username, password_hash, display_name FROM users WHERE username = ?',
    username
  );

  // Use same error message for both cases to prevent user enumeration
  if (!user) {
    return c.json({ error: '用户名或密码错误' }, 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return c.json({ error: '用户名或密码错误' }, 401);
  }

  // Create session
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await dbInsert(
    c.env.DB,
    'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
    user.id, token, expiresAt
  );

  return c.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
    },
  });
});

// Logout
authRoutes.post('/logout', authMiddleware, async (c) => {
  const token = c.req.header('Authorization')?.slice(7) || '';
  if (token) {
    await dbRun(c.env.DB, 'DELETE FROM sessions WHERE token = ?', token);
  }
  return c.json({ ok: true });
});

// Get current user
authRoutes.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const user = await dbGet<{ id: number; username: string; display_name: string; avatar_url: string }>(
    c.env.DB,
    'SELECT id, username, display_name, avatar_url FROM users WHERE id = ?',
    userId
  );

  if (!user) {
    return c.json({ error: '用户不存在' }, 404);
  }

  return c.json({ user });
});

// Change password (for logged-in users)
authRoutes.post('/change-password', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const { oldPassword, newPassword } = await c.req.json();

  if (!oldPassword || !newPassword) {
    return c.json({ error: '请输入旧密码和新密码' }, 400);
  }

  if (newPassword.length < 6) {
    return c.json({ error: '新密码至少 6 位' }, 400);
  }

  const user = await dbGet<{ id: number; password_hash: string }>(
    c.env.DB,
    'SELECT id, password_hash FROM users WHERE id = ?',
    userId
  );

  if (!user || !(await verifyPassword(oldPassword, user.password_hash))) {
    return c.json({ error: '旧密码错误' }, 401);
  }

  const newHash = await hashPassword(newPassword);
  await dbRun(c.env.DB, 'UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?', newHash, userId);

  return c.json({ ok: true });
});

// ===== User management (admin only) =====

// List all users (admin only)
authRoutes.get('/users', authMiddleware, async (c) => {
  const userId = c.get('userId');
  // Check if user is admin (id=1)
  const admin = await dbGet<{ id: number }>(c.env.DB, 'SELECT id FROM users WHERE id = 1');
  if (!admin || admin.id !== userId) {
    return c.json({ error: '无权操作' }, 403);
  }

  const users = await dbAll<{ id: number; username: string; display_name: string; created_at: string }>(c.env.DB, 'SELECT id, username, display_name, created_at FROM users ORDER BY id');
  return c.json({ users });
});

// Create user (admin only)
authRoutes.post('/users', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const admin = await dbGet<{ id: number }>(c.env.DB, 'SELECT id FROM users WHERE id = 1');
  if (!admin || admin.id !== userId) {
    return c.json({ error: '无权操作' }, 403);
  }

  const { username, password, display_name } = await c.req.json();
  if (!username || !password) {
    return c.json({ error: '用户名和密码必填' }, 400);
  }
  if (username.length < 3 || username.length > 30) {
    return c.json({ error: '用户名 3-30 位' }, 400);
  }
  if (password.length < 6) {
    return c.json({ error: '密码至少 6 位' }, 400);
  }

  // Check duplicate
  const existing = await dbGet<{ id: number }>(c.env.DB, 'SELECT id FROM users WHERE username = ?', username)
  if (existing) {
    return c.json({ error: '用户名已存在' }, 400);
  }

  const hash = await hashPassword(password);
  await dbInsert(c.env.DB, 'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)', username, hash, display_name || username);

  return c.json({ ok: true });
});

// Delete user (admin only, cannot delete self)
authRoutes.delete('/users/:id', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const admin = await dbGet<{ id: number }>(c.env.DB, 'SELECT id FROM users WHERE id = 1');
  if (!admin || admin.id !== userId) {
    return c.json({ error: '无权操作' }, 403);
  }

  const targetId = parseInt(c.req.param('id'));
  if (targetId === 1) {
    return c.json({ error: '不能删除管理员' }, 400);
  }

  await dbRun(c.env.DB, 'DELETE FROM users WHERE id = ?', targetId);
  return c.json({ ok: true });
});
