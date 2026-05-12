# Mock OpenAI

Mock OpenAI API service for development and testing.

## Features

- `/v1/chat/completions` - Chat completions endpoint
- `/v1/models` - List available models
- Streaming support
- Chain-of-thought (reasoning_effort)
- Configurable via environment variables

## Quick Start

```bash
npm install
npm run dev
```

## Configuration

Create `.env` file (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| DEFAULT_MODEL | gpt-3.5-turbo | Default model |
| DEFAULT_RESPONSE | "This is a mock response..." | Mock response content |
| STREAM_DELAY | 50 | Stream chunk delay (ms) |

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

- `npm run dev` - Development mode
- `npm run build` - Build
- `npm start` - Run production