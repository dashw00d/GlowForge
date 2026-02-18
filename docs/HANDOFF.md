# GlowForge Handoff — Builder Mode

## Last Run (2026-02-18)

### Completed: BuildCard component — `f0f88ca`

**`src/components/ToolRegistry/BuildCard.tsx`** — Compact card for building tools:

**Layout (same footprint as ToolCard — px-3 py-2.5):**
- Row 1: 🔨 icon (pulses when active) + tool name + elapsed timer / "Queued" label
- Row 2: Progress bar (animated shine for building, amber for testing, solid green/red for terminal states)
- Row 3: Current step/phase name with ⚙/🔬 prefix, or error snippet on failure
- Row 4: Phase checklist — compact row of `✓ Scaffold ◐ Core ○ API ○ Test ○ Reg` symbols

**Visual states via `STATUS_BORDER` + CSS keyframes:**
- `pending`  — `opacity-60`, dashed border
- `building` — `build-card-building` class → 2s blue pulse glow animation
- `testing`  — `build-card-testing` class → 2s amber pulse glow animation
- `ready`    — solid green border
- `failed`   — solid red border, red tool name, error text, Retry button

**Progress bar inner fill:**
- building: `build-progress-bar` — blue shimmer animation (moving gradient)
- testing: `build-progress-bar-amber` — amber shimmer animation
- ready: solid `var(--color-green)`
- failed: solid `var(--color-red)`
- Width transitions with `transition-all duration-500`

**Props:** `manifest: BuildManifest`, `selected`, `onSelect`, `onRetry?`, `onDismiss?`

**`src/index.css`** — Added 4 keyframes + 4 utility classes for animations:
`build-pulse-blue`, `build-pulse-amber`, `build-progress-shine`, `.build-card-building`, `.build-card-testing`, `.build-progress-bar`, `.build-progress-bar-amber`

## What's Next

### BuildDetail view (task 3 — do next)
- `src/components/ToolRegistry/BuildDetail.tsx`
- Replaces `ToolDetail` right panel when a tool has an active build.yaml
- Sections:
  1. Header — name, status badge, elapsed timer, original prompt (truncated)
  2. Phase list — full `BuildPhase[]` with collapsible step-level checkboxes
  3. Build log panel — `BuildLogEntry[]` in monospace, auto-scroll, timestamped
  4. File artifacts — `phase.artifacts[]` as clickable file links
- Uses same tab-style header as ToolDetail for consistency
- Reference: `src/components/ToolRegistry/ToolDetail.tsx`

### Registry integration (task 4 — after BuildDetail)
- `ToolList.tsx`: check `hasBuildManifest(tool.id)` for each tool
- Swap in `BuildCard` when build.yaml exists with status ≠ ready
- Poll `/api/build/:toolId` every 3s while any builds are active
- Transition to ToolCard when status → ready (brief green flash)
- Pass `onSelect` to open `BuildDetail` instead of `ToolDetail`

## Project State
- `~/tools/GlowForge/` — 21 commits total
- Build System: types/API ✅ | BuildCard ✅ | BuildDetail ⬜ | Registry integration ⬜
