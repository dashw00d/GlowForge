# GlowForge Handoff — Builder Mode

## Last Run (2026-02-18)

### Completed: build.yaml reader + types — `088812b`

Foundation layer for the Build System. Three new pieces:

**`src/types.ts`** — New type definitions:
- `BuildStatus` — `'pending' | 'building' | 'testing' | 'ready' | 'failed'`
- `PhaseStatus` — `'pending' | 'in_progress' | 'done' | 'failed' | 'skipped'`
- `BuildStep` — `{ name, status, file?, started_at?, completed_at? }`
- `BuildPhase` — `{ id, name, status, started_at?, completed_at?, artifacts?, steps? }`
- `BuildLogEntry` — `{ time, msg }`
- `BuildManifest` — full build.yaml schema
- `BuildSummary` — derived view: `{ manifest, currentPhase, currentStep, elapsedSeconds, elapsedFormatted }`

**`src/server/build-plugin.ts`** — Vite plugin (`GET/POST /api/build/*`):
- `GET /api/build/:toolId` — reads `~/tools/{id}/build.yaml`, parses YAML → JSON `BuildManifest`
- `GET /api/build/:toolId/exists` — fast probe (no parse), returns `{ exists, path }`
- `POST /api/build/:toolId/write` — writes raw YAML (dev/test utility)
- Path sanitization (strips non-alphanumeric except `-_`)
- Clean 404 when build.yaml absent

**`src/api/build.ts`** — Frontend client + helpers:
- `fetchBuildStatus(toolId)` — returns `BuildManifest | null`
- `hasBuildManifest(toolId)` — exists probe
- `fetchBuildStatuses(toolIds[])` — parallel fetch → `Map<id, manifest>`
- `getCurrentPhase(manifest)` — finds in_progress or first pending phase
- `getCurrentStep(manifest)` — finds active step within active phase
- `computeProgress(manifest)` — derives 0-1 from phases if manifest.progress is 0
- `buildSummary(manifest)` — builds `BuildSummary` with elapsed time
- `isActiveBuild()`, `isTerminalBuild()` — status predicates
- `STATUS_LABELS`, `STATUS_COLORS`, `PHASE_STATUS_SYMBOL` — display constants

## What's Next

### BuildCard component (task 2 — do next)
- `src/components/ToolRegistry/BuildCard.tsx`
- Compact card variant that appears in the tool list when a build.yaml exists with status ≠ ready
- Progress bar (uses `computeProgress()`)
- Phase checklist (✓/◐/○/✗)
- Visual states: ghost border (pending), pulsing glow (building), amber (testing), red (failed)
- References `ToolCard.tsx` for sizing and style patterns

### BuildDetail view (task 3 — after BuildCard)
- Expanded view for clicking into a building tool
- Phase list with step-level checkboxes, build log panel, prompt shown at top

### Registry integration (task 4)
- ToolList checks `hasBuildManifest()` for each tool
- Renders BuildCard vs ToolCard based on result
- Polls at 3s while any active builds

## Project State
- `~/tools/GlowForge/` — 19 commits total
- All Phase 1-3 work done ✅
- Build System: types/API done ✅ | BuildCard ⬜ | BuildDetail ⬜ | Registry integration ⬜
