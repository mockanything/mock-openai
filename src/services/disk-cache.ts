import { ChatMessage, Tool } from '../types/openai.js';
import { serverLogger } from './logger.js';

export function countTokens(text: string): number {
  let eng = 0;
  let chn = 0;
  for (const ch of text) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) {
      chn++;
    } else if (/\S/.test(ch)) {
      eng++;
    }
  }
  return Math.ceil(eng * 0.3 + chn * 0.6);
}

export function countRequestTokens(messages: ChatMessage[], tools?: Tool[]): number {
  let total = 0;
  for (const msg of messages) {
    total += countTokens(msg.content || '');
    total += countTokens(msg.reasoning_content || '');
    if (msg.tool_calls) {
      total += countTokens(JSON.stringify(msg.tool_calls));
    }
  }
  if (tools) {
    total += countTokens(JSON.stringify(tools));
  }
  return total;
}

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

export interface CacheEntry {
  prefix: string;
  content: string | null;
  hitCount: number;
  createdAt: number;
  lastAccess: number;
  source: 'end_position' | 'common_prefix';
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

export class DiskCache {
  private map = new Map<string, CacheEntry>();
  private seenPrefixes = new Set<string>();

  getHit(messages: ChatMessage[], tools?: Tool[]): CacheCheckResult {
    const n = messages.length;

    const fullKey = this.buildKey(messages, n);
    if (this.map.has(fullKey)) {
      const entry = this.map.get(fullKey)!;
      entry.hitCount++;
      entry.lastAccess = Date.now();
      const allTokens = countRequestTokens(messages, tools);
      return { hit: true, entry, hitLength: n, hitTokens: allTokens, missTokens: 0 };
    }

    for (let i = n - 1; i >= 1; i--) {
      const key = this.buildKey(messages, i);
      if (this.map.has(key)) {
        const entry = this.map.get(key)!;
        entry.hitCount++;
        entry.lastAccess = Date.now();
        const hitTokens = countRequestTokens(messages.slice(0, i));
        const missTokens = countRequestTokens(messages.slice(i), tools);
        return { hit: true, entry, hitLength: i, hitTokens, missTokens };
      }
    }

    return { hit: false };
  }

  persistEndPositions(messages: ChatMessage[], responseContent: string): void {
    const n = messages.length;

    const inputKey = this.buildKey(messages, n);
    if (!this.map.has(inputKey)) {
      this.map.set(inputKey, {
        prefix: messages.map(m => m.content || '').join('||'),
        content: responseContent,
        hitCount: 0,
        createdAt: Date.now(),
        lastAccess: Date.now(),
        source: 'end_position',
      });
      serverLogger.info(`[${new Date().toISOString()}] [CACHE] persist input_end key=${inputKey}`);
    }

    const responseMsg: ChatMessage = { role: 'assistant', content: responseContent };
    const fullMessages = [...messages, responseMsg];
    const fullKey = this.buildKey(fullMessages, n + 1);
    if (!this.map.has(fullKey)) {
      this.map.set(fullKey, {
        prefix: [...messages.map(m => m.content || ''), responseContent].join('||'),
        content: null,
        hitCount: 0,
        createdAt: Date.now(),
        lastAccess: Date.now(),
        source: 'end_position',
      });
      serverLogger.info(`[${new Date().toISOString()}] [CACHE] persist output_end key=${fullKey}`);
    }
  }

  detectCommonPrefix(messages: ChatMessage[], responseContent: string): void {
    const n = messages.length;

    for (let i = 1; i <= n; i++) {
      const key = this.buildKey(messages, i);

      if (this.seenPrefixes.has(key) && !this.map.has(key)) {
        this.map.set(key, {
          prefix: messages.slice(0, i).map(m => m.content || '').join('||'),
          content: responseContent,
          hitCount: 0,
          createdAt: Date.now(),
          lastAccess: Date.now(),
          source: 'common_prefix',
        });
        serverLogger.info(`[${new Date().toISOString()}] [CACHE] persist common_prefix key=${key}`);
      }

      this.seenPrefixes.add(key);
    }
  }

  private buildKey(messages: ChatMessage[], n: number): string {
    return `${n}:${buildPrefixHash(messages, n)}`;
  }
}
