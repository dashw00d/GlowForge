# GlowForge Tasks

## In Progress
- [ ] Schedule toggle in ToolDetail — per-tool schedule view from Loom `/schedules`, toggle inline

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
- [x] Browser queue drawer — collapsible panel with live status, dispatch form (action/URL/params/TTL), pending task list, results tab — `ffe2baf`
- [x] Tool creation wizard — scaffold plugin (lantern.yaml+README), Lantern registration, modal UI with kind/template/tags, + button in registry header — `67e772b`

## Backlog

### 3. Declarative Scheduling (Phase 3)
- [ ] Schedule toggle in ToolDetail — per-tool schedule view from Loom `/schedules`
