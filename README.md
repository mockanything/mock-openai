# Mock OpenAI

> [中文版](./README.zh.md)

Mock OpenAI API service for development and testing.

## Features

- `/v1/chat/completions` — Chat completions endpoint
- `/v1/models` — List available models
- `/v1/embeddings` — Embeddings endpoint
- Streaming support (SSE)
- Tool / function calling simulation
- Chain-of-thought (reasoning_effort)
- Prompt caching simulation (input + output cache)
- Per-model rate limiting (flash 250/min, pro 50/min per key)
- Global 10MB request body size limit
- API key authentication (`sk-` format)
- Billing logging (SQLite)
- Benchmark models (`benchmark-v1-flash` / `benchmark-v1-pro`, 100% tool call trigger)

## Quick Start

```bash
npm install
npm run dev
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| DEFAULT_MODEL | apple-v1-flash | Default chat model |
| RATE_LIMIT_FLASH | 250 | Flash model requests per minute per key |
| RATE_LIMIT_PRO | 50 | Pro model requests per minute per key |
| RATE_LIMIT_MODELS | 100 | Models endpoint requests per minute |

## Authentication

All API endpoints require `Authorization: Bearer sk-...` header. The API key must start with `sk-`.

```bash
export API_KEY="sk-your-api-key"
```

> This project only validates the format, not the actual key.

## API

### List Models

```bash
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer $API_KEY"
```

### Chat Completions

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Streaming

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

### Tool Calls

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "messages": [{"role": "user", "content": "What'\''s the weather?"}],
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

### Chain of Thought

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "reasoning_effort": "high"
  }'
```

### Embeddings

```bash
curl -X POST http://localhost:3000/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "input": "Hello, world!",
    "model": "text-embedding-3-small"
  }'
```

```bash
# Multiple inputs
curl -X POST http://localhost:3000/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "input": ["Hello", "World"],
    "model": "text-embedding-3-large"
  }'
```

```bash
# Custom dimensions
curl -X POST http://localhost:3000/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "input": "Hello",
    "model": "text-embedding-3-small",
    "dimensions": 256
  }'
```

### Billing

```bash
curl "http://localhost:3000/v1/billing/usage?start_date=2026-01-01&end_date=2026-06-07" \
  -H "Authorization: Bearer $API_KEY"
```

### Health Check

```bash
curl http://localhost:3000/health
```

## Scripts

- `npm run dev` — Development mode with hot reload
- `npm run build` — Build TypeScript
- `npm start` — Run production build
- `npm run lint` — ESLint check
- `npm run serve` — PM2 production deployment

## Benchmark

Built-in benchmarking script to test chat completion performance:

```bash
npm run build
pm2 start ecosystem.config.cjs || pm2 restart ecosystem.config.cjs

# Bump rate limits for benchmarking
# Edit RATE_LIMIT_FLASH=100000 in ecosystem.config.cjs
pm2 restart ecosystem.config.cjs

node scripts/bench.mjs
```

Environment variables: `HOST` (default localhost), `PORT` (default 3000), `CONNECTIONS` (default 50), `DURATION` (seconds, default 30).

## Internals

See `docs/` directory for implementation details:

- [Disk Cache](./docs/feature-disk-cache.md) — Cache key generation, LRU eviction, hit rules
- [Embeddings](./docs/feature-embeddings.md) — Deterministic vector generation, API spec
