# GlowForge Handoff — Builder Mode

## Last Run (2026-02-18)

### Completed: Tool deletion — `af8d327`

Trash button added to the ToolDetail header with a clean inline confirmation flow.
Deleting unregisters the tool from Lantern and immediately clears the selection +
refreshes the tool list.

**Changes:**

**`src/api/lantern.ts`:**
- `deleteProject(id: string): Promise<void>` — `DELETE /api/projects/:name`

**`src/components/ToolRegistry/ToolDetail.tsx`:**
- New prop: `onDeleted?: () => void`
- New state: `deleteState: 'idle' | 'confirm' | 'deleting'` and `deleteError: string | null`
- New `handleDelete()` async function — calls `deleteProject(toolId)` → `onDeleted?.()`
- Header reworked with three render modes:
  - `idle`: Start/Stop button + 🗑 trash icon button (hover → red)
  - `confirm`: "Delete?" text + Cancel + Delete buttons (replacing controls)
  - `deleting`: spinner + "Deleting…" text
- Error banner: renders between header and tabs if delete fails (dismissable)

**`src/App.tsx`:**
- New state: `toolRefreshKey: number`
- `onDeleted` handler: clears selection, removes manifest from buildManifests, bumps refreshKey
- Passes `refreshKey={toolRefreshKey}` to ToolList

**`src/components/ToolRegistry/ToolList.tsx`:**
- New prop: `refreshKey?: number`
- Extra `useEffect` — calls `load()` immediately when `refreshKey` changes (>0)
- This gives instant list refresh after deletion vs. waiting up to 10s for next poll

**UX flow:**
1. User clicks 🗑 → controls swap to "Delete? [Cancel] [Delete]"
2. User clicks Delete → spinner appears, `deleteProject()` fires
3. On success → `onDeleted()` → panel closes, list refreshes immediately
4. On failure → error banner appears in panel, controls restore to idle

## What's Next

Remaining Future Ideas (pick any):

1. **Schedule creation UI** — form in ToolDetail schedules tab to add a new cron schedule
   - Loom API: likely `POST /api/schedules` with id/action/schedule/message
   - UI: collapsible "Add Schedule" form below the existing schedule list
   - Fields: id, action type, cron expression, message/URL/command

2. **Log viewer tab in ToolDetail** — tail journalctl/process logs
   - New "Logs" tab in ToolDetail
   - Vite plugin endpoint: `GET /api/logs/:toolId?lines=200` (shells out to journalctl)
   - Terminal-style monospace panel with auto-scroll, filter input

3. **Chat → wizard integration** — "build me X" pre-fills wizard
   - Parse Loom chat output for tool creation intents
   - Pre-fill NewToolModal with name/description from chat context

## Project State
- `~/tools/GlowForge/` — 28 commits total
- All original TASKS.md items: **DONE**
- Build system: **DONE**
- Tool deletion: **DONE**
