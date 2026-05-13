# AGENTS.md

## Commands

```bash
npm run dev      # tsx watch src/index.ts (hot reload)
npm run build    # tsc → dist/
npm start        # node dist/index.js
npx tsc --noEmit # Type check without building
```

No test or lint infrastructure exists. `npm run lint` in package.json will fail (no ESLint config).

## Project Structure

- `src/index.ts` — Express server entrypoint, mounts routers
- `src/config.ts` — Loads `PORT` (default 3000) and `DEFAULT_MODEL` (default `apple-v1-flash`)
- `src/routes/chat.ts` — `POST /v1/chat/completions` (streaming + non-streaming)
- `src/routes/models.ts` — `GET /v1/models` (reads `src/templates/models.md`)
- `src/services/mock.ts` — Core mock response generation (sync)
- `src/types/openai.ts` — OpenAI-compatible request/response types

## Key Quirks

- **ESM path resolution**: Template files loaded via `getDirname()` helper (`fileURLToPath(import.meta.url)`) with a CommonJS fallback, found in `mock.ts` and `models.ts`.
- **Templates loaded at startup**: `glamour.md` (response content) and `reasoning/*.md` (chain-of-thought, keyed by `low`/`medium`/`high`/`max`) are read synchronously on import.
- **`src/templates/response/` is NOT loaded** by the server — these files are unused.
- **Streaming**: SSE with `setTimeout(sendChunk, 0)` — hardcoded 0ms delay, NOT configurable.
- **Models list**: 20 fruit-named models (e.g. `apple-v1-flash`) in `models.md`. Owner mapped by id pattern matching (gpt→openai, claude→anthropic, etc.).
- **Env vars**: Only `PORT` and `DEFAULT_MODEL` are wired in code. `DEFAULT_RESPONSE` and `STREAM_DELAY` are documented in README but **not implemented**.
