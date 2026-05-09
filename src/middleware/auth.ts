import { Context, Next } from 'hono';
import { dbGet } from '../db/index';

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  const cookie = c.req.header('Cookie');

  let token: string | null = null;

  // Try Authorization header first
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Try cookie
  if (!token && cookie) {
    const match = cookie.match(/session_token=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) {
    return c.json({ error: '未登录' }, 401);
  }

  // Validate token format (hex string, 64 chars)
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return c.json({ error: '登录凭证无效' }, 401);
  }

  try {
    // Validate session
    const session = await dbGet<{ user_id: number }>(
      c.env.DB,
      'SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime("now")',
      token
    );

    if (!session) {
      return c.json({ error: '登录已过期' }, 401);
    }

    // Set user_id in context
    c.set('userId', session.user_id);
    await next();
  } catch (err: any) {
    console.error('Auth middleware error:', err);
    return c.json({ error: '认证服务异常' }, 500);
  }
}
