# GlowForge Handoff — Builder Mode

## Last Run (2026-02-18)

### Completed: BuildDetail view — `0b68483`

**`src/components/ToolRegistry/BuildDetail.tsx`** — Full right-panel view for building tools.

**Structure:**
```
Header: [name] [Building badge] [0m 47s elapsed]  [↺ Retry?] [×]
Prompt bar: ▎ Build me a tool that monitors RSS feeds
Tabs: [■ Overview] [⌥ Log (12)]
────────────────────────────────────
Overview tab:
  Phases (accordion):
    ✓ Project Scaffold            ↓  (open, shows artifacts)
      📄 lantern.yaml  📄 README.md
    ◐ Core Implementation  2/3   ↓  (open, shows steps)
      ☑ RSS parser module
      ⟳ Feed polling loop   src/poller.py   ← current step (highlighted)
      ☐ Storage layer       src/storage.py
    ○ API Endpoints             →  (collapsed, faded)
    ○ Testing & Verification    →
    ○ Lantern Registration      →
  Build Info:
    Tool ID   rss-monitor
    Started   10:30:00
    Progress  35%

Log tab:
  10:30:01  Creating project scaffold        ← blue
  10:30:05  ✓ Scaffold complete              ← green
  10:30:06  Starting core implementation     ← blue
  10:30:15  ✓ RSS parser module              ← green
             ⟳ Building…
```

**Key features:**
- **3s polling** while `isActiveBuild()` is true; stops on terminal state
- **`onReady` callback** fires when status transitions to `ready` (parent swaps to ToolDetail)
- **Phase accordion** — auto-opens `in_progress` and `failed` phases; steps show ☑/⟳/☐/⚠
- **Log tab** — color-coded by content (✓ → green, error → red, Starting/Creating → blue), auto-scrolls to bottom on new entries
- **Retry button** appears only on `failed` state
- **Prompt bar** with left accent border for original user request

## What's Next

### Registry integration (task 4 — do next, most impactful)
This is the piece that wires everything together and makes it visible in the actual UI.

**Changes needed in `ToolList.tsx`:**
1. When loading tools, also check `hasBuildManifest(tool.id)` for each tool (parallel)
2. If a tool has a build.yaml with `status !== 'ready'`, render `<BuildCard>` instead of `<ToolCard>`
3. Poll every 3s when any active builds are present; resume normal 10s interval otherwise
4. When user clicks a BuildCard, open `<BuildDetail>` in the right panel instead of `<ToolDetail>`
5. `BuildDetail.onReady` → triggers refresh + swaps back to `<ToolCard>` + brief green flash

**Changes needed in `App.tsx`:**
- Pass enough state/callbacks to handle the BuildCard→ToolCard transition in the right panel

**Approach:** Since both components take `toolId` as their primary prop, the right panel can conditionally render `<BuildDetail>` or `<ToolDetail>` based on whether a build manifest exists. Store a `Map<toolId, BuildManifest>` in `ToolList` state.

### Scaffold plugin update (task 5)
After registry integration, update `scaffold-plugin.ts` to generate an initial `build.yaml` when creating a tool, so Loom builder agents can start updating it immediately.

## Project State
- `~/tools/GlowForge/` — 23 commits total
- Build System: types/API ✅ | BuildCard ✅ | BuildDetail ✅ | Registry integration ⬜ | Scaffold update ⬜
