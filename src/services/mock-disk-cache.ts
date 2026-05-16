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

// ---- 哈希函数 ----
// 缓存 key 格式："N:<hex>"，N=消息数，hex=所有消息的 djb2 组合哈希。

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

// ---- 缓存条目类型 ----

export interface CacheEntry {
  tokens: number;
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

// ---- 缓存模拟 ----
// 纯内存实现，仅应用于单进程模式。
// 淘汰策略：LRU，利用 Map 的插入顺序特性，O(1) 无遍历。

const MAX_KEYS = 10_000;

export class DiskCache {
  private map = new Map<string, CacheEntry>();

  private touch(key: string): void {
    const entry = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, entry);
  }

  getHit(messages: ChatMessage[], tools?: Tool[]): CacheCheckResult {
    const n = messages.length;

    for (let i = n; i >= 1; i--) {
      const key = this.buildKey(messages, i);
      if (this.map.has(key)) {
        this.touch(key);
        const entry = this.map.get(key)!;
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
      this.evictIfFull();
      const tokens = countRequestTokens(messages);
      this.map.set(key, { tokens });
      serverLogger.info(`[${new Date().toISOString()}] [CACHE] persist key=${key} tokens=${tokens}`);
    }
  }

  private evictIfFull(): void {
    if (this.map.size >= MAX_KEYS) {
      const lruKey = this.map.keys().next().value!;
      this.map.delete(lruKey);
    }
  }

  private buildKey(messages: ChatMessage[], n: number): string {
    return `${n}:${buildPrefixHash(messages, n)}`;
  }
}
