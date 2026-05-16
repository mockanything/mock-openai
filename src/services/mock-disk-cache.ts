import { ChatMessage, Tool } from '../types/openai.js';
import { serverLogger } from '../utils/logger.js';
import { countTokens, countMessageTokens } from '../utils/helpers.js';

export function countRequestTokens(messages: ChatMessage[], tools?: Tool[]): number {
  let total = 0;
  for (const msg of messages) {
    total += countMessageTokens(msg);
  }
  if (tools) {
    total += countTokens(JSON.stringify(tools));
  }
  return total;
}

// ---- Hash Functions ----
// Cache key format: "N:<hex>" where N = message count, hex = djb2 combined hash.

function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0).toString(16);
}

function hashMessage(msg: ChatMessage): string {
  const parts = [msg.role, msg.content || ''];
  if (msg.reasoning_content) parts.push(msg.reasoning_content);
  if (msg.tool_calls) parts.push(JSON.stringify(msg.tool_calls));
  return djb2(parts.join('|'));
}

function buildPrefixHash(messages: ChatMessage[], n: number): string {
  let combined = '';
  for (let i = 0; i < n; i++) {
    if (i > 0) combined += '||';
    combined += hashMessage(messages[i]);
  }
  return djb2(combined);
}

// ---- Cache Entry Types ----

export interface CacheEntry {
  prefix: string;
  createdAt: number;
  lastAccess: number;
  source: 'end_position';
}

export interface CacheHitResult {
  hit: true;
  entry: CacheEntry;
  hitLength: number;
  hitTokens: number;
  missTokens: number;
}

export interface CacheMissResult {
  hit: false;
}

export type CacheCheckResult = CacheHitResult | CacheMissResult;

// ---- Disk Cache Simulation ----
// In-memory prefix cache simulation (no actual disk I/O).

export class DiskCache {
  private map = new Map<string, CacheEntry>();

  getHit(messages: ChatMessage[], tools?: Tool[]): CacheCheckResult {
    const n = messages.length;

    for (let i = n; i >= 1; i--) {
      const key = this.buildKey(messages, i);
      if (this.map.has(key)) {
        const entry = this.map.get(key)!;
        entry.lastAccess = Date.now();
        const hitTokens = countRequestTokens(messages.slice(0, i), i === n ? tools : undefined);
        const missTokens = i === n ? 0 : countRequestTokens(messages.slice(i), tools);
        return { hit: true, entry, hitLength: i, hitTokens, missTokens };
      }
    }

    return { hit: false };
  }

  persistEndpoints(messages: ChatMessage[]): void {
    const n = messages.length;
    const key = this.buildKey(messages, n);
    if (!this.map.has(key)) {
      this.map.set(key, {
        prefix: messages.map(m => m.content || '').join('||'),
        createdAt: Date.now(),
        lastAccess: Date.now(),
        source: 'end_position',
      });
      serverLogger.info(`[${new Date().toISOString()}] [CACHE] persist key=${key}`);
    }
  }

  private buildKey(messages: ChatMessage[], n: number): string {
    return `${n}:${buildPrefixHash(messages, n)}`;
  }
}
