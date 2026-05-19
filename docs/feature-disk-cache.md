# Disk Cache（磁盘缓存模拟）

> 模拟 OpenAI Prompt Caching 的内存缓存实现

## 概述

`mock-disk-cache.ts` 使用**内存 LRU 缓存**来模拟 OpenAI 的磁盘缓存行为。虽然不是真正的磁盘持久化，但在内存中模拟了相同的缓存命中/未命中逻辑和统计指标，使开发者可以在开发环境中测试缓存相关功能。

## 核心数据结构

### LruMap (`src/utils/lru-map.ts`)

基于 JavaScript 原生 `Map` 的 LRU（最近最少使用）缓存实现。

```
Map 迭代顺序 = 插入顺序
  → 最早插入的在最前（LRU）
  → 最新插入/访问的在最后（MRU）
```

**核心操作**:
| 操作 | 逻辑 |
|------|------|
| `get(key)` | 直接读取，**不更新 LRU 顺序** |
| `touch(key)` | 删除后重新插入，将 key 移到末尾（标记为最近使用） |
| `set(key, value)` | 如果 key 已存在则删除重建；如果达到上限则删除最旧的 key（迭代器的第一个） |
| `delete(key)` | 从 Map 中移除 |

**LRU 淘汰**: 当 `size >= max` 时，`set()` 删除 `map.keys().next().value`（即最旧、最少使用的 key）。

**复杂度**: 所有操作 **O(1)**（Map 的插入/删除操作）。

### DiskCache (`src/services/mock-disk-cache.ts`)

| 属性 | 值 |
|------|-----|
| 最大键数 | 10,000 |
| 缓存键格式 | `"<N>:<djb2-hash>"` |
| 哈希算法 | djb2 (Bernstein hash) |
| 缓存条目 | `{ tokens: number }` |

## 缓存键生成

### 消息指纹 (Fingerprint)

为了节省内存，缓存键**不是**基于消息原文，而是基于轻量级指纹：

```
msgFingerprint(msg) = role + "," + content.length + "," + reasoning_content.length
```

```typescript
function msgFingerprint(msg: ChatMessage): string {
  return [
    msg.role,
    (msg.content || '').length.toString(),
    (msg.reasoning_content || '').length.toString()
  ].join(',');
}
```

**为什么用长度而不是内容？**
- 长度占用固定字节，内存开销极小
- 对于开发/测试场景，相同 role + 相同长度已足够模拟缓存行为
- 完整内容哈希会导致大量内存占用，偏离"轻量模拟"的目标

### 工具指纹

```
toolsFingerprint(tools) = tool1.name + "," + tool2.name + ",..."
```

### 完整缓存键

```typescript
buildKey(messages, n, tools) = `${n}:${djb2(msgFingerprint[0..n-1] + toolsFingerprint)}`
```

示例：`"3:a1b2c3d4"` 表示 3 条消息的缓存，指纹哈希值为 `a1b2c3d4`。

### djb2 哈希算法 (Bernstein hash)

```typescript
function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;  // 强制 32 位整数
  }
  return (hash >>> 0).toString(16);  // 无符号十六进制
}
```

- 初始值: `5381`
- 每次迭代: `hash = hash * 33 + charCode`
- 输出: 32 位无符号整数的 16 进制字符串（最多 8 字符）

## 缓存查找逻辑 (最长前缀匹配)

```
getHit(messages, tools):
  for i = N  downto 1:       // 从最长前缀开始匹配
    if buildKey(messages, i) 命中:
      return hit(i)
  return miss
```

- **从最长前缀开始匹配**（消息数量 N → 1）
- **命中即返回**，保证找到的是最长的匹配前缀
- **命中时 touch key**，更新 LRU 顺序
- **单条消息 (N <= 1)** 不缓存（返回 miss）

## 缓存写入

```
persistEndpoints(messages, tools):
  if N <= 1: return          // 单条不缓存
  if key 不存在:
    计算 token 数并存入 LruMap
    日志记录: [CACHE] persist key=xxx tokens=xxx
```

每次 Chat Completion 请求处理完成后，调用 `persistEndpoints` 将完整消息列表存入缓存。

## 缓存命中结果

```typescript
interface CacheHitResult {
  hit: boolean;        // 是否命中
  hitLength: number;   // 匹配的消息数量（前缀长度）
  hitTokens: number;   // 缓存命中的 token 数
  missTokens: number;  // 未命中的 token 数
}
```

- `missTokens = totalTokens - hitTokens`（只有超出缓存前缀的部分算 miss）

## 完整的请求生命周期

```
请求到达 → handleChatCompletion()
  ├─ 1. countRequestTokens(messages)       → 计算总 input tokens
  ├─ 2. diskCache.getHit(messages)         → 查找最长缓存前缀（输入缓存）
  ├─ 3. diskCache.persistEndpoints()       → 输入缓存落盘
  ├─ 4. 生成模型输出 (outputContent, outputReasoning, toolCalls)
  ├─ 5. diskCache.persistOutputCache(...)  → 输出缓存落盘（输入 + 输出）
  ├─ 6. buildUsage(..., hit, miss)         → 构造用量统计
  │     ├─ prompt_cache_hit_tokens         = hitTokens
  │     └─ prompt_cache_miss_tokens        = missTokens
  └─ 7. 返回响应（含 usage 字段）
```

**注意**:
1. `getHit` 在 `persistEndpoints` 之前调用，因为当前请求不能立即命中自己
2. 输出缓存在模型输出**生成后**落盘，用于后续请求命中完整的对话轮次

## 时序图

```
请求 A (1条消息)                  请求 B (同1条消息 + 助手回复 + 新消息)
    │                                       │
    ├─ getHit → miss                        ├─ getHit → 检查前缀
    │  (缓存为空)                           │   ├─ "2:..." (含assistant) → HIT! (输出缓存)
    ├─ persistEndpoints                     │   └─ 匹配前缀长度=2
    │  (存储 key="1:xxx")                   ├─ persistEndpoints
    ├─ 生成 output                          │   (存储 key="3:xxx")
    ├─ persistOutputCache                   ├─ persistOutputCache
    │  (存储 key="2:xxx")                   │   (存储 key="4:xxx")
    └─ 返回响应                             └─ 返回响应
                                              usage: hit=2条消息的token
```

## 与其他模块的关系

```
controllers/chat.ts
  └── DiskCache ──→ LruMap (utils/lru-map.ts)
         │
         ├── getHit()                   → 输入缓存前缀匹配
         ├── persistEndpoints()         → 输入缓存落盘
         ├── persistOutputCache()       → 输出缓存落盘（输入 + 输出）
         ├── countRequestTokens (utils/helpers.ts)
         │     └── countTokens (english=0.3, chinese=0.6)
         │
         └── serverLogger (utils/logger.ts → logs/server.log)
```

## 性能特性

| 操作 | 复杂度 | 说明 |
|------|--------|------|
| `getHit()` | O(N) N=消息数 | 最多 N 次哈希 + N 次 Map.has() |
| `persistEndpoints()` | O(1) | 一次哈希 + 一次 Map.set() |
| `persistOutputCache()` | O(1) | 构建 assistant 消息 + 一次哈希 + 一次 Map.set() |
| `LruMap.get/has/touch` | O(1) | 基于 Map |
| `LruMap.set` | O(1) | 可能触发 LRU 淘汰 |
| 内存上限 | 10,000 条目 | 每个条目约几十字节 |

## 局限

1. **不是真正的磁盘缓存** — 数据在进程重启后丢失
2. **指纹而非原文** — 可能产生哈希碰撞（但模拟场景下可接受）
3. **单例模式** — DiskCache 在 `controllers/chat.ts` 中作为模块级变量，全应用共享
4. **无 TTL（过期时间）** — 仅通过 LRU 淘汰，不会自动过期
