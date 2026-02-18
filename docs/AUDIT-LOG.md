# GlowForge API Audit Log

Audit of every outgoing HTTP call in each source component, verified against live endpoints.

---

## src/api/lantern.ts — 2026-02-18 13:45 CST

### Traced calls

#### Read endpoints

- `listTools()` → `GET /api/tools` (via `/lantern-api/api/tools` → Lantern :4777)
  - Expected: `{data: ToolSummary[]}`
  - Actual: `{data: ToolSummary[], meta: {count: N}, tools: ToolSummary[]}`
  - Code reads `r.data` ✅ MATCH — extra `meta` and `tools` keys silently ignored
  - ⚠️ LOW: Lantern returns a redundant `tools` top-level key identical to `data`. Suggests API in transition; if `data` is ever dropped, `listTools()` breaks.

- `getTool(id)` → `GET /api/tools/{id}` (via proxy)
  - Expected: `{data: ToolDetail}`
  - Actual: `{data: ToolDetail, tool: ToolDetail}` — extra `tool` key (same redundant pattern)
  - Code reads `r.data` ✅ MATCH — same dual-key pattern as listTools
  - ✅ Route accepts both `id` ("glowforge") and display name ("GlowForge") — flexible

- `getToolDocs(id)` → `GET /api/tools/{id}/docs` (via proxy)
  - Expected: `{data: {docs: Array<{path, content?, error?}>}}`
  - Actual doc item shape: `{content, exists, kind, mtime, path, size, source}` — NO `error` field
  - Code handles missing `error` with `d.error ?? null` ✅ MATCH (graceful)
  - ⚠️ LOW: `DocFile` interface in `lantern.ts` is missing live fields `exists`, `kind`, `mtime`, `size`, `source`. Callers can't access these without a cast.

- `getProjectHealth()` → `GET /api/health` (via proxy)
  - Expected: `{data: Record<string, ProjectHealthStatus>}`
  - Actual: `{data: {"GhostGraph": {...}, "GlowForge": {...}, ...}}` — keyed by display NAME
  - Code reads `r.data` ✅ MATCH

- `getSystemHealth()` → `GET /api/system/health` (via proxy)
  - Expected: `{data: SystemHealth}`
  - Actual: `{data: {caddy, daemon, dns, tls}}` ✅ MATCH

- `listTemplates()` → `GET /api/templates` (via proxy)
  - Expected: `{data: LanternTemplate[]}` where template = `{name, description, type, run_cmd, builtin}`
  - Actual template items also include `{features, root, run_cwd, run_env}`
  - Code reads `r.data` ✅ MATCH — extra fields ignored at runtime
  - ⚠️ LOW: `LanternTemplate` interface is incomplete. Missing: `features: object`, `root: string|null`, `run_cwd: string`, `run_env: object`. Any code consuming template detail will silently lose these fields.

#### Lifecycle / mutation endpoints

- `activateTool(name)` → `POST /api/projects/{name}/activate` (via proxy)
  - Expected: HTTP 200, returns void
  - Actual: HTTP **422** with `{error: "activation_failed", message: "..."}` when runtime fails
  - Error flow: `req()` catches non-ok → reads `err.message` → throws ✅ handled correctly
  - ✅ Route correctly 404s on lowercase id ("ghostgraph") — name routing confirmed
  - ⚠️ MEDIUM: 422 is used both for "already running" AND "start failed" — callers can't distinguish these states without parsing the `error` field string, which the code doesn't expose.

- `deactivateTool(name)` → `POST /api/projects/{name}/deactivate` (via proxy)
  - Expected: HTTP 200, void
  - Actual: HTTP 200, `{data: ToolDetail}` — full project object returned
  - Code discards return value (returns `Promise<void>`) ✅ MATCH — UI just needs side effect
  - ✅ Works correctly

- `restartTool(name)` → `POST /api/projects/{name}/restart` (via proxy)
  - Expected: HTTP 200, void
  - Actual: HTTP **422** with `{error: "restart_failed", message: "..."}` when runtime fails
  - Same error handling pattern as `activateTool` ✅ handled
  - ⚠️ MEDIUM: Same 422 ambiguity — no distinction between "was already stopped" vs "start failed"

- `deleteProject(name)` → `DELETE /api/projects/{name}` (via proxy)
  - Expected: HTTP 200, void
  - Actual on nonexistent: HTTP 404 `{error: "not_found", message: "Project '...' not found"}`
  - Code catches via `!res.ok` → error thrown with message ✅ handled
  - ✅ Route confirmed: name-based, not id-based

- `createProject(input)` → `POST /api/projects` (via proxy)
  - Expected: `{data: ToolSummary}`
  - Actual on bad input: `{error: "invalid_project", message: "..."}` — hits error path correctly ✅
  - ⚠️ LOW: Success response shape not verified live (would require creating a real project). Type assertion `ApiResponse<ToolSummary>` assumed correct based on `getTool` shape pattern.

- `refreshProjectDiscovery(name)` → `POST /api/projects/{name}/discovery/refresh` (via proxy)
  - Expected: HTTP 200, void
  - Actual: HTTP 200 ✅ MATCH (GlowForge route confirmed live)

#### Scaffold (Vite plugin, NOT Lantern)

- `scaffoldTool(input)` → `POST /api/scaffold` (Vite dev-server plugin — NOT proxied through `/lantern-api`)
  - This is a direct call to the Vite plugin, bypasses the shared `req()` helper
  - Uses its own fetch + error handling: reads `(err as {error?: string}).error`
  - ⚠️ **MEDIUM**: Error parsing inconsistency:
    - Shared `req()` reads `err.message` (matches Lantern error shape `{error, message}`)
    - `scaffoldTool()` reads `err.error` (misses the message detail)
    - If the Vite plugin returns `{error: "some_code", message: "Human-readable reason"}`, callers see the error code string, NOT the human-readable message. UI error toasts will show codes like "scaffold_failed" instead of the actual reason.
  - Cannot curl-test (Vite plugin only active in dev mode)

---

### Issues found

1. **[LOW]** `listTools()` and `getTool()` — Lantern response has dual top-level keys (`data` + `tools`/`tool`). Code correctly reads `data`, but if Lantern drops `data` in favor of `tools`, both functions silently break. Should track this API versioning risk. `lantern.ts:24`, `lantern.ts:30`

2. **[LOW]** `getToolDocs()` — `DocFile` interface missing live fields `exists`, `kind`, `mtime`, `size`, `source`. Callers (e.g. `ToolDetail.tsx` docs tab) cannot surface file metadata without unsafe casts. `lantern.ts:36-48`

3. **[LOW]** `LanternTemplate` interface missing `features`, `root`, `run_cwd`, `run_env`. Any UI rendering template details will silently drop these. `lantern.ts:99-106`

4. **[MEDIUM]** `activateTool()` / `restartTool()` — Both return HTTP 422 for any runtime start failure. The `error` field (`"activation_failed"`, `"restart_failed"`) is never surfaced by `req()` — only `message` is thrown. UI cannot distinguish "tool was already in state X" from "runtime crash". Consider propagating the `error` code. `lantern.ts:71,75`

5. **[MEDIUM]** `scaffoldTool()` error parsing bug — reads `err.error` (error code string) instead of `err.message` (human description). Likely shows "scaffold_failed" in error toast instead of the actual failure reason. `lantern.ts:129-134`

6. **[INFO]** `getLoomBaseUrl()` is a stub that always returns `'/loom-api'` — exists as a hook for future dynamic resolution. Currently just a passthrough. Fine, but worth knowing it adds no value today. `lantern.ts:80`

---

### Verified OK

- `listTools()` → shape correct, handles 9 tools, `data` array accessible ✅
- `getTool(id)` → works with both id and display name ✅
- `getToolDocs(id)` → shape correct, missing `error` handled gracefully ✅
- `getProjectHealth()` → returns name-keyed health map correctly ✅
- `getSystemHealth()` → `{caddy, daemon, dns, tls}` shape correct ✅
- `listTemplates()` → 7 templates returned, `{data: [...]}` shape correct ✅
- `activateTool(name)` / `deactivateTool(name)` / `restartTool(name)` — name-based routing confirmed; 404 on id confirmed ✅
- `deleteProject(name)` — route exists, 404 shape handled ✅
- `refreshProjectDiscovery(name)` — route live, returns 200 ✅
- Error handling in `req()` → reads `err.message ?? statusText` ✅ consistent for all Lantern calls

---

## src/api/loom.ts — 2026-02-18 13:50 CST

### Traced calls

- `sendPrompt(prompt)` → `POST /prompt` → expected: `{trace_id, status}` → actual: `{trace_id, status}` → ✅ MATCH

- `getTraceStatus(traceId)` → `GET /status/{trace_id}` → expected: `TraceState {trace_id, status, action, user_prompt, plan, tasks, artifacts, created_at, updated_at, error?}` → actual: `{trace_id, status, action, iteration, tasks, artifacts, error, created_at, updated_at}` → ❌ **MISMATCH**
  - `user_prompt` NEVER present in any real trace response (verified across success, running, await_user states)
  - `plan` NEVER present in any real trace response
  - `iteration` present in actual but absent from `TraceState` type (unused by code, minor)

- `confirmTrace(traceId, approved, response)` → `POST /confirm/{trace_id}` → expected: void → actual: HTTP 404 with `{error: "Trace X not found"}` for bad id → ✅ MATCH (`req()` throws on 404 correctly)

- `cancelTrace(traceId)` → `DELETE /traces/{trace_id}` → expected: void (returns `true`/`false`) → actual: HTTP 200 `{trace_id, status: "cancelled", processes_killed: N}` always — even for nonexistent IDs → ⚠️ PARTIAL MATCH (see issues)

- `listHistory(limit)` → `GET /history?limit=N` → expected: `{runs?: TraceHistoryEntry[]}` where `TraceHistoryEntry = {trace_id, status, user_prompt, created_at, updated_at}` → actual top-level: `{runs: [...]}` ✅ → but entry shape: `{trace_id, status, created_at, updated_at}` → ❌ **MISMATCH**: `user_prompt` absent from ALL 10 verified history entries

- `listSchedules()` → `GET /schedules` → expected: `{schedules: ScheduledTask[] | Record<id, task>}` → actual: `{schedules: [...]}` (array) ✅ MATCH on top-level and array-branch logic
  - Item shape: `{id, schedule, action, enabled, enabled_override, last_fired, timezone}` — no `message`, `url`, `command`, `prompt` fields present
  - `ScheduledTask` declares those fields as optional so they come back `undefined` — ⚠️ LOW risk

- `toggleSchedule(id, enabled)` → `PATCH /schedules/{id}` → expected: void → actual: `{task_id, enabled, updated_at, processes_killed}` → ✅ MATCH (return value discarded)
  - Note: response uses `task_id` while GET /schedules uses `id` — field name inconsistency in Loom's own API

- `createSchedule(input)` → `POST /api/schedules` (Vite plugin — cannot curl) → uses `(data as {error?: string}).error` pattern → ⚠️ same `err.error` vs `err.message` mismatch noted in lantern.ts audit

- `deleteSchedule(id)` → `DELETE /api/schedules/{id}` (Vite plugin — cannot curl) → reads `(data as {error?: string}).error` → ⚠️ same pattern

---

### Issues found

1. **[CRITICAL]** `getTraceStatus()` — `TraceState.user_prompt` and `TraceState.plan` are declared in the TypeScript type but Loom **never returns them**. Verified across 4+ real traces (success, running, await_user, paused). Any UI component rendering `trace.user_prompt` or `trace.plan` will show `undefined` silently. `src/api/loom.ts:28`, `src/types.ts:102-113`. Fix: remove from `TraceState` or query a different endpoint (e.g. `/trace/{id}/plan`).

2. **[HIGH]** `listHistory()` — `TraceHistoryEntry.user_prompt` is declared in the type but absent from ALL history list entries (verified: 0/10 entries contain it). The jobs history panel almost certainly renders prompts as blank. `src/api/loom.ts:46-49`, `src/types.ts:131-137`. Fix: remove field from type, or check if Loom has a separate history detail endpoint.

3. **[LOW]** `cancelTrace()` — `DELETE /traces/{id}` returns HTTP 200 with `{status: "cancelled"}` even for nonexistent trace IDs. Loom appears to echo-cancel any ID it receives. Side effect observed: cancelling `"fake-trace-id-000"` left a ghost `{status: "running"}` record in history. `cancelTrace()` correctly returns `true` but may mislead callers into thinking a real in-flight trace was stopped. `src/api/loom.ts:33-39`.

4. **[LOW]** `listSchedules()` — `ScheduledTask.message`, `.url`, `.command`, `.prompt` fields (action-specific config) are absent from Loom's `GET /schedules` response. If the schedule-edit UI pre-populates form fields from existing schedule data, they'll all be blank, meaning any save would submit empty action config. `src/api/loom.ts:52-60`, `src/types.ts:139-151`.

5. **[LOW]** `toggleSchedule()` response: `PATCH /schedules/{id}` returns `task_id` but `GET /schedules` items use `id`. Loom internal field-name inconsistency. No code impact since return is discarded, but a future refactor that uses the PATCH response would need to alias `task_id` → `id`. `src/api/loom.ts:62`.

6. **[LOW]** `createSchedule()` / `deleteSchedule()` — Vite plugin calls use `(err).error` for error messages (same pattern found in `scaffoldTool()` in lantern.ts). If plugin errors include a human-readable `message` field, it's silently dropped. `src/api/loom.ts:82-100`.

7. **[INFO]** `base()` function calls `getLoomBaseUrl()` which is a stub that always returns `'/loom-api'`. Each request makes an unnecessary async hop. Zero functional impact but every Loom call awaits `base()` before every fetch. `src/api/loom.ts:4-6`.

8. **[INFO]** `GET /health` exists on Loom (`{status: "ok", service: "loom", version: "0.1.0"}`) but is never called by GlowForge. Could be used in the health strip.

---

### Verified OK

- `sendPrompt()` → `POST /prompt` shape correct, returns `{trace_id, status}` ✅
- `confirmTrace()` → `POST /confirm/{id}` route exists, 404 properly propagated ✅
- `cancelTrace()` → `DELETE /traces/{id}` error path swallowed intentionally (returns bool) ✅
- `listHistory()` top-level → reads `r.runs ?? r.history ?? []` — defensive dual-key handling correct ✅
- `listSchedules()` → array branch correctly used (Loom returns array, not Record) ✅
- `toggleSchedule()` → `PATCH /schedules/{id}` returns 200 with correct semantics ✅
- Error handling in shared `req()` → 404 throws with `err.message`, all Loom error shapes produce readable throws ✅

---

## src/api/browser.ts — 2026-02-18 13:55 CST

Files traced: `src/api/browser.ts` (client) + `src/server/browser-api-plugin.ts` (route handler) + `src/server/browser-queue.ts` (queue store)

### Traced calls

- `enqueueTask(input)` → `POST /api/browser/tasks` → expected: `BrowserTask {id, created_at, ttl_seconds, action, target_url?, params?}` → actual HTTP 201: `{id, created_at, ttl_seconds, action, target_url, params}` → ✅ SHAPE MATCH (201 is still `res.ok`) — **but see callback bug below**

- `getQueueStatus()` → `GET /api/browser/queue` → expected: `QueueStatus {pending, total_in_queue, results_stored, recent_results: TaskResult[]}` → actual: `{pending, total_in_queue, results_stored, recent_results: []}` → ✅ MATCH

- `getPendingTasks()` → `GET /api/browser/queue/pending` → expected wrapper `{tasks: BrowserTask[]}`, reads `data?.tasks ?? []` → actual: `{tasks: [...]}` → ✅ MATCH

- `getResults(limit)` → `GET /api/browser/queue/results?limit=N` → expected wrapper `{results: TaskResult[]}`, reads `data?.results ?? []` → actual: `{results: [...]}` → ✅ MATCH

- `clearQueue()` → `DELETE /api/browser/queue` → expected: void → actual: HTTP 200 `{ok: true, message: "Queue cleared"}` → ✅ MATCH (return discarded)

- `dispatchNavigate/ScrollFeed/Screenshot/Scrape/Like/Follow()` — all thin wrappers over `enqueueTask()` → same path as above, no additional routes

---

### Issues found

1. **[CRITICAL]** `browserQueue.enqueue()` silently drops `callback_url`, `source`, and `correlation_id` from stored tasks. The plugin correctly extracts these fields from the HTTP body and passes them to `enqueue()`, but `enqueue()` only sets `{id, created_at, ttl_seconds, action, target_url, params}` — the three extra fields are never written to the task object. Consequence: `dequeue()` checks `if (task.callback_url)` which is always `undefined`, so no task is ever stored in `completedTasks`, and `_fireCallback()` is never invoked. **Twitter Intel's entire callback flow is broken** — it submits tasks with `callback_url: "http://localhost:8410/browser-result"` that will never be called. Confirmed via live curl: POST with `callback_url` returns task with those fields absent. Fix: add `callback_url: input.callback_url, source: input.source, correlation_id: input.correlation_id` to the task object in `browser-queue.ts:enqueue()`.

2. **[LOW]** Client-side `BrowserTask` interface in `browser.ts` is missing `callback_url`, `source`, `correlation_id` fields that exist in the queue store's `BrowserTask`. The UI Queue drawer cannot surface these fields on tasks it displays. `src/api/browser.ts:10-18` vs `src/server/browser-queue.ts:9-21`.

3. **[LOW]** `enqueueTask()` plugin returns HTTP 201 Created (not 200). Client `req()` only checks `!res.ok` — 201 is ok so no error thrown, works correctly. But no code comment documents this; a future refactor that checks `res.status === 200` specifically would break. `src/server/browser-api-plugin.ts:~131` (the `json(res, 201, task)` call).

4. **[INFO]** Plugin has two sequential regex matches against the same pattern (`/^\/api\/browser\/results\/([^/]+)$/`) stored in separate variables `resultsMatch` and `singleResultMatch`. One gates POST, other gates GET. No logic bug, but confusing to read — could be a single if-else chain. `src/server/browser-api-plugin.ts:~128,~158`.

5. **[INFO]** Error shape consistency: this plugin uses `{error: "..."}` and the client reads `(err as {error?: string}).error` — ✅ correctly matched. (Different from the Lantern/Loom pattern where backend uses `{message: "..."}` but some clients read `.error`.)

---

### Verified OK

- `GET /api/browser/queue` → `{pending, total_in_queue, results_stored, recent_results}` shape correct ✅
- `GET /api/browser/queue/pending` → `{tasks: [...]}` wrapper correct ✅
- `GET /api/browser/queue/results?limit=N` → `{results: [...]}` wrapper correct ✅
- `DELETE /api/browser/queue` → 200 OK, queue emptied ✅
- `POST /api/browser/tasks` → 201, returns full task object ✅
- 400 on missing `action` field — handled by plugin, thrown by `req()` ✅
- `GET /api/browser/results/:id` → 404 with `{error: "No result for task_id"}` when absent — error shape matches `req()` reader ✅
- All error responses use `{error: "..."}` consistently; client reads `.error` ✅

---

## src/api/build.ts — 2026-02-18 13:58 CST

Files traced: `src/api/build.ts` (client) + `src/server/build-plugin.ts` (route handler)

### Traced calls

- `fetchBuildStatus(toolId)` → `GET /api/build/{toolId}` → expected: `BuildManifest | null` (null on 404) → actual HTTP 200: `{tool_id, name, prompt, status, started_at, progress, phases[], log[]}` → ✅ MATCH; actual HTTP 404: `{error, tool_id, path}` → client returns `null` ✅

- `hasBuildManifest(toolId)` → `GET /api/build/{toolId}/exists` → expected: `{exists: boolean} | null`, reads `result?.exists ?? false` → actual: always HTTP 200 `{exists: bool, path: string}` → ✅ MATCH (extra `path` field ignored; `null` branch in client unreachable since plugin never 404s this route)

- `fetchBuildStatuses(toolIds)` → parallel `GET /api/build/{id}/exists` then `GET /api/build/{id}` → no additional routes; same shape analysis as above → ✅ MATCH

- Convenience helpers (`getCurrentPhase`, `getCurrentStep`, `buildSummary`, `computeProgress`, etc.) → **no HTTP calls** — pure derivation from `BuildManifest` ✅

- Write endpoint `POST /api/build/{toolId}/write` — **not in `build.ts`**; plugin route exists at `/write` suffix, called directly by Loom agents outside this client

---

### Issues found

1. **[HIGH]** ENDPOINTS.md documents the write route as `POST /api/build/{toolId}` but the plugin actually handles `POST /api/build/{toolId}/write`. Confirmed via live curl: `POST /api/build/test-dry-run-only` → HTTP 404; `POST /api/build/test-dry-run-only/write` → HTTP 200. Any Loom agent or external caller following the documented route will fail silently with a 404 that falls through to the Vite default handler. `src/server/build-plugin.ts:~137` (the `writeMatch` regex). Fix: update ENDPOINTS.md to document `/write` suffix, or add a route handler for the bare `POST /api/build/{toolId}` path.

2. **[HIGH]** `buildYamlPath()` resolves `~/tools/{toolId}/build.yaml` using the lowercase Lantern tool ID (e.g. `ghostgraph`, `glowforge`, `loom`) but actual tool directories on disk use capitalized names (`GhostGraph`, `GlowForge`, `Loom`). The paths are case-sensitive: `~/tools/ghostgraph/` does not exist, only `~/tools/GhostGraph/` does. Consequence: `GET /api/build/ghostgraph` checks the wrong path and always returns 404, even if a `build.yaml` were placed in `~/tools/GhostGraph/`. `hasBuildManifest('ghostgraph')` always returns `false` for capitalized-directory tools. Only tools scaffolded by GlowForge's wizard (which creates lowercase directories matching the id) can ever have a functioning build.yaml. `src/server/build-plugin.ts:buildYamlPath()`. Fix: resolve against display name by looking up the tool in Lantern's registry, or use a case-insensitive directory search.

3. **[LOW]** `parseBuildYaml()` validates required top-level scalar fields but blindly casts `phases` and `log` arrays: `raw.phases as BuildManifest['phases']`. Malformed phase objects (missing required `id`, `name`, `status`) are passed through unvalidated. UI components that access `phase.id` or `phase.status` without null guards will throw or render incorrectly. `src/server/build-plugin.ts:78-79`.

4. **[INFO]** `GET /api/build/{toolId}/exists` response includes `path` field (full filesystem path like `/home/ryan/tools/glowforge/build.yaml`). This leaks the server's directory structure to any client that reads the response. The `build.ts` client ignores this field; it's only visible in the raw JSON. `src/server/build-plugin.ts:~106`.

5. **[INFO]** Plugin `buildYamlPath()` sanitizer strips all non-`[a-zA-Z0-9_-]` characters, preventing path traversal. Combined with the regex `[^/]+` capturing group, directory traversal via `../` is impossible. Path safety is sound.

6. **[INFO]** `req()` in `build.ts` reads `(err as {error?: string}).error` — correctly matches plugin error shape `{error: "..."}`. Consistent with browser.ts error pattern.

---

### Verified OK

- `GET /api/build/{toolId}` → correct `BuildManifest` shape returned, `null` on 404 ✅
- `GET /api/build/{toolId}/exists` → always HTTP 200, `{exists: bool}` ✅
- `GET /api/build/nonexistent/exists` → HTTP 200 `{exists: false}` (no 404 leakage) ✅
- Plugin not proxied — served in-process by `buildPlugin()` Vite middleware ✅
- Error format `{error: "..."}` consistent with `build.ts` reader ✅
- Path traversal protection via regex + sanitizer ✅
- `fetchBuildStatuses()` two-phase probe pattern avoids 404 console spam ✅

---

## src/components/ToolRegistry/ToolList.tsx — 2026-02-18 14:02 CST

### Traced calls

- `listTools()` → `GET /lantern-api/api/tools` → polling every **10 seconds** via `setInterval(load, 10_000)` with `clearInterval` cleanup ✅. Also triggered on: mount, manual refresh button click, parent `refreshKey` bump. Response shape verified in lantern.ts audit ✅

- `fetchBuildStatuses(toolIds)` → parallel `GET /api/build/{id}/exists` + `GET /api/build/{id}` for IDs with manifests → called **once on initial load** (guarded by `buildCheckDone.current` ref), then every **3 seconds** when any `isActiveBuild` manifest is present (separate `setInterval` with `clearInterval` cleanup). Response shape verified in build.ts audit ✅

---

### Polling analysis

**Normal (no active builds):**
- 1 × `GET /api/tools` every 10s = ~0.1 req/s baseline

**Active build in progress:**
- 1 × `GET /api/tools` every 10s
- 9 × `GET /api/build/{id}/exists` + K × `GET /api/build/{id}` every 3s (where K = tools with active builds, currently K=1)
- With N=9 tools, K=1 active: 10 requests per 3s = ~3.3 req/s during active builds
- All `/exists` calls are filesystem `stat` via Vite plugin — cheap, no backend hit

**No infinite loops.** Both intervals have proper `clearInterval` cleanup in `useEffect` return.

---

### Issues found

1. **[LOW]** `refreshKey` effect has suppressed missing dep: `}, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps` at line 80. `load` is used inside the effect but excluded from deps. In practice `load` is stable (memoized with `useCallback` with stable deps: `loadBuilds` → `onBuildManifestUpdate` → stable `useCallback(fn, [])` in App.tsx), so stale closure risk is minimal. But the eslint-disable is masking a real lint warning. Fix: add `load` to deps or restructure.

2. **[LOW]** `buildCheckDone.current` never resets after initial mount. If new tools are registered after mount (via NewToolModal), `load()` updates `toolIdsRef.current` but does NOT call `loadBuilds` (gate is already `true`). New tools' build status is only discovered when the 3s active-build poller is running (which only runs if something else is already building). If no active builds exist, a freshly scaffolded tool's `build.yaml` won't appear in `buildManifests` until the user navigates away and back. `ToolList.tsx:50-62`.

3. **[INFO]** `handleRetry()` at line 92 calls `await load()` without try/catch at the call site. `load()` catches its own errors internally (sets `error` state and returns), so no unhandled rejection in practice. Cosmetically inconsistent with the surrounding error model.

4. **[INFO]** The audit list references `src/components/BrowserQueue/QueueDrawer.tsx` but that path does not exist. The actual browser queue UI lives at `src/components/ToolRegistry/BrowserQueueDrawer.tsx`. Audit list should be updated to point to the correct file.

5. **[INFO]** `ScheduleManager` (child, always rendered) imports `listSchedules` and `toggleSchedule` from `loom.ts` and sets up its own `useEffect` with polling. Its API calls are independent of ToolList's intervals. Not traced here — treated as separate component.

6. **[INFO]** `onBuildManifestUpdate` callback stability: App.tsx wraps this in `useCallback(fn, [])` (empty deps, stable dispatcher call). This keeps `loadBuilds` and `load` stable across renders, preventing spurious interval restarts. ✅

---

### Verified OK

- 10s `listTools()` interval: correct interval, cleanup, error state, no-op on empty `load` failure ✅
- 3s `fetchBuildStatuses()` interval: only active when `hasActiveBuilds === true`, cleans up on deactivation ✅
- `buildCheckDone.current` ref: correctly prevents `loadBuilds` from running on every 10s poll ✅
- `toolIdsRef.current` ref: correctly updated in `load()` so 3s poller always uses latest tool ID list ✅
- Both intervals return cleanup functions — no leaked intervals ✅
- `onBuildManifestUpdate` propagates manifests to App.tsx for detail panel switching ✅

---

## src/components/ToolRegistry/ToolDetail.tsx — 2026-02-18 14:06 CST

### Traced calls

**Main component (all tabs share these):**
- `getTool(toolId)` → `GET /lantern-api/api/tools/{toolId}` → expected: `ToolDetail` → actual: all declared fields present ✅ MATCH. Called on mount, after start/stop/restart.
- `getProjectHealth()` then `all[toolId]` → `GET /lantern-api/api/health` → expected: `Record<id, ProjectHealthStatus>` → actual: `Record<display_name, ProjectHealthStatus>` → ❌ **MISMATCH** (see issue #1)
- `activateTool(tool.name)` → `POST /lantern-api/api/projects/{name}/activate` → uses display name ✅
- `deactivateTool(tool.name)` → `POST /lantern-api/api/projects/{name}/deactivate` → uses display name ✅
- `restartTool(tool.name)` → `POST /lantern-api/api/projects/{name}/restart` → uses display name ✅
- `deleteProject(tool?.name ?? toolId)` → `DELETE /lantern-api/api/projects/{name}` → uses display name ✅ (fallback to `toolId` is unreachable — delete button hidden when `tool` is null)

**OverviewTab:** No API calls. Health data received via prop from parent. Notes use `localStorage` only.

**EndpointsTab:** No GlowForge API calls. Inline tester fires `fetch()` directly to `tool.base_url ?? tool.upstream_url` — arbitrary method/path. Intentional pass-through to the tool's service.

**DocsTab:**
- `getToolDocs(toolId)` → `GET /lantern-api/api/tools/{toolId}/docs` → expected: `DocFile[]` from `{data: {docs: [...]}}` → actual: docs items have `{content, exists, kind, mtime, path, size, source}` → ✅ MATCH (per lantern.ts audit, `error` field absent but handled with `?? null`)
- Called once on tab open (`useEffect` with `[toolId]`), no polling

**SchedulesTab:**
- `listSchedules()` → `GET /loom-api/schedules` → shape verified in loom.ts audit ✅
- `toggleSchedule(id, !currentEnabled)` → `PATCH /loom-api/schedules/{id}` ✅
- `createSchedule(form)` → `POST /api/schedules` (Vite plugin) ✅ — but reads `err.error` not `err.message` (pre-existing pattern)
- `deleteSchedule(id)` → `DELETE /api/schedules/{id}` (Vite plugin) ✅
- Called once on tab open, no polling

**LogsTab:**
- `fetch(LANTERN_BASE + '/api/projects/{toolName}/logs', { signal })` → streams SSE from Lantern
- Route confirmed live: returns `Content-Type: text/event-stream`, chunked, `data: ...` format ✅
- Uses display name `toolName` for Lantern route — correct ✅
- No polling: persistent streaming connection with `AbortController` cleanup ✅

**TimelineTab:** No API calls. Uses locally accumulated `healthHistory` array (derived from health polls).

---

### Issues found

1. **[CRITICAL]** Health lookup uses `toolId` (lowercase id, e.g. `"ghostgraph"`) to key into `getProjectHealth()` result, but the API returns health keyed by **display name** (e.g. `"GhostGraph"`). Confirmed live: keys are `['GhostGraph', 'GlowForge', 'Loom', 'git-chronicle', 'lantern']` — only `git-chronicle` and `lantern` match their ids. For all capitalized-name tools, `all[toolId]` → `undefined` → `null`. Health panel always shows "unknown", latency is never shown, `refreshHealth()` 15s poll produces no useful data. Affects both initial load `useEffect` (line ~55) and `refreshHealth()` (line ~42). Fix: look up by `tool.name` after the tool is loaded, e.g. `all[tool.name] ?? all[toolId] ?? null`.

2. **[MEDIUM]** `refreshHealth()` 15-second polling interval is set up in a `useEffect(() => { ... }, [toolId])` but `refreshHealth` itself is not in the dependency array. Since `refreshHealth` is defined inside the component body (not `useCallback`), the interval captures the closure at the time the effect first runs (before `tool` is loaded). In this specific case it's safe because `refreshHealth` only reads `toolId` (prop, stable) and uses `setHealth`/`setHealthHistory` (stable dispatchers) — but if `refreshHealth` were ever updated to use `tool` state, it would silently use a stale value. A React `react-hooks/exhaustive-deps` lint violation that's currently harmless.

3. **[LOW]** `SchedulesTab.isRelevantSchedule()` checks `s.url`, `s.message`, `s.command` to match schedules to a tool, but `GET /schedules` never returns these fields (confirmed in loom.ts audit — absent from all 7 live schedules). These checks are always `false`; matching relies entirely on `s.id` string matching. The dead checks add noise but no functional impact.

4. **[LOW]** `ProjectHealthStatus` TypeScript type (src/types.ts:69) is missing the `history` field that Lantern actually returns in the health response. The history array (10+ past readings) is silently dropped. The component doesn't use it, but it's lost data that could improve the health timeline tab.

5. **[INFO]** LogsTab correctly avoids sending `Accept: text/event-stream` header (which would trigger Phoenix 406). Uses `fetch()` default headers (`Accept: */*`) — confirmed to work against live `/api/projects/{name}/logs` which returns proper SSE stream.

6. **[INFO]** The initial mount fires two parallel requests via `Promise.all([getTool, getProjectHealth])`. If `getTool` resolves before health, there's a brief moment where `tool` is set but `health` is still null. This is cosmetic (health renders as "unknown" briefly). Expected behavior.

---

### Verified OK

- `getTool(toolId)` → full `ToolDetail` shape correct, all expected fields present ✅
- `activateTool/deactivateTool/restartTool/deleteProject` — all use `tool.name` (display name) ✅ correct
- `getToolDocs(toolId)` — shape correct, missing `error` field handled gracefully ✅
- `listSchedules/toggleSchedule` — shapes verified in loom.ts audit ✅
- `LogsTab` streaming — SSE format correct, AbortController cleanup ✅
- Health poll: 15s interval, correct cleanup on `toolId` change ✅ (but lookup uses wrong key — see issue #1)

---

## src/components/ToolRegistry/ToolCard.tsx — 2026-02-18 14:10 CST

### Traced calls

- `handleStart()` → `activateTool(tool.id)` → `POST /lantern-api/api/projects/{id}/activate`
  - Tool has `id="ghostgraph"` → route `/api/projects/ghostgraph/activate` → ❌ **HTTP 404** (`Project 'ghostgraph' not found`)
  - Should use `tool.name` (`"GhostGraph"`) → route `/api/projects/GhostGraph/activate` → HTTP 422 (runtime error, reachable route)

- `handleStop()` → `deactivateTool(tool.id)` → `POST /lantern-api/api/projects/{id}/deactivate`
  - `id="ghostgraph"` → ❌ **HTTP 404**
  - `name="GhostGraph"` → HTTP 200 ✅

- `handleRestart()` → `restartTool(tool.id)` → `POST /lantern-api/api/projects/{id}/restart`
  - `id="ghostgraph"` → ❌ **HTTP 404**
  - `name="GhostGraph"` → HTTP 422 (reachable route) ✅

No `deleteProject` call in ToolCard — delete is ToolDetail-only. Correct.

---

### Issues found

1. **[CRITICAL]** All three lifecycle handlers (`handleStart`, `handleStop`, `handleRestart`) pass `tool.id` to `activateTool/deactivateTool/restartTool`. These functions route to `/api/projects/{name}/...` which Lantern matches by **display name**, not id. For tools where `id ≠ name`, all ToolCard action buttons silently 404.

   **Affected tools (id ≠ name):** GhostGraph, GlowForge, Loom — 3 of 9 registered tools.
   **Working tools (id == name):** austinselite, austinselite-next, auto-shorts, git-chronicle, lantern, twitter-intel — 6 of 9.

   Notably GlowForge itself and Loom are among the broken tools — the core platform's own start/stop buttons don't work from the sidebar card.

   **Contrast with ToolDetail.tsx** (audited prior): identical operations use `tool.name` correctly — `activateTool(tool.name)`, `deactivateTool(tool.name)`, `restartTool(tool.name)`. ToolCard uses `ToolSummary` which has `tool.name` available — the fix is a one-word change in each handler.

   **Failure mode:** `.catch(console.error)` silently swallows the 404. `onRefresh()` is called regardless, tool list refreshes, status unchanged. User sees nothing — the button appears to work but doesn't. No error toast, no UI feedback.

   Fix: change `tool.id` → `tool.name` in all three handlers (lines 15, 20, 25).

2. **[LOW]** All three handlers use `.catch(console.error)` — errors are logged to the browser console only, not shown to the user. Even for working tools, if a start/stop/restart fails (e.g. HTTP 422 from a bad runtime state), the user gets no visual feedback. The action silently fails and `onRefresh()` is called, giving the false impression the operation completed. Fix: surface errors via a local `error` state and display a brief error toast or badge.

3. **[LOW]** `onRefresh()` is called unconditionally after the await — even if the lifecycle call threw and was caught. This means a failed start still triggers a list reload, which is harmless but potentially confusing (status doesn't change despite the refresh flicker).

4. **[INFO]** `ToolCard` receives a `ToolSummary` prop (from `listTools()`), which includes `tool.name`. The fix (using `tool.name`) requires zero additional API calls — the name is already in the prop.

---

### Verified OK (for tools where id == name)

- `activateTool(tool.id)` works for `git-chronicle`, `lantern`, `twitter-intel`, etc. where id and name are identical ✅
- `deactivateTool(tool.id)` and `restartTool(tool.id)` same ✅
- Button visibility logic correct: restart+stop shown when `isRunning`, start shown otherwise ✅
- `e.stopPropagation()` on all handlers prevents card selection when clicking action buttons ✅

---

## src/components/LoomChat/ChatPanel.tsx — 2026-02-18 14:12 CST

Files traced: `ChatPanel.tsx` + `TraceCard.tsx` + `JobPanel.tsx` (ChatPanel delegates all API calls to these two children)

### Traced calls

**ChatPanel.tsx (direct):**
- `sendPrompt(prompt)` → `POST /loom-api/prompt` → expected: `{trace_id, status}` → actual: `{trace_id, status}` → ✅ MATCH. Error surfaced in UI.
- `cancelTrace(traceId)` → `DELETE /loom-api/traces/{traceId}` → fire-and-forget `.catch(() => {})` → ✅ intentional; Loom 200s on nonexistent IDs anyway.

**TraceCard.tsx (polling):**
- `getTraceStatus(traceId)` → `GET /loom-api/status/{traceId}` → polls every **1500ms** per active trace
  - Stops on TERMINAL_STATUSES (`['success', 'partial', 'failed', 'error']`) or on error ✅
  - Continues on `'paused'` and `'awaiting_input'` (correct — needs continued polling) ✅
  - `state?.plan` accessed in JSX but Loom never returns `plan` → block never renders ❌
  - `state.artifacts[task_id].output` accessed — ❌ shape mismatch (see issue #1)
- `confirmTrace(traceId, approved, response)` → `POST /loom-api/confirm/{traceId}` → error surfaced in UI ✅

**JobPanel.tsx (history):**
- `listHistory(20)` → `GET /loom-api/history?limit=20` → only on panel open, not on a timer
  - Returns `{runs: TraceHistoryEntry[]}` → reads `r.runs ?? r.history ?? []` ✅
  - History entries have `status: 'await_user'` but TraceStatus type and STATUS_ICON keys use `'awaiting_input'` → ⚠️ (see issue #3)
  - `entry.user_prompt` fallback `|| '(no prompt)'` handles missing field gracefully ✅

---

### Issues found

1. **[CRITICAL]** `ArtifactBlock` receives `output: string` but Loom actually returns `output: {_raw_text: "..."}` (an object/dict). `TaskArtifact.output` is typed as `string` in `types.ts` but live `/status/{id}` response delivers an object. `ArtifactBlock` immediately calls `output.split('\n')` → **TypeError: output.split is not a function** at runtime. Any trace with at least one completed task (`artifact.output` is set) will crash the `TraceCard` component. The actual text is at `artifact.output._raw_text`. `TraceCard.tsx` line rendering `<ArtifactBlock output={artifact.output} />`, `src/types.ts:TaskArtifact.output`. Fix: change type to `output?: {_raw_text: string} | string` and read `typeof output === 'object' ? output._raw_text : output`.

2. **[HIGH]** `state?.plan` check in `TraceCard.tsx` renders a plan display block, but Loom's `/status/{id}` never returns `plan` (confirmed across 5+ real traces — field is absent). The plan display is dead UI. Same root cause as `TraceState.user_prompt` noted in loom.ts audit. The plan block uses `state.plan` which is `undefined`, so the `&&` short-circuits and nothing renders — silent dead code, not a crash. But intended UX (showing Loom's plan while executing) is completely missing.

3. **[MEDIUM]** Status string inconsistency between Loom endpoints: `/history` returns `status: 'await_user'` for traces waiting for input, but `/status/{id}` for the same trace returns `status: 'awaiting_input'`. The `TraceStatus` type includes `'awaiting_input'` but not `'await_user'`. `STATUS_ICON` in `JobPanel.tsx` has no `'await_user'` key → history shows `<Clock>` icon instead of the appropriate awaiting icon. Confirmed live: traces `clw-138b92a3ced0` and `clw-32f3c8359aaa` show `'await_user'` in history but `'awaiting_input'` in status poll. This is a Loom API inconsistency that manifests as incorrect status rendering in the job history panel.

4. **[LOW]** Polling accumulates across non-terminal traces. `POLL_MS = 1500` per TraceCard instance. Live session has traces in `'running'` and `'paused'` (non-terminal) — all continue to be polled. With the current session of 4+ running/paused traces: 4 × (1000/1500) ≈ 2.7 req/s to Loom continuously even while the user is idle. Traces in `'paused'` are unlikely to change but still polled. Possible fix: increase poll interval for `'paused'` state.

5. **[LOW]** `cancelledIds` Set persisted to session storage via `saveSession()` on every change but never pruned. After many sessions with cancelled traces, session storage accumulates an unbounded list of IDs. Minor storage leak.

6. **[INFO]** `handleLoadHistory` in ChatPanel correctly falls back to `entry.user_prompt || '(trace ${id.slice(0,8)})'` — gracefully handles the missing `user_prompt` field from Loom history. The trace card shows a partial ID instead of the prompt, which is degraded UX but not a crash.

7. **[INFO]** `TERMINAL_STATUSES = ['success', 'partial', 'failed', 'error']` — does not include `'paused'`, `'awaiting_input'`, or `'awaiting_confirmation'`. Poll loop correctly continues for these states.

8. **[INFO]** `useRotatingVerb` timer (`ROTATE_MS = 3000`) is a second `setInterval` per active TraceCard for cosmetic verb cycling. Runs independently of the poll timer. Properly cleaned up via `clearInterval` on unmount. No correctness impact.

---

### Verified OK

- `sendPrompt()` → shape correct, error surfaced in UI ✅
- `cancelTrace()` → fire-and-forget, appropriate for cancel semantics ✅
- `getTraceStatus()` poll stops on terminal status, clears interval on error ✅
- `confirmTrace()` → error surfaced in UI ✅
- `listHistory(20)` → `r.runs ?? r.history ?? []` defensive dual-key read ✅
- JobPanel only fetches history on panel open — no background polling ✅
- Both `setInterval` timers in TraceCard have `clearInterval` cleanup on unmount/cancel ✅

---

## src/components/ToolRegistry/BrowserQueueDrawer.tsx — 2026-02-18 14:16 CST

Note: audit checklist references `src/components/BrowserQueue/QueueDrawer.tsx` — actual path is `src/components/ToolRegistry/BrowserQueueDrawer.tsx`.

### Traced calls

- `getQueueStatus()` → `GET /api/browser/queue` → expected: `QueueStatus {pending, total_in_queue, results_stored, recent_results}` → actual: `{pending: 0, total_in_queue: 0, results_stored: 0, recent_results: []}` → ✅ MATCH

- `getPendingTasks()` → `GET /api/browser/queue/pending` → expected: `{tasks: BrowserTask[]}`, reads `tasks` array → actual: `{tasks: []}` → ✅ MATCH

- `getResults(30)` → `GET /api/browser/queue/results?limit=30` → expected: `{results: TaskResult[]}`, reads `results` array → actual: `{results: []}` → ✅ MATCH

- `enqueueTask({action, target_url, params, ttl_seconds})` → `POST /api/browser/tasks` → expected: HTTP 201, `BrowserTask {id, created_at, ...}` → actual: HTTP 201 `{id, created_at, ttl_seconds, action, target_url, params}` → ✅ MATCH. `callback_url` not sent (intentional — manual dispatch, not callback-driven).

- `clearQueue()` → `DELETE /api/browser/queue` → expected: HTTP 200 `{ok: true}` → actual: HTTP 200 `{ok: true, message: "Queue cleared"}` → ✅ MATCH (extra `message` ignored)

---

### Polling analysis

**When drawer is open:**
- `setInterval(refresh, 5000)` → `getQueueStatus()` + tab-specific (`getPendingTasks()` or `getResults(30)`) every **5 seconds**
- Cleanup: `clearInterval` on close ✅

**When drawer is collapsed (passive badge):**
- `setInterval(getQueueStatus, 15000)` → status-only every **15 seconds** for pending count badge
- Cleanup: `clearInterval` ✅

Both intervals have proper cleanup. No infinite loops.

---

### Issues found

1. **[LOW]** `handleClear()` has no try/catch: `await clearQueue()` is called without error handling. If the plugin returns a non-200 or the fetch fails, the unhandled rejection propagates up from the button's `onClick` handler → browser console unhandled promise rejection. Fix: wrap in try/catch and set `setError(...)`. `BrowserQueueDrawer.tsx:handleClear()`.

2. **[LOW]** Double tab-data load on tab switch while open. When `tab` state changes: (a) `useEffect([tab, open, loadTabData])` fires `loadTabData()`, AND (b) since `tab` → `loadTabData` changes → `refresh` changes → `useEffect([open, refresh])` also re-runs, firing `refresh()` (which includes `loadTabData()` again) + restarting the 5s interval. Two near-simultaneous requests to the same endpoint per tab switch. Not a crash — both requests succeed — but the second response overwrites the first (same data). Fix: use a stable `refresh` reference or deduplicate.

3. **[INFO]** `QueueStatus.recent_results` (array of up to 20 `TaskResult[]`) is fetched with every `getQueueStatus()` call (every 5s open, 15s closed) but **never used in the render**. The Results tab fetches separately via `getResults(30)`. The `recent_results` field in `status` state is always ignored — wasted bandwidth on every status poll. The queue store data is in-memory so cost is minimal, but worth noting.

4. **[INFO]** Passive badge poll (15s `getQueueStatus`) continues firing even when the browser tab is backgrounded — no `document.visibilitychange` guard. Minor.

5. **[INFO]** `DispatchForm` sends only `{action, target_url, params, ttl_seconds}` — correctly omits `callback_url`, `source`, `correlation_id`. Manual dispatch via the UI is intentionally fire-and-forget. The callback bug found in browser-queue.ts (enqueue drops callback fields) is irrelevant here.

---

### Verified OK

- `GET /api/browser/queue` → `{pending, total_in_queue, results_stored, recent_results}` shape correct ✅
- `GET /api/browser/queue/pending` → `{tasks: [...]}` wrapper correct ✅
- `GET /api/browser/queue/results?limit=30` → `{results: [...]}` wrapper correct ✅
- `POST /api/browser/tasks` → HTTP 201, `{id, ...}` shape correct, `task.id` stored for success flash ✅
- `DELETE /api/browser/queue` → HTTP 200 ✅
- `handleDispatch` → try/catch with `setDispatchError`, JSON parse guard on params ✅
- Open/closed timer transition → clean clearInterval on open-state change ✅
- Error state surfaced in status bar when `getQueueStatus()` fails ✅

---

## extension/background.js + extension/lib/queue-client.js — 2026-02-18 14:20 CST

Files traced together (background.js orchestrates; queue-client.js makes all HTTP calls).
Actual path: `~/tools/browser/extension/` (not inside GlowForge repo — separate browser extension project).

### Traced calls

- `fetchTask()` → `GET {baseUrl}/api/browser/tasks` → expected: task object on 200, null on 204/404/error
  - 204 (empty queue): handled before `res.json()` — returns `null` correctly ✅
  - 200: returns `{id, created_at, ttl_seconds, action, target_url, params}` ✅ MATCH
  - `callback_url` absent from response (confirmed live — dropped by `enqueue()` per browser.ts audit) — extension never sees it, which is fine since extension doesn't handle callbacks itself

- `postResult(taskId, result)` → `POST {baseUrl}/api/browser/results/{taskId}`
  - Body: `{status, data?, error?, completed_at, skipped?}`
  - Expected: HTTP 200 `{ok: true, result_id: string}`
  - Actual: HTTP 200 `{ok: true, result_id: "8a5a18ee-..."}` ✅ MATCH
  - `skipped` field in body silently dropped by plugin (only extracts `{status, data, error, completed_at}`) — harmless ✅
  - Extension only checks `res.ok`, ignores body ✅

- `fetchQueueStatus()` → `GET {baseUrl}/api/browser/queue`
  - Expected: `{pending, total_in_queue, results_stored, recent_results}` or `null` on error
  - Actual: `{pending: 0, total_in_queue: 0, results_stored: 0, recent_results: []}` ✅ MATCH
  - Extension reads `queueStatus.pending` for badge count ✅

### Polling analysis

- `pollLoop()` uses `setTimeout(pollLoop, 5000)` when connected, `15000` on error — no `setInterval`, fully sequential (next poll only schedules after current completes) ✅
- `chrome.alarms.create('keepAlive', { periodInMinutes: 1 })` keeps service worker alive; restarts `pollLoop` if killed ✅
- `isRunning` flag prevents concurrent task execution — extension runs one task at a time ✅

---

### Issues found

1. **[MEDIUM]** `isRunning` guard has no timeout. If `executeTask()` hangs indefinitely (e.g. network stall inside content script), `isRunning` stays `true` forever. Subsequent `poll()` calls skip task fetch: `if (isRunning) return`. The extension stops processing all tasks silently. No watchdog timer resets `isRunning` after a deadline. `background.js:runTask()`. Fix: add a `setTimeout` that forces `isRunning = false` after a max duration (e.g. 60s).

2. **[MEDIUM]** `postResult()` has no retry logic. If GlowForge is temporarily unreachable when posting a result (network blip, dev server restart), the result is lost permanently — `postResult()` catches the error, logs a warning, returns `false`, and the caller discards the return value. For Twitter Intel workflows that depend on `callback_url` results (though that flow is already broken by the `enqueue()` bug), this means silent data loss. `queue-client.js:postResult()`.

3. **[LOW]** `fetchTask()` sends `Content-Type: application/json` header on a GET request. GETs should not have a Content-Type (no body to describe). Plugin ignores the header, so no functional impact. `queue-client.js:fetchTask()` line 9.

4. **[LOW]** `TEST_CONNECTION` message handler calls `client.fetchQueueStatus().then(...)` with no `.catch()`. If `fetchQueueStatus()` throws an exception (as opposed to returning `null`), the promise rejection is unhandled. `fetchQueueStatus()` catches internally and returns `null`, so this path is currently unreachable — but it's a fragile assumption. `background.js:TEST_CONNECTION handler`.

5. **[LOW]** Service worker sleep gap: Chrome extension service workers can be killed 30s after last activity, before the 1-minute keepAlive alarm fires. New tasks queued during that ~30s gap will wait up to 1 minute before the alarm restarts polling. Documented in code but not mitigated. Using Chrome's native WebSocket or persistent background pages would fix it but have other tradeoffs.

6. **[INFO]** Extension uses `baseUrl` from `chrome.storage.local.glowforgeUrl` — no default/fallback URL. If the user hasn't configured it, `client` is `null` and polling is a no-op. Clean design — no hardcoded port. ✅

7. **[INFO]** `getOrOpenTab()` waits up to 20s for tab load + 800ms settle. For tasks like `screenshot` or `scrape` that don't need a loaded page, this adds unnecessary latency. No mechanism to skip the wait for certain action types.

8. **[INFO]** Tab pool (`managedTabs`) reuses tabs by origin for `PERSISTENT_ORIGINS` (Twitter, LinkedIn, Reddit, etc.). Correct approach for logged-in sessions. ✅

---

### Verified OK

- `GET /api/browser/tasks` → HTTP 200 with task object, or 204 on empty queue ✅ (correctly handled by `fetchTask()`)
- `POST /api/browser/results/{id}` → HTTP 200 `{ok: true, result_id}` ✅
- `GET /api/browser/queue` → `{pending, ...}` shape correct ✅
- Full enqueue → dequeue → result post cycle verified live ✅
- Sequential poll loop (setTimeout chain, not setInterval) — no timing drift, no concurrent execution ✅
- 204 empty-queue response handled before `res.json()` call — no JSON parse error ✅
- Error handling in `fetchTask()` and `postResult()`: returns `null`/`false`, never throws ✅

---

## twitter-intel/twitter_intel/browser_executor.py — 2026-02-18 14:22 CST

### Traced calls

- `submit_task()` → `POST {GLOWFORGE_URL}/api/browser/tasks`
  - Body: `{action, target_url, params, ttl_seconds: 120, source: "twitter-intel", callback_url: CALLBACK_URL, correlation_id?}`
  - Expected: HTTP 201 `{id: str}` → reads `data.get("id")` ✅
  - Actual: HTTP 201 `{id, created_at, ttl_seconds, action, target_url, params}` ✅ MATCH
  - `callback_url` field is sent ✅ but silently dropped by `browserQueue.enqueue()` (confirmed in browser.ts audit) → callback NEVER fires ❌

- `submit_feed_scan()` → same `POST {GLOWFORGE_URL}/api/browser/tasks`
  - No `correlation_id`, uses global `CALLBACK_URL` ✅
  - Same callback-never-fires issue ❌

---

### Issues found

1. **[CRITICAL — cross-system]** `submit_task()` correctly sends `callback_url` in the POST body, but `browserQueue.enqueue()` in `browser-queue.ts` drops it silently (confirmed in browser.ts audit). All engagement callbacks (`/browser-result`) are never fired. `execute_plan()` submits actions and returns submission counts, but execution results are **permanently lost** — never returned to the tracker/bandit. The entire feedback loop (extension → callback → tracker → bandit reward) is broken at the GlowForge layer.

2. **[HIGH]** `GLOWFORGE_URL` defaults to `http://localhost:5274`. GlowForge actually runs at `http://127.0.0.1:41005` (Lantern-assigned port, confirmed live). Port 5274 is the `vite.config.ts` static fallback — not used when Lantern injects `PORT`. If `GLOWFORGE_URL` env var is not explicitly set, all `submit_task()` calls fail with `Connection refused`. Also accessible via `https://glowforge.glow`. Fix: default should be `https://glowforge.glow` or require explicit `GLOWFORGE_URL`. `browser_executor.py:29`.

3. **[MEDIUM]** `CALLBACK_URL` default is `http://localhost:{_self_port}/browser-result` (port 8410). This is the correct self-referential callback URL when twitter-intel runs locally. But since the callback mechanism is broken (issue #1), this URL is never called and the correctness of the address is moot.

4. **[LOW]** `_submit_single()` maps `"dwell"` to `action="scroll_feed"` with `target_url=post_url` and `params={scroll_times:1, max_items:0}`. A `scroll_feed` action navigating to a specific post URL and scrolling it doesn't cleanly model "dwell on this post" — it scrolls the feed at that post's URL. May not send the engagement signal intended.

5. **[LOW]** `submit_feed_scan()` and `orchestrate.submit_feed_scan_sync()` are duplicate implementations of the same operation (submit scroll_feed task). Different HTTP clients (async httpx vs sync httpx), different call patterns. Should be consolidated.

---

### Verified OK

- `POST /api/browser/tasks` with twitter-intel's body shape → HTTP 201 ✅ (curl confirmed)
- `resp.raise_for_status()` error handling ✅
- `data.get("id")` field exists in response ✅
- Rate limiter (`RateLimiter`) correctly slides 1-hour windows ✅
- `ACTION_DELAY` jitter between submissions (`asyncio.sleep`) ✅
- Exception handling in `execute_plan()` per-action try/except ✅

---

## twitter-intel/twitter_intel/orchestrate.py — 2026-02-18 14:22 CST

### Traced calls

- `submit_feed_scan_sync()` → `POST {GLOWFORGE_URL}/api/browser/tasks`
  - Body: `{action:"scroll_feed", target_url:"https://x.com/home", params:{scroll_times:5,max_items:30,collect:true}, ttl_seconds:120, source:"twitter-intel", callback_url:"{TWITTER_INTEL_URL}/browser-result"}`
  - Expected: HTTP 201 `{id: str}` → reads `resp.json().get("id")` ✅ MATCH
  - Callback dropped by enqueue() bug ❌

- `poll_for_result(task_id)` → `GET {GLOWFORGE_URL}/api/browser/results/{task_id}`
  - Polls every 3s up to 90s
  - On 404: silent retry ✅ (result not ready)
  - On 200: reads `result.get("data", {}).get("items", [])` — implicit contract with extension executor
  - Actual live response: HTTP 404 `{error: "No result for task_id"}` until extension posts result ✅ handled
  - ⚠️ Shape assumption: see issue #2

- `ingest_posts()` → `POST {TWITTER_INTEL_URL}/ingest` (self-call)
  - Body: `{posts: [...]}`
  - Expected: `{stored: int}` → reads `.get("stored", 0)` with fallback ✅

- `get_engagement_plan()` → `POST {TWITTER_INTEL_URL}/engagement-plan` (self-call)
  - Body: `{targets: [...], max_actions: 10}`
  - Expected: `{actions: [...]}` → reads `.get("actions", [])` ✅

- `execute_engagement()` → `POST {TWITTER_INTEL_URL}/engagement-execute` (self-call)
  - Body: `{plan: dict, sandbox: bool}`
  - Expected: `{submitted, total, succeeded, failed}` — reads `.get("submitted", 0)` with fallback ✅

- `run_cycle()` tracking step → `POST {TWITTER_INTEL_URL}/tracking/cycle` (self-call)
  - Expected: any JSON — non-fatal, wrapped in try/except ✅

---

### Issues found

1. **[HIGH]** `GLOWFORGE_URL` defaults to `http://localhost:5274`. Same stale default as `browser_executor.py`. GlowForge runs at `http://127.0.0.1:41005` (Lantern-managed port). Connection refused on default. `orchestrate.py:35`.

2. **[HIGH]** `poll_for_result()` assumes feed scan data is at `result["data"]["items"]`. This is an implicit contract with the extension's `task-executor.js` scroll_feed handler — nowhere in GlowForge's plugin or queue code is this shape enforced. If the executor stores data as `data.posts`, `data.feed`, or any other key, `poll_for_result()` silently returns `[]` and the cycle aborts with "no_posts". No schema validation, no logging of the actual data shape. `orchestrate.py:poll_for_result()`.

3. **[MEDIUM]** `run_cycle()` calls `time.sleep(jitter)` (0–60s synchronous sleep) at the start. If `orchestrate.py` is called from a FastAPI async endpoint (via Loom scheduler), this blocks the event loop for up to 60 seconds. FastAPI/asyncio is single-threaded — this starves all other requests. Should be `await asyncio.sleep(jitter)` in an async context, or moved to a background thread. `orchestrate.py:run_cycle()`.

4. **[LOW]** Self-call pattern for `/ingest`, `/engagement-plan`, `/engagement-execute`, `/tracking/cycle` — synchronous httpx calls back to the same process. If twitter-intel's Lantern-assigned port changes (restart), `TWITTER_INTEL_URL` (derived from `PORT` env at startup) becomes stale. Should import and call functions directly rather than making HTTP self-calls. `orchestrate.py:ingest_posts/get_engagement_plan/execute_engagement`.

5. **[LOW]** `poll_for_result()` polls every 3 seconds for 90 seconds = up to 30 HTTP requests for a single feed scan result. Extension poll cycle is every 5 seconds. In the worst case (task picked up just after a poll): 5s for extension to pick up + execution time (variable) + 5s for extension to post result. For a 30-item feed scroll (10-30s execution), total wait could be 40-50s of polling = ~13-16 requests. Reasonable but unacknowledged in code.

6. **[INFO]** `twitter-intel` service is currently `stopped` — cannot live-verify self-call endpoints (`/ingest`, `/engagement-plan`, etc.). All GlowForge-facing calls (`POST /api/browser/tasks`, `GET /api/browser/results/{id}`) verified live ✅.

7. **[INFO]** `run_cycle()` summary reads `exec_result.get("succeeded", 0)` but `execute_engagement()` returns `browser_executor.execute_plan()` result via `/engagement-execute`. The `execute_plan()` returns `list[SubmissionResult]` — `main.py`'s endpoint converts this to `{submitted, total, succeeded, failed}`. If that conversion is correct, the keys match.

---

### Verified OK (GlowForge-side)

- `POST /api/browser/tasks` with orchestrate.py body → HTTP 201 ✅ (curl confirmed)
- `GET /api/browser/results/{task_id}` → 404 when not ready, then 200 when posted ✅
- `poll_for_result()` 404 → silent retry loop ✅
- Error handling: all external calls wrapped in try/except, returning empty/default ✅
- `resp.raise_for_status()` used consistently ✅

---
---

# AUDIT COMPLETE — Master Findings Summary
## All 14 components traced · 2026-02-18 14:25 CST

---

## 🔴 CRITICAL — Fix Before Next Use

### C1 · `browserQueue.enqueue()` drops callback fields — Twitter Intel feedback loop is dead
**Files:** `src/server/browser-queue.ts:enqueue()`, `src/api/browser.ts`, `twitter-intel/browser_executor.py`, `twitter-intel/orchestrate.py`

`enqueue()` builds the task object omitting `callback_url`, `source`, `correlation_id` even though the plugin correctly extracts them from the HTTP body. `dequeue()` then checks `if (task.callback_url)` — always undefined — so `completedTasks` is never populated and `_fireCallback()` is never called. Twitter Intel sends engagement actions expecting callbacks to `/browser-result`; none ever arrive; bandit never receives rewards.

**Fix:** In `browser-queue.ts:enqueue()`, add to the task object:
```ts
callback_url: input.callback_url,
source: input.source,
correlation_id: input.correlation_id,
```

---

### C2 · `ToolCard` lifecycle buttons 404 for 3 of 9 tools — GlowForge/GhostGraph/Loom uncontrollable from sidebar
**File:** `src/components/ToolRegistry/ToolCard.tsx:15,20,25`

All three handlers pass `tool.id` (e.g. `"glowforge"`) to `activateTool/deactivateTool/restartTool`, but Lantern routes match by display name (e.g. `"GlowForge"`). Confirmed: `POST /api/projects/glowforge/activate` → HTTP 404. Error silently caught by `.catch(console.error)`. Affects GhostGraph, GlowForge, Loom — the three core services.

**Fix:** Change `tool.id` → `tool.name` in all three handlers. `ToolSummary` already contains `.name`.

---

### C3 · `ArtifactBlock` crashes on completed Loom tasks — TypeError at runtime
**Files:** `src/components/LoomChat/TraceCard.tsx`, `src/types.ts:TaskArtifact`

`TaskArtifact.output` typed as `string` but Loom actually returns `{_raw_text: "..."}`. `ArtifactBlock` calls `output.split('\n')` immediately → `TypeError: output.split is not a function`. Any trace with a completed task (artifact.output set) crashes the entire TraceCard component.

**Fix:** Change type to `output?: string | {_raw_text: string}` and read:
```ts
const text = typeof output === 'object' ? output._raw_text : output
```

---

### C4 · Health lookup uses wrong key — health panel always shows "unknown"
**File:** `src/components/ToolRegistry/ToolDetail.tsx:~42,55`

`getProjectHealth()` returns `Record<display_name, ProjectHealthStatus>` (keys: `"GhostGraph"`, `"GlowForge"`, etc.), but `ToolDetail` looks up by `toolId` (lowercase: `"ghostgraph"`). Result: `all["ghostgraph"]` → `undefined` → `null` for all capitalized-name tools. Health panel always blank. 15-second poll produces nothing useful.

**Fix:** Look up by `tool.name` after tool is loaded:
```ts
all[tool?.name ?? toolId] ?? null
```

---

### C5 · `TraceState.user_prompt` and `.plan` never returned by Loom — dead UI
**Files:** `src/types.ts:TraceState`, `src/api/loom.ts`, `src/components/LoomChat/TraceCard.tsx`

Both fields declared in `TraceState` but Loom's `GET /status/{id}` never includes them (verified across all trace states: running, paused, await_user, success). `TraceCard`'s plan display block (`{state?.plan && (...)}`) is permanently hidden. `user_prompt` is missing from history entries too — job history shows `(trace clw-...8)` instead of prompts.

**Fix:** Remove from `TraceState`/`TraceHistoryEntry` types, or file a Loom issue to add the fields.

---

## 🟠 HIGH — Significant Functional Impact

### H1 · Build plugin write route undocumented — ENDPOINTS.md wrong, Loom build agent will 404
**Files:** `src/server/build-plugin.ts`, `~/tools/GlowForge/docs/ENDPOINTS.md`, `src/api/build.ts`

ENDPOINTS.md says `POST /api/build/{toolId}` for writing build.yaml. Plugin actually handles `POST /api/build/{toolId}/write`. Confirmed: documented route → 404; actual route → 200. Any Loom build agent following the docs silently fails on every write.

**Fix:** Update ENDPOINTS.md to document `/write` suffix.

---

### H2 · `buildYamlPath()` case-sensitivity — build system invisible for capitalized tools
**File:** `src/server/build-plugin.ts:buildYamlPath()`

Constructs `~/tools/{toolId}/build.yaml` using lowercase id (e.g. `ghostgraph`), but directories are capitalized (`GhostGraph`). `GET /api/build/ghostgraph` always 404s even if build.yaml exists at `~/tools/GhostGraph/build.yaml`. `hasBuildManifest()` always returns `false` for GhostGraph, GlowForge, Loom.

**Fix:** Case-insensitive directory lookup, or resolve via Lantern `tool.path` field (already returned by `GET /api/tools/{id}`).

---

### H3 · `GLOWFORGE_URL` stale default in Twitter Intel — connection refused at runtime
**Files:** `twitter_intel/browser_executor.py:29`, `twitter_intel/orchestrate.py:35`

Both default to `http://localhost:5274`. GlowForge actually runs at `http://127.0.0.1:41005` (Lantern-managed port). Port 5274 is `vite.config.ts`'s fallback, not used when Lantern injects `PORT`. If `GLOWFORGE_URL` env var unset (the default), all task submissions → `Connection refused`. Accessible via `https://glowforge.glow`.

**Fix:** Default to `https://glowforge.glow`. Document required env vars.

---

### H4 · `poll_for_result()` data shape implicit — wrong key = silent empty result
**File:** `twitter_intel/orchestrate.py:poll_for_result()`

Reads `result["data"]["items"]` — implicit contract with extension's `task-executor.js`. If extension stores feed data differently, returns `[]` silently, aborts cycle with "no_posts". No schema validation, no logging of actual data shape on mismatch.

**Fix:** Log `result["data"]` on unexpected shape; consider explicit key contract in task-executor.js.

---

### H5 · Loom history endpoint returns `'await_user'` but type uses `'awaiting_input'`
**Files:** `src/types.ts:TraceStatus`, `src/components/LoomChat/JobPanel.tsx`

`GET /history` returns `status: 'await_user'` for waiting traces; `GET /status/{id}` for the same trace returns `status: 'awaiting_input'`. Type declares `'awaiting_input'`, not `'await_user'`. `STATUS_ICON` in JobPanel has no `'await_user'` key → renders `<Clock>` with no label for waiting traces in history.

**Fix:** Either normalise Loom's two status strings, or add `'await_user'` to `TraceStatus` and `STATUS_ICON`.

---

## 🟡 MEDIUM — Correctness Issues

| ID | Component | Issue |
|----|-----------|-------|
| M1 | `ToolDetail.tsx` | Health poll `refreshHealth()` not in `useEffect` deps — stale closure risk if it ever reads `tool` state |
| M2 | `ChatPanel/TraceCard` | 1.5s poll per TraceCard; 4+ open traces = ~2.7 req/s to Loom continuously. `'paused'` traces polled despite no expected state change |
| M3 | `orchestrate.py` | `time.sleep(jitter)` (0-60s) in `run_cycle()` blocks async event loop if called from FastAPI endpoint |
| M4 | `extension/background.js` | `isRunning` flag has no watchdog timeout — hung `executeTask()` halts all task processing forever |
| M5 | `extension/queue-client.js` | `postResult()` has no retry — transient server outage = permanent result loss |
| M6 | `scaffoldTool()` / `createSchedule()` | Multiple places read `err.error` (error code) instead of `err.message` (human text) — UI shows opaque codes in error toasts |
| M7 | `loom.ts` | `DELETE /traces/{id}` returns HTTP 200 even for nonexistent IDs — can create ghost "running" records |
| M8 | `ToolDetail` `SchedulesTab` | `isRelevantSchedule()` checks `s.url/message/command` — Loom never returns these, dead filter code |

---

## 🔵 LOW / INFO — Quality and Completeness

| ID | Component | Issue |
|----|-----------|-------|
| L1 | `lantern.ts` | Lantern returns dual top-level keys (`data` + `tools`/`tool`) — if `data` dropped, listTools/getTool silently break |
| L2 | `loom.ts` | `ScheduledTask.message/url/command/prompt` absent from `GET /schedules` — schedule editor can't pre-populate fields |
| L3 | `browser-api-plugin.ts` | Enqueue returns HTTP 201; client checks `!res.ok` (201 is ok) — works, but undocumented |
| L4 | `build.ts` | `/exists` response leaks full filesystem path in `path` field to any client |
| L5 | `ToolList.tsx` | `buildCheckDone.current` never resets — newly scaffolded tools not build-checked until active build starts |
| L6 | `ToolList.tsx` | `refreshKey` effect suppresses `react-hooks/exhaustive-deps` warning for `load` dep |
| L7 | `BrowserQueueDrawer.tsx` | `handleClear()` missing try/catch — clearQueue() failure → unhandled rejection |
| L8 | `BrowserQueueDrawer.tsx` | Tab switch while open fires double tab-data fetch |
| L9 | `extension/queue-client.js` | GET request sends `Content-Type: application/json` header — non-standard but harmless |
| L10 | `ChatPanel` | `cancelledIds` session storage never pruned — unbounded growth |
| L11 | `DocFile` / `LanternTemplate` / `ProjectHealthStatus` | TypeScript types missing extra fields Lantern actually returns |
| L12 | `ToolDetail` logs | Audit list path `BrowserQueue/QueueDrawer.tsx` is wrong — actual file is `ToolRegistry/BrowserQueueDrawer.tsx` |
| L13 | `orchestrate.py` | Self-HTTP-call pattern for `/ingest` etc. — port could drift if service restarts |
| L14 | `orchestrate.py` | `submit_feed_scan_sync()` and `browser_executor.submit_feed_scan()` are duplicate implementations |

---

## Fix Priority Order

1. **C1** — `browser-queue.ts:enqueue()` callback fields (1-line fix, enables entire Twitter Intel feedback loop) ✅ FIXED 7270b30
2. **C2** — `ToolCard.tsx` `tool.id` → `tool.name` (1-word fix × 3 lines, restores GlowForge/GhostGraph/Loom controls) ✅ FIXED 1376beb
3. **C3** — `ArtifactBlock` string assumption (prevents runtime crash on completed traces) ✅ FIXED 7ddcfa3
4. **C4** — `ToolDetail` health lookup key (health panel has been broken since first deploy) ✅ FIXED 7a2a685
5. **H3** — `GLOWFORGE_URL` default in twitter-intel (connection refused at runtime) ✅ FIXED ef26283 (twitter-intel repo)
6. **H2** — `buildYamlPath()` case sensitivity (build system broken for 3/9 tools)
7. **H1** — ENDPOINTS.md write route correction (document the `/write` suffix)
8. **C5 / H5** — Loom field mismatches (requires Loom-side changes or type corrections)
