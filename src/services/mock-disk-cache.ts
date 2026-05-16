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

// 对单条消息哈希：role + content + reasoning_content + tool_calls
function hashMessage(msg: ChatMessage): string {
  const parts = [msg.role, msg.content || ''];
  if (msg.reasoning_content) parts.push(msg.reasoning_content);
  if (msg.tool_calls) parts.push(JSON.stringify(msg.tool_calls));
  return djb2(parts.join('|'));
}

// 对前 N 条消息做组合哈希，作为缓存前缀单元的指纹
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
  tokens: number;   // 缓存前缀包含的 token 数
}

export interface CacheHitResult {
  hit: true;
  entry: CacheEntry;
  hitLength: number;   // 命中的消息条数
  hitTokens: number;   // 命中部分的 token 数
  missTokens: number;  // 未命中部分的 token 数
}

export interface CacheMissResult {
  hit: false;
}

export type CacheCheckResult = CacheHitResult | CacheMissResult;

// ---- 缓存模拟 ----
// 纯内存实现，无实际磁盘 I/O。
// 淘汰策略：LRU，利用 Map 的插入顺序特性，O(1) 无遍历。

const MAX_KEYS = 10_000;

export class DiskCache {
  // map 的插入顺序即 LRU 顺序：越靠前越久未访问
  private map = new Map<string, CacheEntry>();

  // 将 key 提升到最近使用位置（delete + re-set 移到 map 末尾）
  private touch(key: string): void {
    const entry = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, entry);
  }

  // 查找缓存命中：从完整匹配 N 条开始，递减到 1 条前缀匹配
  getHit(messages: ChatMessage[], tools?: Tool[]): CacheCheckResult {
    const n = messages.length;

    for (let i = n; i >= 1; i--) {
      const key = this.buildKey(messages, i);
      if (this.map.has(key)) {
        this.touch(key);
        const entry = this.map.get(key)!;
        // 全匹配时 tools 算命中，前缀匹配时 tools 算未命中
        const hitTokens = countRequestTokens(messages.slice(0, i), i === n ? tools : undefined);
        const missTokens = i === n ? 0 : countRequestTokens(messages.slice(i), tools);
        return { hit: true, entry, hitLength: i, hitTokens, missTokens };
      }
    }

    return { hit: false };
  }

  // 请求结束后，将当前 messages 作为缓存单元落盘
  persistEndpoints(messages: ChatMessage[]): void {
    const n = messages.length;
    const key = this.buildKey(messages, n);
    if (!this.map.has(key)) {
      // 超出容量时淘汰最久未访问的条目（map 第一个 key）
      if (this.map.size >= MAX_KEYS) {
        const lruKey = this.map.keys().next().value!;
        this.map.delete(lruKey);
      }
      this.map.set(key, { tokens: countRequestTokens(messages) });
      serverLogger.info(`[${new Date().toISOString()}] [CACHE] persist key=${key}`);
    }
  }

  // 构建缓存 key："消息数:前缀哈希"
  private buildKey(messages: ChatMessage[], n: number): string {
    return `${n}:${buildPrefixHash(messages, n)}`;
  }
}
