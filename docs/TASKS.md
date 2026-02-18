# GlowForge Tasks

## In Progress
_(none)_

## Done
- [x] React/Vite scaffold — two-column layout, Tailwind v4, shadcn-style components, full API clients — `bdd938c`
- [x] Health strip — full-width Lantern system health bar (daemon/DNS/Caddy/TLS), 30s refresh — `5f62e07`
- [x] History drawer — collapsible recent traces in chat panel, load into session — `be25460`
- [x] Schedule manager — collapsible drawer at left panel bottom, toggle schedules live — `4cee45c`
- [x] ToolDetail docs tab — loads markdown via API, renders with full CSS, file selector for multi-doc tools — `bcc9c83`
- [x] Keyboard shortcuts — `/` and `Cmd+K` focus chat from anywhere, header badge + footer hint — `ba41c38`
- [x] TraceCard polish — copy button, expand/collapse long outputs, prominent plan while running — `500d9d7`
- [x] Browser extension scaffold — manifest V3, background SW, content script, humanize lib, queue client, task executor, popup — `9492910`
- [x] Server-side task queue — Vite plugin API at `/api/browser/*`, in-memory queue with TTL expiry, frontend client `src/api/browser.ts` — `507eec5`

## Backlog

### Phase 2 – Autonomous Build
- [ ] "Build me a tool" flow — user describes tool in chat → Loom creates scaffold → shows in registry
- [ ] Tool creation wizard — modal: name, description, kind → generates lantern.yaml + scaffold → triggers Lantern rescan

### Phase 3 – Declarative Scheduling
- [ ] Schedule toggle in ToolDetail — per-tool schedule view from Loom `/schedules`

### Phase 4 – Browser Task Queue
- [ ] Queue UI — view pending tasks, recent results, dispatch new tasks to extension

### Phase 5 – Stretch
- [ ] Public routing via `exposure: public` (requires Lantern changes)
- [ ] Remote registry federation

## Note
Browser extension lives at `~/tools/browser/extension/` — separate builder handles that project.
