# GlowForge Handoff — Builder Mode

## Last Run (2026-02-18)

### Completed: Pinned endpoints — `a689e95`

Star any endpoint to bookmark it. Pinned endpoints appear in a persistent drawer at the
bottom of the Tool Registry sidebar — accessible without opening any specific tool. Each
pin shows a quick-fire button for immediate HTTP requests.

**Files created:**

**`src/lib/pinnedEndpoints.ts`** (new):
- `PinnedEndpoint` type: `{ toolId, toolName, method, path, baseUrl, description?, pinnedAt }`
- `pinKey(toolId, method, path)` — stable composite key for equality
- `loadPins() / savePins(pins)` — localStorage under key `glowforge-pinned-endpoints`
- `isPinned(toolId, method, path): boolean`
- `togglePin(pin): boolean` — returns `true` if now pinned, `false` if removed
- `removePin(toolId, method, path)` — direct remove

**`src/components/ToolRegistry/PinnedEndpointsDrawer.tsx`** (new):
- Collapsible panel in ToolList sidebar (above ScheduleManager)
- Auto-hides when no pins exist and drawer is closed (prevents empty clutter)
- Header: yellow Star icon + "PINNED" label + count badge + chevron
- Max height 256px with scroll; sorted by `pinnedAt` desc (most recent first)
- `PinRow` component per pin:
  - Method badge (color-coded) + path + Play button + X (remove)
  - Tool name tag + description below
  - Fire button: direct `fetch()` to `pin.baseUrl + pin.path`
  - For POST/PUT/PATCH: click Play → toggles body textarea + Send button
  - Status flash: `200 · 12ms` (green) or `404 · 8ms` (red), fades after 4s
  - Error display for network failures
- Refreshes on `window.focus` so changes from other components are picked up

**`src/components/ToolRegistry/ToolDetail.tsx`** (updated):
- `isPinned`, `togglePin`, `pinKey` imported from `pinnedEndpoints`
- `Star` icon added to lucide-react imports
- `EndpointsTab`:
  - `pinnedKeys: Set<string>` state initialized from localStorage
  - `handleTogglePin(ep)` — calls `togglePin()`, updates `pinnedKeys` state
  - `activeKey: string | null` replaces `activeIdx` for stable key-based open tracking
  - "⭐ Pinned (N)" section at top when any endpoints are pinned for this tool
  - Separator (`border-b`) between pinned section and full list
  - Pinned endpoints appear in both the "Pinned" section AND full list (consistency)
- `EndpointRow`:
  - New props: `pinned?: boolean`, `onTogglePin?: () => void`
  - Star button after Test button: filled yellow (★) when pinned, hollow muted when not
  - Click star (without opening test form) via `e.stopPropagation()`

**`src/components/ToolRegistry/ToolList.tsx`** (updated):
- Import and render `<PinnedEndpointsDrawer />` above `<ScheduleManager />`

## UX flow

1. Open a tool → Endpoints tab
2. Click ★ on any endpoint → fills yellow, endpoint moves to "⭐ Pinned" section at top
3. Collapse the tool panel — the ToolList sidebar now shows a "⭐ Pinned" drawer
4. Click the drawer → see all starred endpoints across all tools
5. Click ▶ on a GET/DELETE → fires immediately, shows `200 · 12ms` flash
6. Click ▶ on a POST/PUT/PATCH → body textarea expands → fill + Send
7. Click ✕ to unpin; the star in EndpointsTab goes hollow again

## What's Next

Remaining Future Ideas:

1. **Tool restart button** — `restartTool(id)` is already in `src/api/lantern.ts`
   - Add `Repeat2` icon button in ToolDetail header between Start/Stop and Trash
   - ~30 lines

2. **Tool health history graph** — sparkline of health check results over time
   - Store last N health check results for each tool
   - Mini sparkline in ToolCard and/or ToolDetail overview
   - Interesting but complex

## Project State
- `~/tools/GlowForge/` — 38 commits total
- All core features: **DONE**
- Post-v1 polish: deletion, schedules, logs, endpoint tester, callbacks, theme, pinned — **ALL DONE**
