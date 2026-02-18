# GlowForge Handoff — Builder Mode

## Last Run (2026-02-18)

### Completed: Scaffold generates initial build.yaml — `ecbb38a`

The last build system task is done. The tool creation wizard now writes `build.yaml`
immediately on scaffold, so new tools appear as BuildCards in the registry right away.

**Changes:**

**`src/server/scaffold-plugin.ts`:**
- New `generateBuildYaml(input, slug)` function — produces a complete `build.yaml`
  with `status: pending`, ISO `started_at`, `progress: 0`, all 5 standard phases
  (scaffold/core/api/test/register), and a seed log entry
- Route handler now writes `build.yaml` to `~/tools/{name}/build.yaml` after README.md
- Response includes `build_yaml_path` (the full path written)

**`src/api/lantern.ts`:**
- `ScaffoldResult.build_yaml_path?: string` added to the type

**`src/components/ToolRegistry/NewToolModal.tsx`:**
- Creation progress now shows `📋 Build manifest created (pending — will appear as BuildCard in registry)` if `scaffold.build_yaml_path` is present

**`docs/LOOM-BUILDER.md` (new):**
- Complete reference for Loom builder agents:
  - Status lifecycle (`pending → building → testing → ready`)
  - Full build.yaml schema with annotated examples
  - Update protocol (what to do after every phase/step)
  - Progress calculation formula + worked examples
  - Minimal start template (first thing agent does)
  - Resume-on-failure pattern
  - GlowForge API endpoints for reading/writing

## Build System — Fully Complete ✅

All 5 build system tasks are done:
1. ✅ `088812b` — build.yaml reader + types
2. ✅ `f0f88ca` — BuildCard component
3. ✅ `0b68483` — BuildDetail view
4. ✅ `26dc8fd` — Registry integration
5. ✅ `ecbb38a` — Scaffold plugin update + Loom docs

## What's Next

The backlog only has **Future Ideas** left — nothing urgent. Possible next tasks:

### Candidate next tasks
1. **Schedule creation UI** — form to add a new schedule from ToolDetail (currently only toggle exists)
2. **Tool deletion** — remove button with Lantern `DELETE /api/projects/:name` + confirmation
3. **Log viewer tab in ToolDetail** — tail journalctl/process logs for running services
4. **Chat → wizard integration** — "build me a tool called X" pre-fills the new tool form
5. **Build.yaml write API auth** — add a simple token or localhost-only guard to `POST /api/build/:toolId/write`

### Or declare v1 done
All planned features are implemented. GlowForge has:
- ✅ Two-column layout with health strip
- ✅ Tool registry with search, ToolDetail, docs tab, schedules tab
- ✅ New tool wizard with scaffolding + Lantern registration
- ✅ Live build system (BuildCard, BuildDetail, registry integration)
- ✅ Loom chat panel with trace history, keyboard shortcuts
- ✅ Schedule manager with live toggle
- ✅ Browser task queue with extension integration

## Project State
- `~/tools/GlowForge/` — 26 commits total
- All original tasks from TASKS.md: **DONE**
- Build system: **DONE** (all 5 phases)
