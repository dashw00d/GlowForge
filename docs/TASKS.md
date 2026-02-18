# GlowForge Tasks

## In Progress
_(none)_

## Done
- [x] React/Vite scaffold — two-column layout, Tailwind v4, shadcn-style components, full API clients — `bdd938c`
- [x] Health strip — full-width Lantern system health bar (daemon/DNS/Caddy/TLS), 30s refresh — `5f62e07`
- [x] History drawer — collapsible recent traces in chat panel, load into session — `be25460`

## Backlog

### Phase 1 – MVP UI (pick next from top)
- [ ] Schedule manager — `GET /schedules`, toggle via `PATCH /schedules/{id}` → collapsible drawer in left panel footer
- [ ] ToolDetail: docs content loading — call `GET /api/tools/:id/docs` and render markdown
- [ ] Keyboard shortcut — `Cmd+K` or `/` focuses chat input from anywhere

### Phase 2 – Autonomous Build
- [ ] "Build me a tool" flow — structured prompt to Loom, show scaffold progress in TraceCard
- [ ] Tool creation wizard — name, description, kind; auto-generates lantern.yaml

### Phase 3 – Declarative Scheduling
- [ ] Schedule toggle in ToolDetail — per-tool schedule view from Loom `/schedules`

### Phase 4 – Stretch
- [ ] Public routing via `exposure: public` (requires Lantern changes)
- [ ] Remote registry federation
