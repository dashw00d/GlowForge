# GlowForge Handoff — Builder Mode

## Last Run (2026-02-18)

### Completed: Dark/light theme toggle — `9b7cdbe`

Full dark/light mode with zero component changes needed. The entire UI adapts because
every color reference uses `var(--color-*)` CSS custom properties — swapping the
variables on `<html>` instantly recolors everything.

**Strategy:**
- `@theme` in Tailwind v4 declares CSS variables at `@layer theme` (low cascade priority)
- Adding `.light` class (unlayered) to `<html>` overrides those variables at higher priority
- All component colors are already `var(--color-*)` — no per-component changes

**Files changed:**

**`src/index.css`:**
New `.light { ... }` block (unlayered, after `@theme`) that overrides all 14 color tokens:
```
--color-background:    oklch(0.96 0.006 260)  /* was 0.08 */
--color-surface:       oklch(1.00 0.002 260)  /* was 0.12 */
--color-surface-raised: oklch(0.93 0.006 260) /* was 0.16 */
--color-border:        oklch(0.78 0.012 260)  /* was 0.22 */
--color-border-subtle: oklch(0.88 0.008 260)  /* was 0.18 */
--color-text-primary:  oklch(0.13 0.016 260)  /* was 0.93 */
--color-text-secondary: oklch(0.36 0.012 260) /* was 0.60 */
--color-text-muted:    oklch(0.54 0.010 260)  /* was 0.40 */
--color-accent:        oklch(0.55 0.20 260)   /* slightly darker for contrast */
--color-green/red/yellow: slightly darker for readability on white
```

**`src/hooks/useTheme.ts`** (new):
- `getInitialTheme()` — reads from localStorage key `glowforge-theme`, defaults `'dark'`
- `applyTheme(theme)` — adds/removes `light` class on `document.documentElement`
- Module-level call: `applyTheme(getInitialTheme())` — applies theme before React renders (prevents flash)
- `useTheme()` hook — manages state, syncs class + localStorage in useEffect
- Returns `{ theme, toggleTheme, setTheme }`

**`src/App.tsx`:**
- Import `useTheme`
- `const { theme, toggleTheme } = useTheme()` at top
- Pass `theme` and `onThemeToggle` props to `<HealthStrip />`

**`src/components/ui/HealthStrip.tsx`:**
- Import `Sun`, `Moon` from lucide-react + `Theme` type
- `HealthStripProps` interface: `theme?: Theme`, `onThemeToggle?: () => void`
- Inline `toggle` element: `<button>` with `<Sun />` (when light → shows Moon) or `<Moon />` (when dark → shows Sun)
- Toggle appears on the right of all three render states (error/allOk/expanded)

## UX Details

- **Dark → Light**: click Sun icon → everything brightens instantly (no page reload)
- **Light → Dark**: click Moon icon → returns to dark
- **Persistence**: theme survives page refreshes via localStorage
- **No flash**: `applyTheme()` called at module load (before React paint)
- **Scrollbar adapts**: `::-webkit-scrollbar-thumb` uses `var(--color-border)` — changes automatically
- **All components adapt**: since every color is a CSS variable, nothing was hard-coded

## What's Next

Remaining Future Ideas:

1. **Tool restart button** — `restartTool(id)` already in `src/api/lantern.ts`:
   - Add `Repeat2` icon button in ToolDetail header between Start/Stop and Trash
   - `restartToggling: boolean` state
   - onClick → call `restartTool(toolId)` → refresh tool state
   - Maybe 30-40 lines of changes

2. **Pinned endpoints** — localStorage set of `{toolId}:{path}:{method}`:
   - Star button per endpoint row in EndpointsTab
   - "Pinned" section at top of Endpoints tab listing all stars across tools
   - Quick-access panel somewhere (maybe ToolList drawer or Chat panel header?)

## Project State
- `~/tools/GlowForge/` — 36 commits total
- All original TASKS.md items: **DONE**
- All build system tasks: **DONE**
- Post-v1 features: deletion, schedules, logs, endpoint tester, callbacks, theme — **ALL DONE**
