# GlowForge Handoff — Builder Mode

## Last Run (2026-02-18)

### Completed: Browser Queue Drawer — `ffe2baf`

New component: `src/components/ToolRegistry/BrowserQueueDrawer.tsx`

**Features:**
- **Collapsible drawer** pinned below ScheduleManager in the left panel
- **Passive badge** — pending count shown even when collapsed (polls every 15s)
- **Status bar** — green/red dot, "Updated Xs ago", refresh + clear buttons
- **Dispatch form**:
  - Action dropdown (navigate/screenshot/scrape/scroll_feed/click/type/like/follow/reply)
  - Target URL input (monospace)
  - TTL input (seconds, 10–3600)
  - Optional params JSON textarea (toggled with ▸/▾)
  - Dispatch button with success/error feedback showing task ID
- **Pending tab** — live list of pending tasks: action badge, URL, age, TTL countdown (red when <30s)
- **Results tab** — list of results: ✓/✗/clock icon, task ID, timestamp, error preview
- **Live polling** — 5s interval when open, pauses when collapsed

**Wired into:** `ToolList.tsx` (added import + `<BrowserQueueDrawer />` below `<ScheduleManager />`)

## What's Next

### Tool Creation Wizard (Phase 2 — recommended)
The browser integration loop is now complete (queue API + extension + UI). The natural next headline feature is letting users create tools from the UI:
1. "New Tool" button in the left panel header
2. Modal: name, description, kind (service/tool/script)
3. Scaffold generator: creates `~/tools/{name}/lantern.yaml` from a template
4. Triggers `POST /api/projects/{name}/rescan` or similar to register with Lantern
5. Tool appears in the registry panel

Reference for the API: check `src/api/lantern.ts` — see if there's a create endpoint, or check Lantern directly.

### Schedule Toggle in ToolDetail (Phase 3)
- Add a "Schedules" tab to ToolDetail showing per-tool schedules from Loom `/schedules?tool={id}`
- Toggle individual schedules on/off inline

## Project State
- `~/tools/GlowForge/` — 12 commits total
- Phase 1 UI: ✅ (7 commits)
- Browser agent loop: ✅ extension scaffold + queue API + queue UI
- Phase 2 (Tool Creation): ⬜ not started
- Phase 3 (Schedule toggle): ⬜ not started
