# GlowForge Tasks

## In Progress
- [ ] BuildDetail view — expanded right panel: phases+steps, build log, artifacts, prompt, elapsed time

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
- [x] Schedules tab in ToolDetail — per-tool filtered schedule view, inline toggle, collapsible all-schedules, fix listSchedules() array API bug — `14f59ab`

## Backlog

### Build System — Live Tool Construction (priority)
Full spec: `docs/BUILD-SYSTEM.md`

#### 1. build.yaml reader + types ✅ `088812b`
- [x] TypeScript types — `BuildManifest`, `Phase`, `Step`, `BuildStatus`, `BuildSummary`
- [x] `src/api/build.ts` — `fetchBuildStatus()`, `buildSummary()`, `computeProgress()`, helpers
- [x] Vite plugin — `GET /api/build/:toolId`, `/exists`, `/write` routes with js-yaml parsing

#### 2. BuildCard component ✅ `f0f88ca`
- [x] `BuildCard.tsx` — compact card variant with progress bar, phase checklist, status text
- [x] Visual states — faded/dashed (pending), pulsing glow (building), amber (testing), red (failed)
- [x] Progress bar — animated shine for building/testing, solid green/red for ready/failed
- [x] Current step name shown below progress bar, phase symbols (✓/◐/○/✗)

#### 3. BuildDetail view
- [ ] `BuildDetail.tsx` — expanded view: full phase list with step-level checkboxes
- [ ] Current step highlighted with pulse animation
- [ ] Build log panel — monospace, auto-scroll, entries from build.yaml `log[]`
- [ ] Original prompt shown at top
- [ ] File artifacts as clickable links
- [ ] Elapsed time display

#### 4. Registry integration
- [ ] ToolList detects build.yaml on tools → renders BuildCard instead of ToolCard
- [ ] Poll build.yaml every 3s while any tool has status building/testing/pending
- [ ] Transition animation: BuildCard → ToolCard when status hits `ready`
- [ ] "Retry" button on failed builds

#### 5. Loom builder prompt update
- [ ] Update tool creation wizard scaffold plugin to generate initial build.yaml
- [ ] Document build.yaml update pattern for Loom builder agents

### Future Ideas
- Chat integration: "build me a tool called X" → pre-fills wizard
- Schedule creation UI — form to add a new schedule from ToolDetail
- Tool deletion — remove button with Lantern `DELETE /api/projects/:name`
- Log viewer tab in ToolDetail — tail journalctl for running services
