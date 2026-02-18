# GlowForge QA Report — 2026-02-18

## Summary
11/22 features working, 8 broken, 3 partial.  
**Root cause of most failures: Loom hardcoded to port 41000 in `vite.config.ts`, but Loom is actually running on port 41002. This single misconfiguration kills Loom Chat, Schedules, Jobs panel, and history. Secondary: Lantern uses `/api/tools` for reads but GlowForge calls `/api/projects/{id}/restart|activate` for mutations — those routes don't exist.**

---

## ✅ Working

- **Tool registry list**: Loads correctly from `/lantern-api/api/tools`, shows 9 tools with running/stopped status badges, descriptions, kind tags
- **Tool detail: overview tab**: Shows Kind, Status, Health, Command, Loom Triggers, Tags, Notes section — all populated correctly
- **Tool detail: docs tab**: Renders markdown correctly (tested on GlowForge — multi-doc support visible, content loads)
- **New Tool modal**: Opens, name auto-generates ID slug (e.g. "test-tool" → id: test-tool, path: ~/tools/test-tool), Create Tool button enables only when name is filled. Kind/Template/Tags/Advanced all present
- **Notes editing**: Edit button → textbox appears with Save/Cancel. Works correctly
- **Delete tool confirm**: Inline "Delete?" with Cancel + red Delete buttons. Does not delete on Cancel. ✅
- **Tool filter input**: Typing "loom" filters sidebar to matching tools instantly
- **Dark/light theme toggle**: Works, persists across toggle. Full visual switch both directions
- **Browser Queue drawer**: Expands in sidebar, shows queue status (pending/results count), task dispatcher with type dropdown (navigate/screenshot/scrape/scroll_feed/click/type/like/follow/reply), TTL spinner, URL input, JSON params expander, Dispatch button
- **Browser Queue dispatch**: Dispatch button works — dispatched task appears in Pending tab with correct ID, type, URL, age, TTL. Shows "✓ Dispatched {id}" confirmation
- **GET /api/browser/queue**: HTTP 200 → `{"pending":1,"total_in_queue":2,"results_stored":0,"recent_results":[]}`
- **POST /api/browser/tasks (correct fields)**: HTTP 200 when using `{"action":"navigate","target_url":"...","ttl_seconds":300}` — UI sends these correctly; my curl test used wrong field names

---

## ❌ Broken

- **Loom Chat — COMPLETELY DEAD**: Typing a message and hitting Enter calls `POST /loom-api/prompt`. The Vite proxy maps `/loom-api` → `http://127.0.0.1:41000`. **Port 41000 is not listening.** Loom is actually at port 41002. Result: HTTP 500 on every chat message. UI shows "Loom unreachable: HTTP 500". No trace cards appear. The core feature of the app does not work.
  - Root cause: `vite.config.ts` line: `target: 'http://127.0.0.1:41000'` should be `41002`
  - Confirmed: `curl http://127.0.0.1:41002/health` → `{"status":"ok","service":"loom","version":"0.1.0"}`

- **Schedules tab (tool detail)**: HTTP 500. Calls `/loom-api/schedules` → port 41000 (not listening) → 500. Should show Loom's schedule list. Same port bug.

- **Schedules sidebar drawer**: HTTP 500, shows "0 active". Same root cause. Loom's `/schedules` endpoint at port 41002 returns valid JSON with multiple schedules — UI never sees them.

- **Jobs panel**: HTTP 500. Calls `/loom-api/history?limit=20` → port 41000 → 500. Should show Loom run history. Same port bug. Also: Loom has no `/jobs` endpoint (404) — the UI calls the wrong path entirely.

- **Restart tool → silent failure**: Clicking "Restart tool" on GlowForge fires `POST /lantern-api/api/projects/glowforge/restart`. Lantern returns 404: "Project 'glowforge' not found". **No error shown to user** — button completes silently as if successful, but nothing actually restarts. Console error: `"Restart failed: Error: Project 'glowforge' not found at req ... at handleRestart"`. Lantern uses `/api/tools` (not `/api/projects`) for tools registered via lantern.yaml.

- **Start stopped tool → silent failure**: Clicking "Start" on GhostGraph fires `POST /lantern-api/api/projects/ghostgraph/activate` → 404. Same root cause as restart. Button fires, nothing happens, no feedback. Console shows: `"Failed to load resource: the server responded with a status of 404 ()" → /lantern-api/api/projects/ghostgraph/activate`.

- **Log streaming → broken**: Logs tab shows "offline · No logs available — Tool may be stopped or logs not yet buffered" even for a running tool (GlowForge is running). The logs fetch calls `/lantern-api/api/projects/glowforge/logs` → **HTTP 406 Not Acceptable**. Lantern's logs endpoint exists but returns 406 (client sending wrong Accept header — needs `text/event-stream` for SSE but likely sending `application/json`). GlowForge shows "offline" for all tools regardless of status.

- **Endpoints tab → "No endpoints discovered"**: Lantern tries to auto-discover endpoints by fetching `http://127.0.0.1:41000/openapi.json` (Loom's configured but wrong port). Gets `econnrefused`. Lantern logs this as a discovery error. UI correctly shows "No endpoints discovered" — but it's because of the port mismatch, not an actual absence of endpoints. (Loom has 28 endpoints defined manually, none auto-discovered via openapi.)

---

## ⚠️ Partial

- **Tool timeline tab**: Shows health events, but status is always "unknown" for all tools (including running ones like GlowForge). Timeline entry shows `unknown · 11:20:30 AM · 4m ago`. Health checks may not be propagating correctly from Lantern's health polling.

- **Tool action feedback (UX bug)**: No loading state or spinner for Start/Restart/Stop actions. Buttons fire and return immediately with no visual indicator that an action is in progress (or failed silently). User has no idea if actions worked.

- **Filter counter**: When filter is active (e.g. "loom" shows 2 tools), the sidebar shows "2/9 running". This is misleading — 5 tools are actually running, "2/9" suggests only 2 out of 9 are running across the whole system. Should show either "5/9 running" (system total) or "2 shown" (filtered count).

---

## Console Errors

**High-volume spam (9 errors × every 10 seconds):**
- `Failed to load resource: 404` for `GET /api/build/{tool_id}` for ALL 9 tools: ghostgraph, glowforge, loom, austinselite, austinselite-next, auto-shorts, git-chronicle, lantern, twitter-intel
  - These poll every 10 seconds. The `/api/build/{id}/exists` route returns 200 (correct), but `/api/build/{id}` (without `/exists`) returns 404. The UI should only call `/exists` or handle the 404 gracefully without console noise

**Critical one-time errors:**
- `Failed to load resource: 500` for `POST /loom-api/prompt` (Loom chat broken)
- `Failed to load resource: 500` for `GET /loom-api/schedules` (repeated, ~every 90s when schedules drawer open)
- `Failed to load resource: 500` for `GET /loom-api/history?limit=20` (Jobs panel)
- `Failed to load resource: 404` for `POST /lantern-api/api/projects/glowforge/restart`
- `Restart failed: Error: Project 'glowforge' not found at req ... at handleRestart (ToolDetail.tsx:94:14)`
- `Failed to load resource: 404` for `POST /lantern-api/api/projects/ghostgraph/activate`
- `Failed to load resource: 406` for `GET /lantern-api/api/projects/glowforge/logs`
- `Failed to load resource: 500` for `GET /lantern-api/api/tools` (appeared 2x briefly — intermittent Lantern 500s)

---

## API Test Results

| Route | Status | Response |
|-------|--------|----------|
| `GET /api/browser/queue` | **200 ✅** | `{"pending":1,"total_in_queue":2,"results_stored":0,"recent_results":[]}` |
| `POST /api/browser/tasks` with `{kind,url,ttl}` | **400 ❌** | `{"error":"action is required"}` — API expects `action` + `target_url` + `ttl_seconds`, not `kind`/`url`/`ttl`. UI sends correct fields. Docs should clarify. |
| `POST /api/browser/tasks` with `{action,target_url,ttl_seconds}` | **200 ✅** | (via UI) Task enqueued, shows in queue |
| `GET /api/build/glowforge/exists` | **200 ✅** | `{"exists":false,"path":"/home/ryan/tools/glowforge/build.yaml"}` |
| `GET /api/build/glowforge` | **404 ❌** | `{"error":"build.yaml not found","tool_id":"glowforge","path":"/home/ryan/tools/glowforge/build.yaml"}` — Expected for tools without active builds, but UI polls this for ALL tools continuously, flooding console |
| `GET /loom-api/schedules` (via GlowForge) | **500 ❌** | Port 41000 not listening → connection refused → 500 |
| `POST /loom-api/prompt` (via GlowForge) | **500 ❌** | Same port issue |
| `GET /loom-api/history` (via GlowForge) | **500 ❌** | Same port issue |
| `GET http://127.0.0.1:41002/schedules` (Loom direct) | **200 ✅** | Returns valid JSON array of schedules (social-scout-cycle, social-cycle, etc.) |
| `POST http://127.0.0.1:41002/prompt` (Loom direct) | **200 ✅** | `{"trace_id":"clw-41d5e48f3664","status":"running"}` — Loom works fine when called on correct port |
| `GET http://127.0.0.1:41002/history` (Loom direct) | **200 ✅** | Returns run history |
| `GET http://127.0.0.1:41002/jobs` (Loom direct) | **404 ❌** | Endpoint doesn't exist in Loom — UI is calling wrong path |
| `POST /lantern-api/api/projects/{id}/restart` | **404 ❌** | "Project not found" — Lantern tools don't have /api/projects entries |
| `POST /lantern-api/api/projects/{id}/activate` | **404 ❌** | Same |
| `GET /lantern-api/api/projects/{id}/logs` | **406 ❌** | Endpoint exists but wrong Accept header |
| `GET http://127.0.0.1:4777/api/tools` | **200 ✅** | Returns all 9 tools correctly |
| `GET http://127.0.0.1:4777/api/schedules` | **404 ❌** | Lantern has no schedules endpoint |

---

## Fix Priority

1. **[CRITICAL]** `vite.config.ts`: Change `/loom-api` proxy target from `41000` to `41002` → fixes Loom Chat, Schedules, Jobs panel, History
2. **[HIGH]** Lantern lifecycle API path: `restartTool` / `activateTool` / `deactivateTool` in `lantern.ts` call `/api/projects/{id}/restart|activate|deactivate` but Lantern's tools are at `/api/tools/{id}`. Find the correct Lantern mutation endpoints.
3. **[HIGH]** Log streaming 406: Add `Accept: text/event-stream` header to the log fetch request in `ToolDetail.tsx`
4. **[MEDIUM]** `/api/build/{id}` polling: Either stop polling (only poll `/exists`), suppress console errors on 404, or add backoff
5. **[MEDIUM]** Filter counter: Show total running count (not filtered count) when filter is active
6. **[LOW]** Add loading spinners to Start/Stop/Restart buttons
7. **[LOW]** `GET /loom-api/jobs` → Loom has no `/jobs` endpoint. Needs to use `/history` instead

