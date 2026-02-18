# GlowForge

The unified interface for the tool platform — Lantern registry + Loom chat in one window.

## Architecture

```
Left panel  → Lantern /api/tools (registry, status, start/stop)
Center      → Loom /prompt (chat, trace visualization)
```

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS v4
- No backend — thin UI over existing Lantern + Loom APIs

## Dev

```bash
npm install
npm run dev       # http://localhost:5274
```

Lantern must be running at `http://127.0.0.1:4777`.
Loom URL is resolved dynamically via Lantern's `/api/tools/loom`.

## What's built

- [x] Two-column layout (registry + chat)
- [x] ToolList — live from Lantern `/api/tools`, 10s auto-refresh
- [x] ToolCard — status dot, start/stop buttons
- [x] ToolDetail — endpoints, docs, health, start/stop toggle
- [x] ChatInput — sends prompts to Loom
- [x] TraceCard — polls `/status/{trace_id}`, live task progress
- [x] ChatPanel — example prompts, trace history in session
- [x] API clients: `lantern.ts`, `loom.ts`
- [x] Loom URL resolution via Lantern (dynamic port, 5-min cache)
- [x] `lantern.yaml` — registered as a Lantern tool

## Next

- History sidebar (past traces from Loom `/history`)
- Schedule manager (Loom `/schedules`, enable/disable)
- Health strip (Lantern `/api/system/health`)
