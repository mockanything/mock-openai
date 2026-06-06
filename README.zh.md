# Mock OpenAI

> [English version](./README.md)

Mock OpenAI API 服务，用于开发和测试。

## 功能特性

- `/v1/chat/completions` — 聊天补全接口
- `/v1/models` — 模型列表
- `/v1/embeddings` — Embedding 向量接口
- 流式响应 (SSE)
- 工具/函数调用模拟
- 思维链 (reasoning_effort)
- Prompt 缓存模拟（输入 + 输出缓存）
- 按模型的速率限制 (flash 250/min, pro 50/min)
- 全局 10MB 请求体大小限制
- API 密钥鉴权（`sk-` 格式）
- 计费日志记录（SQLite）
- Benchmark 模型（`benchmark-v1-flash` / `benchmark-v1-pro`，100% 触发工具调用）

## 快速开始

```bash
npm install
npm run dev
```

## 配置

| 变量 | 默认值 | 说明 |
|----------|---------|------|
| PORT | 3000 | 服务端口 |
| DEFAULT_MODEL | apple-v1-flash | 默认聊天模型 |
| RATE_LIMIT_FLASH | 250 | Flash 模型每分钟请求数（每 API Key） |
| RATE_LIMIT_PRO | 50 | Pro 模型每分钟请求数（每 API Key） |
| RATE_LIMIT_MODELS | 100 | 模型列表接口每分钟请求数 |

## 鉴权

所有 API 端点需要 `Authorization: Bearer sk-...` 请求头。API Key 必须以 `sk-` 开头。

```bash
# 设置 API Key
export API_KEY="sk-your-api-key"
```

> 本项目仅做格式校验，不验证真实 key。

## API

### 模型列表

```bash
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer $API_KEY"
```

### 聊天补全

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

### 流式响应

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'
```

### 工具调用

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "messages": [{"role": "user", "content": "天气如何？"}],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "parameters": {
            "type": "object",
            "properties": {
              "location": { "type": "string" }
            }
          }
        }
      }
    ],
    "tool_choice": "required"
  }'
```

### 思维链 (Chain of Thought)

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "messages": [{"role": "user", "content": "你好"}],
    "reasoning_effort": "high"
  }'
```

### Embeddings

```bash
# 单条文本
curl -X POST http://localhost:3000/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "input": "你好，世界！",
    "model": "text-embedding-3-small"
  }'
```

```bash
# 批量输入
curl -X POST http://localhost:3000/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "input": ["你好", "世界"],
    "model": "text-embedding-3-large"
  }'
```

```bash
# 自定义维度
curl -X POST http://localhost:3000/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "input": "你好",
    "model": "text-embedding-3-small",
    "dimensions": 256
  }'
```

### 计费查询

```bash
curl "http://localhost:3000/v1/billing/usage?start_date=2026-01-01&end_date=2026-06-07" \
  -H "Authorization: Bearer $API_KEY"
```

### 健康检查

```bash
curl http://localhost:3000/health
```

## 脚本

- `npm run dev` — 开发模式（热重载）
- `npm run build` — 构建 TypeScript
- `npm start` — 运行生产构建
- `npm run lint` — ESLint 代码检查
- `npm run serve` — PM2 生产部署

## Benchmark

内置压测脚本，测试聊天补全接口性能：

```bash
npm run build
pm2 start ecosystem.config.cjs || pm2 restart ecosystem.config.cjs

# 调整速率限制（benchmark 需要）
# 编辑 ecosystem.config.cjs 中 RATE_LIMIT_FLASH=100000 等
pm2 restart ecosystem.config.cjs

node scripts/bench.mjs
```

支持环境变量：`HOST`（默认 localhost）、`PORT`（默认 3000）、`CONNECTIONS`（并发数，默认 50）、`DURATION`（测试时长秒，默认 30）。

## 内部实现

各模块的实现细节请参阅 `docs/` 目录：

- [Disk Cache 实现原理](./docs/feature-disk-cache.md) — 缓存键生成、LRU 淘汰、命中规则
- [Embeddings 功能实现](./docs/feature-embeddings.md) — 确定性向量生成、API 规范
