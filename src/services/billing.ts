import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const getDirname = () => {
  if (typeof __dirname !== 'undefined') return __dirname;
  return dirname(fileURLToPath(import.meta.url));
};

const DB_PATH = join(getDirname(), '../../data/billing.db');

export interface BillingRecord {
  api_key: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_cache_hit_tokens: number;
  prompt_cache_miss_tokens: number;
  reasoning_tokens: number;
  content_tokens: number;
  stream: boolean;
}

export interface BillingSummary {
  api_key: string;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_requests: number;
  start_date: string;
  end_date: string;
  details: Array<{
    model: string;
    requests: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  }>;
}

let db: Database.Database;

export function initBilling(): void {
  const dataDir = join(getDirname(), '../../data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS billing_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_tokens INTEGER NOT NULL,
      completion_tokens INTEGER NOT NULL,
      total_tokens INTEGER NOT NULL,
      prompt_cache_hit_tokens INTEGER DEFAULT 0,
      prompt_cache_miss_tokens INTEGER DEFAULT 0,
      reasoning_tokens INTEGER DEFAULT 0,
      content_tokens INTEGER DEFAULT 0,
      stream INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_billing_api_key ON billing_logs(api_key)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_billing_created_at ON billing_logs(created_at)');
}

export function recordBilling(record: BillingRecord): void {
  const stmt = db.prepare(`
    INSERT INTO billing_logs (api_key, model, prompt_tokens, completion_tokens, total_tokens,
      prompt_cache_hit_tokens, prompt_cache_miss_tokens, reasoning_tokens, content_tokens, stream)
    VALUES (@api_key, @model, @prompt_tokens, @completion_tokens, @total_tokens,
      @prompt_cache_hit_tokens, @prompt_cache_miss_tokens, @reasoning_tokens, @content_tokens, @stream)
  `);
  stmt.run({ ...record, stream: record.stream ? 1 : 0 });
}

export function queryBilling(apiKey: string, startDate?: string, endDate?: string): BillingSummary {
  let where = 'WHERE api_key = ?';
  const params: unknown[] = [apiKey];

  if (startDate) {
    where += ' AND created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    where += ' AND created_at <= ?';
    params.push(endDate);
  }

  const summaryRow = db.prepare(`
    SELECT
      COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
      COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      COUNT(*) as total_requests
    FROM billing_logs ${where}
  `).get(...params) as { total_prompt_tokens: number; total_completion_tokens: number; total_tokens: number; total_requests: number };

  const details = db.prepare(`
    SELECT
      model,
      COUNT(*) as requests,
      SUM(prompt_tokens) as prompt_tokens,
      SUM(completion_tokens) as completion_tokens,
      SUM(total_tokens) as total_tokens
    FROM billing_logs ${where}
    GROUP BY model
    ORDER BY total_tokens DESC
  `).all(...params) as Array<{
    model: string; requests: number; prompt_tokens: number; completion_tokens: number; total_tokens: number;
  }>;

  return {
    api_key: apiKey,
    total_prompt_tokens: summaryRow.total_prompt_tokens,
    total_completion_tokens: summaryRow.total_completion_tokens,
    total_tokens: summaryRow.total_tokens,
    total_requests: summaryRow.total_requests,
    start_date: startDate || 'all',
    end_date: endDate || 'all',
    details,
  };
}
