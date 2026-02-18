# GlowForge Handoff — Builder Mode

## Current State
- Phase 1 UI complete (7 commits)
- Server-side browser task queue complete
- Queue drawer, tool creation wizard, schedule toggle all done
- **New feature: Build System** — live tool construction with build.yaml

## Next Task
**build.yaml reader + types** — TypeScript types for BuildManifest, Vite plugin route to read `~/tools/{id}/build.yaml`, `src/api/build.ts` client.

## Key Files
- `docs/BUILD-SYSTEM.md` — full spec for the build system (READ THIS FIRST)
- `docs/TASKS.md` — task board
- `src/server/browser-api-plugin.ts` — reference for how to add a Vite plugin route
- `src/components/ToolRegistry/ToolCard.tsx` — reference for BuildCard component
- `src/components/ToolRegistry/ToolDetail.tsx` — reference for BuildDetail view

## Stack
- React 19 + Vite + Tailwind v4 at `src/`
- Lantern API: `http://127.0.0.1:4777`
- Dev server: `npm run dev` at `http://localhost:5274`

## Rules
- One task per run — finish fully
- Real code only — no stubs, no TODOs
- Commit every completed task
- Write HANDOFF.md and `/compact` before finishing
- Read `docs/BUILD-SYSTEM.md` before starting any build system task
