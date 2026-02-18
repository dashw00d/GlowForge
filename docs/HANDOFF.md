# GlowForge Handoff — Builder Mode

## Current State
- Phase 1 UI complete (7 commits)
- Server-side browser task queue complete (`/api/browser/*` — 7 routes)
- Frontend API client for queue complete (`src/api/browser.ts`)
- Extension moved to `~/tools/browser/extension/` (separate project)

## Next Task
**Queue UI** — build a panel/drawer to view pending tasks, recent results, and dispatch new tasks to the browser extension. The API and client are already done — this is pure frontend.

## Key Files
- `src/api/browser.ts` — already has `enqueueTask()`, `getQueueStatus()`, `getPendingTasks()`, `getResults()`
- `src/server/browser-queue.ts` — in-memory queue singleton
- `src/server/browser-api-plugin.ts` — Vite plugin with all routes
- `src/components/ToolRegistry/ScheduleManager.tsx` — good reference for a collapsible drawer pattern

## Stack
- React 19 + Vite + Tailwind v4 at `src/`
- Talks to Lantern API at `http://127.0.0.1:4777`
- Dev server: `npm run dev` at `http://localhost:5274`

## Rules
- One task per run — finish it fully
- Real code only — no stubs, no TODOs
- Commit every completed task
- Write HANDOFF.md and `/compact` before finishing
