# AGENTS.md

## Commands

```bash
npm run dev      # Development mode with hot reload
npm run build    # TypeScript compilation
npm start        # Run production build
npx tsc --noEmit # Type check without building
```

## Project Structure

- `src/index.ts` - Express server entry point
- `src/routes/` - API route handlers
- `src/services/` - Business logic (mock response generation)
- `src/types/` - TypeScript type definitions
- `src/templates/` - Markdown templates for mock responses

## Key Conventions

- **ESM**: Project uses `"type": "module"` in package.json
- **Templates**: Mock response content stored in `src/templates/*.md`, loaded via `fs.readFileSync`
- **Streaming**: SSE streaming uses `setTimeout` for chunk delay (configurable via `STREAM_DELAY` env)

## Environment Variables

See `.env.example` for available options:
- `PORT` - Server port (default: 3000)
- `DEFAULT_MODEL` - Default model name
- `DEFAULT_RESPONSE` - Default response text
- `STREAM_DELAY` - Stream chunk delay in ms

## API Endpoints

- `GET /health` - Health check
- `GET /v1/models` - List available models
- `POST /v1/chat/completions` - Chat completions (supports streaming)