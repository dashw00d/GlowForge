# GlowForge Handoff — Builder Mode

## Last Run
- Phase 1 UI complete (7 commits)
- Extension moved to `~/tools/browser/extension/`

## Next Task
- **Pick first task from Phase 2** — "Build me a tool" flow or tool creation wizard

## Project State
- `~/tools/GlowForge/` — 7 commits, Phase 1 UI complete
- Talks to Lantern API at `http://127.0.0.1:4777`
- Dev server: `npm run dev` at `http://localhost:5274`

## Stack
- **Frontend:** React 19 + Vite + Tailwind v4 at `src/`
- API clients for Loom, Lantern, GhostGraph

## Rules
- One task per run — finish it fully
- Real code only — no stubs, no TODOs
- Commit every completed task
- Write HANDOFF.md and `/compact` before finishing

## Note
Browser extension is at `~/tools/browser/extension/` — separate builder handles that.
Phase 4 will add `/api/browser/tasks` endpoint for extension to poll.
