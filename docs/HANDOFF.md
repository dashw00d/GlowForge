# GlowForge Handoff — Builder Mode

## Last Run (2026-02-18)

### Completed: Registry integration — `26dc8fd`

The build system is now fully wired into the live UI. This was the key integration task.

**`ToolList.tsx` changes:**
- New prop: `onBuildManifestUpdate?: (manifests: Map<string, BuildManifest>) => void`
- State: `buildManifests: Map<string, BuildManifest>`
- `loadBuilds(toolIds[])` — fetches all build manifests in parallel via `fetchBuildStatuses()`
- `load()` now also calls `loadBuilds()` after fetching tools
- **Adaptive polling**: two separate `useEffect` intervals:
  - Main: 10s (tool list refresh)
  - Fast: 3s, only when `hasActiveBuilds` is true (auto-enables/disables)
- Card rendering logic: `buildManifests.get(tool.id)` with `isActiveBuild()` → renders `BuildCard` instead of `ToolCard`
- `onRetry` handler: clears the failed manifest, re-loads
- `onDismiss` handler: removes manifest from map (user hides build card)
- Header subtitle shows "· N building" when builds are active

**`App.tsx` changes:**
- New state: `buildManifests: Map<string, BuildManifest>`
- `handleBuildManifestUpdate` (stable via `useCallback`) — passed to ToolList
- Right panel conditional: `showBuildDetail = selectedManifest != null && isActiveBuild(manifest)` 
  - True → renders `<BuildDetail toolId onClose onReady onRetry />`
  - False → renders `<ToolDetail toolId onClose />`
- `handleBuildReady`: clears manifest from map → panel transitions to ToolDetail automatically

**Full data flow:**
```
Loom writes build.yaml → ToolList polls (3s) → fetchBuildStatuses() →
setBuildManifests() → onBuildManifestUpdate() → App.setBuildManifests() →
ToolCard → BuildCard (in list) + BuildDetail (in right panel)
```

## What's Next

### Scaffold plugin update (task 5 — last build system task)
When a tool is created via the GlowForge wizard, also write an initial `build.yaml` with `status: pending`. This way Loom builder agents immediately have a file to update.

**Changes to `src/server/scaffold-plugin.ts`:**
1. In the `POST /api/scaffold` handler, after writing `lantern.yaml` + `README.md`, also write `build.yaml` with:
   - `tool_id: {slug}`
   - `name: {displayName}`
   - `prompt: {description}` (placeholder until Loom overwrites it)
   - `status: pending`
   - `started_at: {now}`
   - `progress: 0`
   - Standard phases array (scaffold/core/api/test/register)
   - Empty log
2. Return `build_yaml_path` in the response
3. The NewToolModal's "creating" step will show immediately as a build in progress

This means when you create a tool, it appears as a BuildCard right away — Loom then updates build.yaml as it works.

## Project State
- `~/tools/GlowForge/` — 25 commits total
- Build System: types/API ✅ | BuildCard ✅ | BuildDetail ✅ | Registry integration ✅ | Scaffold update ⬜
- All other phases complete ✅
