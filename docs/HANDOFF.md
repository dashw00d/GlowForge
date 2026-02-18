# GlowForge Handoff — Builder Mode

## Last Run (2026-02-18)

### Completed: Server-side task queue — `507eec5`

Added the GlowForge browser agent API that the extension polls:

**New files:**
- `src/server/browser-queue.ts` — In-memory `BrowserQueue` singleton
  - `enqueue()` — adds task with UUID, timestamp, TTL
  - `dequeue()` — FIFO, auto-skips/records expired tasks
  - `addResult()` — stores results (last 200, most-recent-first)
  - `status()` / `listPending()` / `listResults()` — for Queue UI
- `src/server/browser-api-plugin.ts` — Vite plugin (MV = `configureServer`)
  - `GET  /api/browser/tasks` → dequeue + 204 if empty
  - `POST /api/browser/tasks` → enqueue, returns full task object
  - `POST /api/browser/results/:id` → store extension result
  - `GET  /api/browser/queue` → status + recent results
  - `GET  /api/browser/queue/pending` → pending task list
  - `GET  /api/browser/queue/results` → full result history
  - `DELETE /api/browser/queue` → clear (dev utility)
- `src/api/browser.ts` — Frontend API client (enqueueTask, getQueueStatus, etc.)
- `vite.config.ts` — updated to load `browserQueuePlugin()`

**Verified:** All 7 routes tested with live curl; TTL expiry auto-records expired tasks.

**Note:** Two concurrent builders ran and caused extension files to be accidentally deleted by `git add -A`. Fixed with commit `744d3c5` that restores them.

## What's Next

### Queue UI (Phase 4 — recommended next)
- New panel or drawer in the GlowForge frontend to:
  - Show queue status (pending count, connected indicator)
  - List pending tasks (action, target URL, age, TTL countdown)
  - List recent results (status badge, data preview, timestamp)
  - Dispatch button with action type + URL form
- Can use `src/api/browser.ts` — everything is already wired
- Good place: collapsible drawer in left panel below Schedule Manager, or a dedicated tab

### Tool Creation Wizard (Phase 2)
- Modal: name, description, kind → POST to Loom → triggers Lantern rescan
- Needs Loom `POST /tools` or similar endpoint (check Loom API)

## Project State
- `~/tools/GlowForge/` — 11 commits total
- Phase 1 UI: ✅ complete (7 commits)
- Extension scaffold: ✅ at `extension/` (restored from `9492910`)
- Server-side queue: ✅ Vite plugin live at `/api/browser/*`
- Queue UI: ⬜ not yet built
- Phase 2 / 3: ⬜ not started

## Extension Install
```
chrome://extensions → Developer Mode → Load unpacked → ~/tools/GlowForge/extension/
Set URL: http://localhost:5274 → Save
```
