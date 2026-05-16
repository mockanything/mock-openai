# AGENTS.md

## Commands

```bash
npm run dev      # tsx watch src/index.ts (hot reload)
npm run build    # tsc → dist/
npm start        # node dist/index.js
npx tsc --noEmit # Type check without building
npm run lint     # eslint src --ext .ts (flat config in eslint.config.js)
npm run serve    # pm2 start ecosystem.config.cjs (production)
```

## Project Structure

- `src/index.ts` — Express entrypoint, mounts routers, request logging middleware
- `src/config.ts` — Loads `PORT`, `DEFAULT_MODEL`, rate limit env vars
- `src/controllers/chat.ts` — Chat completion orchestrator: cache check, mock generation, usage stats, persistence
- `src/controllers/models.ts` — Model list handler
- `src/routes/chat.ts` — `POST /v1/chat/completions` (thin route → controller)
- `src/routes/models.ts` — `GET /v1/models` (thin route → controller)
- `src/services/mock-non-stream.ts` — Non-streaming response generation, shared tool call helpers
- `src/services/mock-stream.ts` — Streaming response generator (SSE)
- `src/services/mock-disk-cache.ts` — In-memory disk cache simulation with LRU eviction (10k keys)
- `src/templates/index.ts` — Template loading & access (`getResponseTemplate`, `getReasoningContent`)
- `src/templates/response/*.md` — Response content templates
- `src/templates/reasoning/*.md` — Reasoning (chain-of-thought) templates
- `src/templates/models.md` — Model list source file
- `src/types/openai.ts` — OpenAI-compatible request/response types
- `src/middleware/rate-limit.ts` — Rate limiters for chat (per-model) and models endpoints
- `src/middleware/body-size-limit.ts` — Flash 1MB body size check
- `src/utils/helpers.ts` — Pure utilities: `generateId`, `splitIntoChunks`, `countTokens`, `isFlashModel`
- `src/utils/logger.ts` — Winston logger, access.log + server.log
- `eslint.config.js` — ESLint flat config (v10, typescript-eslint recommended)
- `.vscode/settings.json` — ESLint format-on-save via `source.fixAll.eslint`

## Key Quirks

- **ESM path resolution**: Template files loaded via `getDirname()` helper (`fileURLToPath(import.meta.url)`) with a CommonJS fallback, found in `models.ts` and `templates/index.ts`.
- **Response templates**: `src/templates/response/*.md` sorted by filename, selected by `user role message count % total`.
- **Reasoning templates**: `reasoning/*.md` keyed by `low`/`medium`/`high`/`max`, loaded synchronously at startup.
- **Streaming**: SSE with `setTimeout(sendChunk, 0)` — hardcoded 0ms delay, NOT configurable.
- **Tool calls**: When `tools` provided in request, flash models have 80% chance (or 100% if `tool_choice: "required"`) to call 1–N/2 tools; pro models always call 1–N tools. Arguments are mock-generated from JSON schema.
- **Models list**: 20+ fruit-named models (e.g. `apple-v1-flash`) in `models.md`. Owner mapped by id pattern matching (gpt→openai, claude→anthropic, etc.).
- **Rate limiting**: Per-IP + per-model-suffix (flash 20/min, pro 60/min). Models endpoint 100/min per IP. Configurable via env vars.
- **Body size**: Global 10MB limit via `express.json()`. Flash models additionally capped at 1MB via middleware.
- **Disk cache simulation**: In-memory prefix cache (`mock-disk-cache.ts`) with LRU eviction (10k keys, O(1) via Map insertion order). Cache key = `N:djb2(messages[0..N])`. Two persistence points per request: input-end (`persistEndpoints`). Cache hit/miss token stats reported in `usage.prompt_cache_hit_tokens` / `prompt_cache_miss_tokens`.
- **Token estimation**: `countTokens()` — 1 English char ≈ 0.3 tokens, 1 Chinese char ≈ 0.6 tokens. Used for `prompt_tokens`, `completion_tokens`, and cache breakdown fields.
- **Usage details**: `prompt_tokens_details` includes `cached_tokens`, `reasoning_tokens`, `content_tokens`. `completion_tokens_details` includes `reasoning_tokens`, `content_tokens`.
- **Logging**: Winston with two files: `logs/access.log` (request path/status/duration/content-length) and `logs/server.log` (cache events, startup). Dev mode also writes to console.
- **Env vars wired in code**: `PORT`, `DEFAULT_MODEL`, `RATE_LIMIT_FLASH`, `RATE_LIMIT_PRO`, `RATE_LIMIT_MODELS`. `DEFAULT_RESPONSE` and `STREAM_DELAY` are documented in README but **not implemented**.
