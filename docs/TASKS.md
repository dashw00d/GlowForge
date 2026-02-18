# GlowForge Tasks

## In Progress
_(none)_

## Done
- [x] React/Vite scaffold — two-column layout, Tailwind v4, shadcn-style components, full API clients — `bdd938c`
- [x] Health strip — full-width Lantern system health bar (daemon/DNS/Caddy/TLS), 30s refresh — `5f62e07`

## Backlog

### Phase 1 – MVP UI (pick next from top)
- [ ] History sidebar — `GET /history` → collapsible past traces list in chat panel
- [ ] Schedule manager — `GET /schedules`, toggle via `PATCH /schedules/{id}` → drawer in left panel
- [ ] ToolDetail: docs content loading — call `GET /api/tools/:id/docs` and render markdown
- [ ] Keyboard shortcut — `/` or `Cmd+K` to focus chat input

### Phase 2 – Autonomous Build
- [ ] "Build me a tool" flow — structured prompt to Loom, show scaffold progress in TraceCard
- [ ] Tool creation wizard — name, description, kind; auto-generates lantern.yaml

### Phase 3 – Declarative Scheduling
- [ ] Schedule toggle in ToolDetail — per-tool schedule view from Loom `/schedules`

### Phase 4 – Stretch
- [ ] Public routing via `exposure: public` (requires Lantern changes)
- [ ] Remote registry federation
