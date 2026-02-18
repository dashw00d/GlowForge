# GlowForge Tasks

## In Progress
- [ ] Queue UI — browser queue drawer: pending tasks, recent results, dispatch form, live status

## Done
- [x] React/Vite scaffold — two-column layout, Tailwind v4, shadcn-style components, full API clients — `bdd938c`
- [x] Health strip — full-width Lantern system health bar (daemon/DNS/Caddy/TLS), 30s refresh — `5f62e07`
- [x] History drawer — collapsible recent traces in chat panel, load into session — `be25460`
- [x] Schedule manager — collapsible drawer at left panel bottom, toggle schedules live — `4cee45c`
- [x] ToolDetail docs tab — loads markdown via API, renders with full CSS, file selector for multi-doc tools — `bcc9c83`
- [x] Keyboard shortcuts — `/` and `Cmd+K` focus chat from anywhere, header badge + footer hint — `ba41c38`
- [x] TraceCard polish — copy button, expand/collapse long outputs, prominent plan while running — `500d9d7`
- [x] Server-side browser task queue — Vite plugin API at `/api/browser/*`, in-memory queue with TTL — `507eec5`
- [x] Frontend API client for queue — `src/api/browser.ts` — `507eec5`

## Backlog

### 1. Queue UI (do first — connects GlowForge to browser extension)
- [ ] Queue panel — new component: pending task list, recent results with status badges, pending count
- [ ] Dispatch form — action type dropdown, target URL input, params JSON editor, TTL slider → POST `/api/browser/tasks`
- [ ] Live refresh — poll `/api/browser/queue` every 5s, show connected/disconnected indicator
- [ ] Wire into layout — collapsible drawer or dedicated tab in the main UI

### 2. Tool Creation Wizard (Phase 2 headline)
- [ ] "New Tool" modal — name, description, kind fields
- [ ] Scaffold generator — creates tool directory + lantern.yaml from template
- [ ] Registration pipeline — write files → trigger Lantern rescan → tool appears in registry panel
- [ ] Chat integration — "build me a tool" in Loom chat triggers the wizard flow

### 3. Declarative Scheduling (Phase 3)
- [ ] Schedule toggle in ToolDetail — per-tool schedule view from Loom `/schedules`
