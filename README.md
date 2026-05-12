# Mock OpenAI

Mock OpenAI API service for development and testing.

## Features

- `/v1/chat/completions` - Chat completions endpoint
- Streaming support
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

### Health Check

```bash
curl http://localhost:3000/health
```

## Scripts

- `npm run dev` - Development mode
- `npm run build` - Build
- `npm start` - Run production