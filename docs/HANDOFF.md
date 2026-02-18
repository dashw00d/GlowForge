# GlowForge Handoff — Builder Mode

## Last Run (2026-02-18)

### Completed: Schedules tab in ToolDetail — `14f59ab`

**All planned tasks are now complete.** The backlog is empty.

#### What was built

**`src/components/ToolRegistry/ToolDetail.tsx`** — Added `schedules` tab
- 4-tab bar: Overview · Endpoints · Docs · Schedules (with Calendar icon)
- `SchedulesTab` component:
  - Loads all schedules from Loom `/schedules` on mount
  - Filters "relevant" ones: schedule ID contains the tool's ID or name
  - Shows relevant schedules at top under "For {ToolName}"
  - Collapsible "All Schedules (N)" section for others
  - Each schedule: action badge (agent/http/shell/prompt/trace with color), ID, schedule expression, timezone, `last_fired` ("never" / "Xs ago")
  - Inline toggle switch with optimistic update
- `ScheduleRow` reusable sub-component

**`src/api/loom.ts`** — Bug fix in `listSchedules()`
- The Loom API was returning `{ schedules: [...] }` (array) not `{ schedules: { id: {...} } }` (object map)
- Old code did `Object.entries(array)` which produced numeric IDs — broken
- Fixed: detect array vs object, return array directly (items already have `.id`)

**`src/types.ts`** — Extended `ScheduledTask` type
- Added `enabled_override: boolean | null`
- Added `last_fired?: string | null`
- Made `timezone` nullable

#### Filtering logic
```typescript
function isRelevantSchedule(s, toolId, toolName):
  sid.startsWith(tid) || sid.includes(tid) || sid.includes(tname)
  || s.url?.includes(toolId) || s.message?.includes(toolId) || s.command?.includes(toolId)
```
Verified: `ghostgraph-health` correctly matched to `ghostgraph`, 6 others in "all" section.

## Project State
- `~/tools/GlowForge/` — 17 commits total
- **All 3 phases complete:**
  - Phase 1 (Core UI): Health strip, chat panel, tool registry, history drawer, schedule manager, keyboard shortcuts, TraceCard polish ✅
  - Phase 2 (Browser agent loop): Extension scaffold, queue API, queue drawer, tool creation wizard ✅
  - Phase 3 (Scheduling): Schedules tab in ToolDetail ✅

## What's Next (Ideas)
The task board is empty. If you run again, pick from these:
1. **Chat integration** — detect "build me a tool called X" → pre-fill wizard
2. **Schedule creation UI** — form to add a new Loom schedule from ToolDetail
3. **Tool deletion** — remove button → Lantern `DELETE /api/projects/:name`
4. **Log viewer tab** — tail journalctl for running services in ToolDetail
5. **Notifications** — show a toast when Loom trace completes
