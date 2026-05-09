// Database helper functions for Cloudflare D1

export interface User {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  avatar_url: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookConfig {
  id: number;
  user_id: number;
  name: string;
  webhook_url: string;
  is_active: number;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplate {
  id: number;
  user_id: number;
  name: string;
  format: string;
  content: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface ContentSource {
  id: number;
  user_id: number;
  name: string;
  source_type: string;
  source_url: string;
  keyword: string;
  is_active: number;
  fetch_interval: number;
  last_fetched_at: string | null;
  config: string;
  created_at: string;
  updated_at: string;
}

export interface CustomContent {
  id: number;
  user_id: number;
  title: string;
  body: string;
  template_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface PushLog {
  id: number;
  user_id: number;
  webhook_id: number;
  template_id: number | null;
  content_source_id: number | null;
  custom_content_id: number | null;
  title: string;
  body_preview: string;
  status: string;
  response_code: number | null;
  response_body: string;
  error_message: string;
  created_at: string;
}

export interface Session {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  created_at: string;
}

// Query helpers
export async function dbGet<T>(db: D1Database, sql: string, ...args: any[]): Promise<T | null> {
  const stmt = db.prepare(sql).bind(...args);
  return await stmt.first<T>() ?? null;
}

export async function dbAll<T>(db: D1Database, sql: string, ...args: any[]): Promise<T[]> {
  const stmt = db.prepare(sql).bind(...args);
  const result = await stmt.all<T>();
  return result.results ?? [];
}

export async function dbRun(db: D1Database, sql: string, ...args: any[]): Promise<D1Result> {
  const stmt = db.prepare(sql).bind(...args);
  return await stmt.run();
}

// Alias for dbRun (backward compatibility)
export const dbInsert = dbRun;

// Input validation helpers
export function validateId(id: string): number | null {
  const num = parseInt(id, 10);
  if (isNaN(num) || num <= 0 || !Number.isInteger(num)) return null;
  return num;
}

export function validateString(value: any, maxLength: number = 500): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export function validateUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
