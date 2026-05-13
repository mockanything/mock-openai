# Mock OpenAI

Mock OpenAI API service for development and testing.

## Features

- `/v1/chat/completions` — Chat completions endpoint
- `/v1/models` — List available models
- Streaming support (SSE)
- Tool / function calling simulation
- Chain-of-thought (reasoning_effort)
- Per-model rate limiting (flash 20/min, pro 60/min)
- Request body size limits (flash 1MB, pro 10MB)

## Quick Start

```bash
npm install
npm run dev
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| DEFAULT_MODEL | apple-v1-flash | Default model |
| RATE_LIMIT_FLASH | 20 | Flash model requests per minute |
| RATE_LIMIT_PRO | 60 | Pro model requests per minute |
| RATE_LIMIT_MODELS | 100 | Models endpoint requests per minute |

## API

### List Models

```bash
curl http://localhost:3000/v1/models
```

### Chat Completions

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Streaming

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

### Tool Calls

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
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
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "reasoning_effort": "high"
  }'
```

### Health Check

```bash
curl http://localhost:3000/health
```

## Scripts

- `npm run dev` — Development mode with hot reload
- `npm run build` — Build TypeScript
- `npm start` — Run production build
