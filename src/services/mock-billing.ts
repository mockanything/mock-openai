import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic, Statement } from 'sql.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';

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

let db: SqlJsDatabase;
let SQL: SqlJsStatic;

export async function initBilling(): Promise<void> {
  const dataDir = dirname(DB_PATH);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  SQL = await initSqlJs();

  let buffer: Buffer | undefined;
  try {
    buffer = readFileSync(DB_PATH);
  } catch {}

  db = new SQL.Database(buffer);
  db.run(`
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
  db.run('CREATE INDEX IF NOT EXISTS idx_billing_api_key ON billing_logs(api_key)');
  db.run('CREATE INDEX IF NOT EXISTS idx_billing_created_at ON billing_logs(created_at)');
  persist();
}

function persist(): void {
  const data = db.export();
  writeFileSync(DB_PATH, Buffer.from(data));
}

type SqlParam = number | string | null;

function queryAll<T>(sql: string, params: SqlParam[] = []): T[] {
  const stmt: Statement = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

function queryOne<T>(sql: string, params: SqlParam[] = []): T | null {
  const stmt: Statement = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject() as T;
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export function recordBilling(record: BillingRecord): void {
  db.run(
    `INSERT INTO billing_logs (api_key, model, prompt_tokens, completion_tokens, total_tokens,
      prompt_cache_hit_tokens, prompt_cache_miss_tokens, reasoning_tokens, content_tokens, stream)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.api_key,
      record.model,
      record.prompt_tokens,
      record.completion_tokens,
      record.total_tokens,
      record.prompt_cache_hit_tokens,
      record.prompt_cache_miss_tokens,
      record.reasoning_tokens,
      record.content_tokens,
      record.stream ? 1 : 0,
    ],
  );
  persist();
}

export function queryBilling(apiKey: string, startDate?: string, endDate?: string): BillingSummary {
  let where = 'WHERE api_key = ?';
  const params: SqlParam[] = [apiKey];

  if (startDate) {
    where += ' AND created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    where += ' AND created_at <= ?';
    params.push(endDate);
  }

  const summaryRow = queryOne<{
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_tokens: number;
    total_requests: number;
  }>(
    `SELECT
      COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
      COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      COUNT(*) as total_requests
    FROM billing_logs ${where}`,
    params,
  );

  const details = queryAll<{
    model: string; requests: number; prompt_tokens: number; completion_tokens: number; total_tokens: number;
  }>(
    `SELECT
      model,
      COUNT(*) as requests,
      SUM(prompt_tokens) as prompt_tokens,
      SUM(completion_tokens) as completion_tokens,
      SUM(total_tokens) as total_tokens
    FROM billing_logs ${where}
    GROUP BY model
    ORDER BY total_tokens DESC`,
    params,
  );

  return {
    api_key: apiKey,
    total_prompt_tokens: summaryRow?.total_prompt_tokens ?? 0,
    total_completion_tokens: summaryRow?.total_completion_tokens ?? 0,
    total_tokens: summaryRow?.total_tokens ?? 0,
    total_requests: summaryRow?.total_requests ?? 0,
    start_date: startDate || 'all',
    end_date: endDate || 'all',
    details,
  };
}
