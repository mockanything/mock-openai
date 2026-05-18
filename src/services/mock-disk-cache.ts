/**
 * Simulates OpenAI prompt caching in-memory.
 *
 * Cache key: `"N:<djb2-hash>"` where N = message count and the hash is
 * taken over a lightweight fingerprint (role + content-length + optional
 * field lengths) rather than raw text, keeping memory usage low.
 *
 * Probes prefixes from longest to shortest, returning the longest match.
 * Entries are stored in an LruMap (10k max, O(1) LRU eviction).
 */

import { ChatMessage, Tool } from '../types/openai.js';
import { serverLogger } from '../utils/logger.js';
import { countRequestTokens } from '../utils/helpers.js';
import { LruMap } from '../utils/lru-map.js';

// ---- djb2 hash (Bernstein) ----

function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0).toString(16);
}

// Fingerprint: role + length of each variable-length field, avoiding full text in keys.
function msgFingerprint(msg: ChatMessage): string {
  const parts = [msg.role, (msg.content || '').length.toString()];
  if (msg.reasoning_content) parts.push(msg.reasoning_content.length.toString());
  return parts.join('|');
}

function toolsFingerprint(tools: Tool[] | undefined): string {
  if (!tools || tools.length === 0) return '';
  return tools.map(t => t.function.name).join(',');
}

// ---- Cache entry / result types ----

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

// ---- In-memory LRU cache (simulates disk cache metrics) ----

const MAX_KEYS = 10_000;

export class DiskCache {
  private map = new LruMap<string, CacheEntry>(MAX_KEYS);

  /** Checks the longest prefix match. Touches the entry on hit to update LRU order. */
  getHit(messages: ChatMessage[], tools?: Tool[]): CacheCheckResult {
    const n = messages.length;

    if (n <= 1) return { hit: false };

    for (let i = n; i >= 1; i--) {
      const key = this.buildKey(messages, i, tools);
      if (this.map.has(key)) {
        this.map.touch(key);
        const entry = this.map.get(key)!;
        const hitTokens = countRequestTokens(messages.slice(0, i), i === n ? tools : undefined).total;
        const missTokens = i === n ? 0 : countRequestTokens(messages.slice(i), tools).total;
        return { hit: true, entry, hitLength: i, hitTokens, missTokens };
      }
    }

    return { hit: false };
  }

  /** Stores the full message list as a cache endpoint (no-op if key already exists). */
  persistEndpoints(messages: ChatMessage[], tools?: Tool[]): void {
    const n = messages.length;
    if (n <= 1) return;
    const key = this.buildKey(messages, n, tools);
    if (!this.map.has(key)) {
      const tokens = countRequestTokens(messages, tools).total;
      this.map.set(key, { tokens });
      serverLogger.info(`[CACHE] persist key=${key} tokens=${tokens}`);
    }
  }

  /** Builds `"<n>:<djb2(fingerprints)>"`. */
  private buildKey(messages: ChatMessage[], n: number, tools?: Tool[]): string {
    let combined = '';
    for (let i = 0; i < n; i++) {
      if (i > 0) combined += '||';
      combined += msgFingerprint(messages[i]);
    }
    const tfp = toolsFingerprint(tools);
    if (tfp) combined += '||' + tfp;
    return `${n}:${djb2(combined)}`;
  }
}
