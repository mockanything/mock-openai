# AGENTS.md

## Commands

```bash
npm run dev      # tsx watch src/index.ts (hot reload)
npm run build    # tsc → dist/
npm start        # node dist/index.js
npx tsc --noEmit # Type check without building
npm run lint      # eslint src --ext .ts (flat config in eslint.config.js)
```

## Project Structure

- `src/index.ts` — Express server entrypoint, mounts routers
- `src/config.ts` — Loads `PORT`, `DEFAULT_MODEL`, rate limit env vars
- `src/routes/chat.ts` — `POST /v1/chat/completions` (streaming + non-streaming)
- `src/routes/models.ts` — `GET /v1/models` (reads `src/templates/models.md`)
- `src/services/mock.ts` — Core mock response generation (sync), tool call simulation
- `src/types/openai.ts` — OpenAI-compatible request/response types
- `src/middleware/rate-limit.ts` — Rate limiters for chat (per-model) and models endpoints
- `src/middleware/body-size-limit.ts` — Flash 1MB body size check
- `eslint.config.js` — ESLint flat config (v10, typescript-eslint recommended)
- `.vscode/settings.json` — ESLint format-on-save via `source.fixAll.eslint`

## Key Quirks

- **ESM path resolution**: Template files loaded via `getDirname()` helper (`fileURLToPath(import.meta.url)`) with a CommonJS fallback, found in `mock.ts` and `models.ts`.
- **Response templates**: `src/templates/response/*.md` sorted by filename, selected by `user role message count % total`.
- **Reasoning templates**: `reasoning/*.md` keyed by `low`/`medium`/`high`/`max`, loaded synchronously at startup.
- **Streaming**: SSE with `setTimeout(sendChunk, 0)` — hardcoded 0ms delay, NOT configurable.
- **Tool calls**: When `tools` provided in request, flash models have 80% chance (or 100% if `tool_choice: "required"`) to call 1–N/2 tools; pro models always call 1–N tools. Arguments are mock-generated from JSON schema.
- **Models list**: 20 fruit-named models (e.g. `apple-v1-flash`) in `models.md`. Owner mapped by id pattern matching (gpt→openai, claude→anthropic, etc.).
- **Rate limiting**: Per-IP + per-model-suffix (flash 20/min, pro 60/min). Models endpoint 100/min per IP. Configurable via env vars.
- **Body size**: Global 10MB limit via `express.json()`. Flash models additionally capped at 1MB via middleware.
- **Env vars wired in code**: `PORT`, `DEFAULT_MODEL`, `RATE_LIMIT_FLASH`, `RATE_LIMIT_PRO`, `RATE_LIMIT_MODELS`. `DEFAULT_RESPONSE` and `STREAM_DELAY` are documented in README but **not implemented**.
