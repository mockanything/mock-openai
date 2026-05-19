/**
 * 在内存中模拟 OpenAI 的 Prompt 缓存。
 *
 * 缓存键: `"N:<djb2-hash>"`，其中 N = 消息数量，哈希值基于轻量级指纹
 * （role + content 长度 + 其他可选字段长度）计算，而非原始文本，以降低内存占用。
 *
 * 从最长前缀到最短前缀逐级探测，返回最长匹配项。
 * 缓存条目存储在 LruMap 中（上限 1 万条，O(1) LRU 淘汰）。
 */

import { ChatMessage, Tool, ToolCall } from '../types/openai.js';
import { serverLogger } from '../utils/logger.js';
import { countRequestTokens } from '../utils/helpers.js';
import { LruMap } from '../utils/lru-map.js';

// ---- djb2 哈希 (Bernstein) ----
function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0).toString(16);
}

// 指纹: 取 role + 各可变长字段的长度，避免在键中存放完整文本
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

// ---- 缓存条目 / 结果类型 ----
export interface CacheEntry {
  tokens: number;
}

export interface CacheHitResult {
  hit: boolean;
  hitLength: number;
  hitTokens: number;
  missTokens: number;
}

// ---- 内存 LRU 缓存（模拟磁盘缓存指标） ----
const MAX_KEYS = 10_000;

export class DiskCache {
  private map = new LruMap<string, CacheEntry>(MAX_KEYS);

  /** 检查最长前缀匹配。命中时 touch 该条目以更新 LRU 顺序。 */
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

  /** 将完整消息列表作为缓存端点存储（key 已存在时不做任何操作）。 */
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

  /** 将输入消息 + 模型输出作为一个整体缓存单元存储。
   *  后续请求的前缀若包含完整的对话（输入 + 助手回复），即可命中此缓存。
   */
  persistOutputCache(
    messages: ChatMessage[],
    outputContent: string,
    outputReasoning: string,
    toolCalls: ToolCall[],
    tools?: Tool[],
  ): void {
    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: outputContent,
      reasoning_content: outputReasoning || undefined,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    };

    const allMessages = [...messages, assistantMsg];
    const n = allMessages.length;
    if (n <= 1) return;

    const key = this.buildKey(allMessages, n, tools);
    if (!this.map.has(key)) {
      const { total: tokens } = countRequestTokens(allMessages, tools);
      this.map.set(key, { tokens });
      serverLogger.info(`[CACHE-OUTPUT] persist key=${key} tokens=${tokens}`);
    }
  }

  /** 构建 `"<n>:<djb2(指纹)>"` 格式的缓存键。 */
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
