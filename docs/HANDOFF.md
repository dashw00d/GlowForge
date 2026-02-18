# GlowForge Handoff — Builder Mode

## Last Run (2026-02-18)

### Completed: Schedule creation UI — `a8ae6ea`

Full schedule CRUD from within GlowForge — create and delete schedules directly from
the ToolDetail Schedules tab. Changes take effect after Loom restart.

**Why a Vite plugin?**
Loom's API only supports `PATCH /schedules/:id` (toggle). Creating/deleting requires
direct file access. The schedules-plugin handles it the same way build-plugin does for
build.yaml.

**Changes:**

**`src/server/schedules-plugin.ts`** (new):
- `POST /api/schedules` — validates input, writes new entry to `schedules.yaml`
- `DELETE /api/schedules/:id` — removes entry from `schedules.yaml`
- Path: `$LOOM_SCHEDULES_PATH` or `~/tools/Loom/schedules.yaml`
- Uses js-yaml for parse/dump; writes clean block YAML
- Validates: id (slugified), schedule (required), action (one of agent/http/shell/prompt/trace)
- Action-specific validation: agent needs message, http needs url, shell needs command

**`vite.config.ts`**:
- Added `schedulesPlugin()` import and usage

**`src/api/loom.ts`**:
- `createSchedule(input: CreateScheduleInput): Promise<CreateScheduleResult>` — POST to Vite plugin
- `deleteSchedule(id: string): Promise<void>` — DELETE to Vite plugin
- `CreateScheduleInput` type: id, schedule, action, message?, url?, command?, prompt?, timezone?, enabled?, timeout?, method?

**`src/components/ToolRegistry/ToolDetail.tsx`**:
- `SchedulesTab` fully rewritten with:
  - `showForm` state — collapsible form toggled by "Add" button in section header
  - `defaultForm(toolId)` helper — pre-fills id as `{toolId}-schedule`, action=agent, enabled=true
  - `setAction()` — updates form action + auto-renames ID suffix + resets content fields
  - `handleCreate()` — calls createSchedule(), reloads list, shows 3s success flash
  - `handleDelete()` — calls deleteSchedule(), removes from local state
  - Form fields: ID (editable), action buttons (agent/http/shell/prompt), schedule expr with hint,
    content field (Message/Prompt/URL+Method/Command depending on action), timezone, enabled toggle
  - Success flash: green bar "created — takes effect after Loom restart"
  - Error display below submit button
- `ScheduleRow` gets `deleting?` + `onDelete?` props:
  - Trash icon button (right of toggle) → inline confirm: [Delete] [✕]
  - Row fades to 40% opacity while deleting

## UX Flow

**Create schedule:**
1. Open ToolDetail → Schedules tab
2. Click "Add" button → dashed form appears
3. Fill in ID (pre-populated), select action, enter schedule expression
4. Enter content (message/URL/command/prompt depending on action)
5. Submit → schedule written to schedules.yaml
6. Success flash appears, list refreshes, form hides

**Delete schedule:**
1. Hover schedule row → 🗑 icon appears
2. Click → [Delete] [✕] confirm buttons appear
3. Click Delete → row fades, schedule removed from file, row disappears

## What's Next

Remaining Future Ideas:

1. **Log viewer tab in ToolDetail** — tail journalctl/process logs
   - New "Logs" tab in ToolDetail
   - Vite plugin: `GET /api/logs/:toolId?lines=200` → shells out to `journalctl -u {toolId} -n 200`
   - Or read service log files directly from the tool dir
   - Terminal-style monospace panel with auto-scroll, keyword highlighting, filter input

2. **Chat → wizard integration** — "build me X" pre-fills wizard
   - Parse Loom trace output for tool creation intents
   - Pre-fill NewToolModal name/description from chat context
   - Would need to identify creation-intent responses in TraceCard

## Project State
- `~/tools/GlowForge/` — 30 commits total
- All original TASKS.md items: **DONE**
- Build system: **DONE**
- Tool deletion: **DONE**
- Schedule creation/deletion: **DONE**
