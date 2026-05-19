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
  return [
    msg.role,
    (msg.content || '').length.toString(),
    (msg.reasoning_content || '').length.toString()
  ].join(',');
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
  hit: boolean;
  hitLength: number;
  hitTokens: number;
  missTokens: number;
}

// ---- In-memory LRU cache (simulates disk cache metrics) ----
const MAX_KEYS = 10_000;

export class DiskCache {
  private map = new LruMap<string, CacheEntry>(MAX_KEYS);

  /** Checks the longest prefix match. Touches the entry on hit to update LRU order. */
  getHit(messages: ChatMessage[], tools?: Tool[]): CacheHitResult {
    const n = messages.length;

    const { total: totalTokens } = countRequestTokens(messages, tools);
    if (n <= 1) return { hit: false, hitLength: 0, hitTokens: 0, missTokens: totalTokens  };

    for (let i = n; i >= 1; i--) {
      const key = this.buildKey(messages, i, tools);
      if (this.map.has(key)) {
        this.map.touch(key);
        const { total: hitTokens } = countRequestTokens(messages.slice(0, i), tools);
        const missTokens = totalTokens - hitTokens;
        return { hit: true, hitLength: i, hitTokens, missTokens };
      }
    }

    return { hit: false, hitLength: 0, hitTokens: 0, missTokens: totalTokens  };
  }

  /** Stores the full message list as a cache endpoint (no-op if key already exists). */
  persistEndpoints(messages: ChatMessage[], tools?: Tool[]): void {
    const n = messages.length;
    if (n <= 1) return;
    const key = this.buildKey(messages, n, tools);
    if (!this.map.has(key)) {
      const { total: tokens } = countRequestTokens(messages, tools);
      this.map.set(key, { tokens });
      serverLogger.info(`[CACHE] persist key=${key} tokens=${tokens}`);
    }
  }

  /** Builds `"<n>:<djb2(fingerprints)>"`. */
  private buildKey(messages: ChatMessage[], n: number, tools?: Tool[]): string {
    let combined = '';
    const tfp = toolsFingerprint(tools);
    if (tfp) {
      combined += ',' + tfp;
    }
    for (let i = 0; i < n; i++) {
      if (i > 0) combined += ',';
      combined += msgFingerprint(messages[i]);
    }
    return `${n}:${djb2(combined)}`;
  }
}
