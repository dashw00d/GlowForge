# QA Fixes — Repair Checklist

Source: `QA-REPORT.md` from 2026-02-18 QA run.

## Fix Order

### 1. [CRITICAL] Loom proxy port — `vite.config.ts`
Change `/loom-api` proxy target from `41000` to dynamic (read from Lantern) or `41002`.
**Kills:** Loom Chat, Schedules tab, Schedules drawer, Jobs panel, History

### 2. [HIGH] Lantern lifecycle API paths — `src/api/lantern.ts`
`restartTool()` / `activateTool()` / `deactivateTool()` call `/api/projects/{id}/restart|activate|deactivate`.
Lantern tools are at `/api/tools/{id}`. Find correct Lantern mutation endpoints and fix.
**Kills:** Start/Stop/Restart buttons on all tools (fail silently with 404)

### 3. [HIGH] Log streaming 406 — `ToolDetail.tsx` or wherever logs are fetched
Add `Accept: text/event-stream` header to the EventSource/fetch for log streaming.
Route: `/lantern-api/api/projects/{id}/logs` → returns 406 without correct header.
**Kills:** Logs tab shows "offline" for all tools

### 4. [MEDIUM] Build polling spam — wherever build status is fetched
`/api/build/{id}` returns 404 for tools without build.yaml (expected).
But UI polls this for ALL 9 tools every 10s → 404 flood in console.
Fix: Only poll `/api/build/{id}/exists` first, only fetch full build if exists=true.
Or: Catch 404 silently without console.error.

### 5. [MEDIUM] Filter counter mismatch
When filter is active, sidebar says "2/9 running" — misleading.
Should say "5/9 running" (system total) or "2 matching" (filtered count).

### 6. [LOW] Lifecycle button feedback
No loading state on Start/Stop/Restart. Add spinner while action is in progress.
Show error toast if action fails (currently silent).

### 7. [LOW] Jobs endpoint path
UI calls `/loom-api/jobs` → Loom has no `/jobs` endpoint (404).
Should call `/loom-api/history` instead.

## Rules
- Fix one issue per commit
- After ALL fixes: run the QA test suite again
- Report new findings
