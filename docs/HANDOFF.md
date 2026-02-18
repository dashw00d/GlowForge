# GlowForge Handoff — Builder Mode

## Last Run (2026-02-18)

### Completed: Tool Creation Wizard — `67e772b`

Full end-to-end tool creation from the GlowForge UI. Three new pieces:

**`src/server/scaffold-plugin.ts`** — Vite plugin, `POST /api/scaffold`
- Creates `~/tools/{name}/` directory
- Writes `lantern.yaml` from template (fastapi/vite/nextjs/nuxt/django/static/laravel/script)
- Writes `README.md` with description + path
- Template-aware: sets `run.cmd`, `health_endpoint`, `type`, `root` correctly
- Wired into `vite.config.ts`

**`src/api/lantern.ts`** — 4 new exported functions
- `scaffoldTool(input)` — `POST /api/scaffold` via Vite plugin
- `createProject(input)` — `POST /api/projects` to Lantern
- `refreshProjectDiscovery(name)` — `POST /api/projects/:name/discovery/refresh`
- `listTemplates()` — `GET /api/templates`

**`src/components/ToolRegistry/NewToolModal.tsx`** — Full wizard modal
- Fields: name (slug preview), display name, description, kind (tool/service/website), template dropdown, tags, optional custom path
- 3-step flow: form → creating (progress log) → done/error
- "Open in Registry →" button after success auto-selects the new tool
- Escape key closes, backdrop click closes

**`src/components/ToolRegistry/ToolList.tsx`** — "+" button
- Added `Plus` icon button next to Refresh in the header
- Renders `<NewToolModal>` when clicked
- `onCreated` callback: reloads tool list + selects new tool

## What's Next

### Schedule Toggle in ToolDetail (Phase 3)
The one remaining backlog item. Adds a "Schedules" tab to `ToolDetail` showing per-tool schedules from Loom `/schedules` filtered by tool name. Toggle individual schedules on/off inline.

Reference:
- `src/api/loom.ts` → `listSchedules()`, `toggleSchedule()` — already implemented
- `src/components/ToolRegistry/ScheduleManager.tsx` — reuse the schedule row UI
- Add a "Schedules" tab to the tab bar in `ToolDetail.tsx`

### Chat Integration for Tool Creation (Phase 2 tail)
After the schedule toggle, could add: "build me a tool called X" in Loom chat → GlowForge intercepts the pattern and opens the wizard pre-filled. Requires adding message parsing to `ChatPanel.tsx`.

## Project State
- `~/tools/GlowForge/` — 15 commits total
- Phase 1 UI: ✅ (7 commits)
- Browser agent loop: ✅
- Tool creation wizard: ✅
- Phase 3 (schedule toggle in ToolDetail): ⬜ — last backlog item
