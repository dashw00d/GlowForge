# Endpoint Map — All Connections

Every API endpoint used by GlowForge, the browser extension, and how they connect to Lantern and Loom.

Last verified: 2026-02-19

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    GlowForge UI                      │
│                  (React + Vite)                       │
│                                                      │
│  src/api/lantern.ts ──→ /lantern-api/* ──proxy──→ Lantern :4777
│  src/api/loom.ts    ──→ getLoomBaseUrl() ───────→ Loom (dynamic)
│                    └─fallback /loom-api/* ─proxy→ Loom    :41001
│  src/api/browser.ts ──→ /api/browser/* ──plugin──→ Vite (in-process)
│  src/api/build.ts   ──→ /api/build/*   ──plugin──→ Vite (in-process)
│  (scaffold/schedule) ─→ /api/scaffold  ──plugin──→ Vite (in-process)
│                        /api/schedules  ──plugin──→ Vite (in-process)
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│               Browser Extension                       │
│             (Chrome Manifest V3)                      │
│                                                      │
│  background.js ──→ {glowforgeUrl}/api/browser/tasks   │
│  background.js ──→ {glowforgeUrl}/api/browser/results │
│  background.js ──→ {glowforgeUrl}/api/browser/queue   │
│                                                      │
│  glowforgeUrl = configured in popup (user sets this)  │
│  Default: https://glowforge.glow (or Lantern-assigned local port)
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│              Twitter Intel                            │
│                                                      │
│  browser_executor.py ──→ {GLOWFORGE_URL}/api/browser/tasks
│  orchestrate.py      ──→ {GLOWFORGE_URL}/api/browser/tasks
│  orchestrate.py      ──→ {GLOWFORGE_URL}/api/browser/results/{id}
│  callback endpoint   ←── GlowForge POSTs to /browser-result
│                                                      │
│  GLOWFORGE_URL = env var, default https://glowforge.glow
└──────────────────────────────────────────────────────┘
```

---

## Lantern API (port 4777)

GlowForge accesses via proxy: `/lantern-api/*` → `http://127.0.0.1:4777/*`

### Read endpoints

| GlowForge calls | Lantern route | Method | Returns | Status |
|------------------|---------------|--------|---------|--------|
| `listTools()` | `/api/tools` | GET | `{data: ToolSummary[]}` | ✅ Works |
| `getTool(id)` | `/api/tools/{id}` | GET | `{data: ToolDetail}` | ✅ Works |
| `getToolDocs(id)` | `/api/tools/{id}/docs` | GET | `{data: {docs: DocFile[]}}` | ✅ Works |
| `getProjectHealth()` | `/api/health` | GET | `{data: Record<string, HealthStatus>}` | ✅ Works |
| `getSystemHealth()` | `/api/system/health` | GET | `{data: SystemHealth}` | ✅ Works |
| `listTemplates()` | `/api/templates` | GET | `{data: LanternTemplate[]}` | ✅ Works |

### Mutation endpoints

⚠️ **Lantern `/api/projects/*` routes match by display name in route params.**
GlowForge now normalizes to name in the UI paths, but custom callers should avoid id/name mixups.

| GlowForge calls | Lantern route | Method | Notes | Status |
|------------------|---------------|--------|-------|--------|
| `activateTool(name)` | `/api/projects/{NAME}/activate` | POST | Uses project name route param | ✅ Works |
| `deactivateTool(name)` | `/api/projects/{NAME}/deactivate` | POST | Uses project name route param | ✅ Works |
| `restartTool(name)` | `/api/projects/{NAME}/restart` | POST | Uses project name route param | ✅ Works |
| `deleteProject(name)` | `/api/projects/{NAME}` | DELETE | Uses project name route param | ✅ Works |
| `createProject(input)` | `/api/projects` | POST | Creates registration | ✅ Works |
| `resetProjectFromManifest(name)` | `/api/projects/{NAME}/reset` | POST | Syncs run/type from lantern.yaml | ✅ Works |
| `refreshProjectDiscovery(name)` | `/api/projects/{NAME}/discovery/refresh` | POST | Re-scan endpoints | ✅ Works |

### Notes
- **Name vs ID routing**: keep project lifecycle calls aligned to project-name routes in Lantern.
- **Concurrency stability**: scan/refresh 500s were addressed in Lantern manager/controller hardening and verified with repeated smoke checks.

---

## Loom API (dynamic port; current local runtime 41001)

GlowForge resolves Loom base dynamically via `GET /lantern-api/api/tools/loom` (`base_url`/`upstream_url`).

Fallback path in local dev remains: `/loom-api/*` → `http://127.0.0.1:41001/*`

### Endpoints GlowForge uses

| GlowForge calls | Loom route | Method | Returns | Status |
|------------------|------------|--------|---------|--------|
| `sendPrompt(prompt, options?)` | `/prompt` | POST | `{trace_id, status}` | ✅ Works |
| `getTraceStatus(id)` | `/status/{trace_id}` | GET | `TraceState` | ✅ Works |
| `confirmTrace(id, approved)` | `/confirm/{trace_id}` | POST | - | ✅ Works |
| `cancelTrace(id)` | `/traces/{trace_id}` | DELETE | `{trace_id, status, processes_killed}` | ✅ Works |
| `listHistory(limit)` | `/history?limit=N` | GET | `{runs: TraceHistoryEntry[]}` | ✅ Fixed |
| `listSchedules()` | `/schedules` | GET | `{schedules: ScheduledTask[]}` | ✅ Works |
| `toggleSchedule(id, enabled)` | `/schedules/{task_id}` | PATCH | - | ✅ Works |

### Full Loom API (from OpenAPI spec)

| Route | Method | Used by GlowForge? |
|-------|--------|---------------------|
| `/health` | GET | No (could use for health strip) |
| `/prompt` | POST | ✅ Yes — chat |
| `/status/{trace_id}` | GET | ✅ Yes — trace polling |
| `/confirm/{trace_id}` | POST | ✅ Yes — approve/reject |
| `/traces/{trace_id}` | DELETE | ✅ Yes — cancel |
| `/traces/{trace_id}` | PATCH | No |
| `/traces/{trace_id}/comment` | POST | No |
| `/history` | GET | ✅ Yes — job history |
| `/history/{trace_id}` | GET | No (could use for detail) |
| `/schedules` | GET | ✅ Yes — schedule list |
| `/schedules/{task_id}` | PATCH | ✅ Yes — toggle |
| `/trace/{trace_id}/plan` | GET | No (could show in TraceCard) |
| `/trace/{trace_id}/tasks` | GET | No (could show subtasks) |
| `/trace/{trace_id}/artifacts` | GET | No |
| `/trace/{trace_id}/peers` | GET | No |
| `/trace/{trace_id}/messages/send` | POST | No |
| `/trace/{trace_id}/messages/{session_id}` | GET | No |
| `/registry` | GET | No (Lantern handles this) |
| `/registry/reload` | POST | No |
| `/registry/test` | POST | No |
| `/registry/{tool_id}` | GET | No |
| `/memory/list` | GET | No |
| `/memory/recall` | POST | No |
| `/memory/store` | POST | No |
| `/memory/{memory_id}` | DELETE | No |
| `/processes` | GET | No |
| `/dashboard` | GET | No (Loom's own UI) |
| `/dashboard/data` | GET | No |
| `/admin/compact` | POST | No |

### Notes
- `/history` can return `runs`; client normalizes `runs ?? history`.
- Builder traces require `workspace` + `tool_id` metadata. Plain prompts without metadata complete as chat traces and do not drive build.yaml updates.

---

## GlowForge Internal API (Vite plugins, in-process)

These endpoints are served by Vite dev server plugins — no external dependency.

### Browser Queue (`browser-api-plugin.ts`)

| Route | Method | Purpose | Consumers |
|-------|--------|---------|-----------|
| `/api/browser/tasks` | GET | Dequeue next task | Extension |
| `/api/browser/tasks` | POST | Enqueue new task | Extension popup, Twitter Intel, Loom, Queue UI |
| `/api/browser/results/{task_id}` | POST | Submit task result | Extension |
| `/api/browser/results/{task_id}` | GET | Get single result | Twitter Intel (polling) |
| `/api/browser/queue` | GET | Queue status (pending count, result count, connected) | Extension, Queue UI |
| `/api/browser/queue/pending` | GET | List pending tasks | Queue UI |
| `/api/browser/queue/results` | GET | List recent results | Queue UI |
| `/api/browser/queue` | DELETE | Clear queue | Queue UI |

**Task schema (POST /api/browser/tasks):**
```json
{
  "action": "scroll_feed",
  "target_url": "https://x.com/home",
  "params": {},
  "ttl_seconds": 120,
  "callback_url": "http://localhost:8410/browser-result",
  "source": "twitter-intel",
  "correlation_id": "like:@user:12345"
}
```

**Result schema (POST /api/browser/results/{id}):**
```json
{
  "task_id": "...",
  "status": "success",
  "data": {},
  "error": null,
  "completed_at": "2026-02-18T..."
}
```

### Build System (`build-plugin.ts`)

| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| `/api/build/{toolId}/exists` | GET | Check if build.yaml exists | ✅ Returns `{exists: bool}` |
| `/api/build/{toolId}` | GET | Read parsed build.yaml | ✅ Returns BuildManifest or 404 |
| `/api/build/{toolId}/write` | POST | Write/update build.yaml | ✅ For Loom builder agent |

### Scaffold (`scaffold-plugin.ts` — assumed)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/scaffold` | POST | Create tool directory + lantern.yaml + README |
| `/api/schedules` | POST | Create schedule entry in schedules.yaml |
| `/api/schedules/{id}` | DELETE | Remove schedule entry |

---

## Browser Extension → GlowForge

Extension connects to GlowForge via URL configured in popup.

| Extension file | GlowForge endpoint | Method | Purpose |
|---------------|-------------------|--------|---------|
| `lib/queue-client.js` | `/api/browser/tasks` | GET | Poll for next task (every 5s) |
| `lib/queue-client.js` | `/api/browser/results/{id}` | POST | Submit execution result |
| `lib/queue-client.js` | `/api/browser/queue` | GET | Queue status (for popup display) |
| `background.js` | Uses QueueClient | - | Orchestrates poll → execute → report |
| `popup/popup.js` | Sends config to background.js | - | URL config, enable/disable |

**Extension config (chrome.storage.local):**
```json
{
  "glowforgeUrl": "https://glowforge.glow",
  "enabled": true
}
```

---

## Twitter Intel → GlowForge

| File | GlowForge endpoint | Method | Purpose |
|------|-------------------|--------|---------|
| `browser_executor.py` | `/api/browser/tasks` | POST | Submit engagement actions |
| `orchestrate.py` | `/api/browser/tasks` | POST | Submit feed scans |
| `orchestrate.py` | `/api/browser/results/{id}` | GET | Poll for feed scan results |
| `main.py` `/browser-result` | ← callback FROM GlowForge | POST | Receive execution results |

**Environment variables:**
- `GLOWFORGE_URL` — default `https://glowforge.glow` (was `http://localhost:5274`, fixed H3)
- `BROWSER_CALLBACK_URL` — default `http://localhost:8410/browser-result`

---

## Proxy Configuration (vite.config.ts)

```typescript
proxy: {
  '/lantern-api': {
    target: 'http://127.0.0.1:4777',
    rewrite: (p) => p.replace(/^\/lantern-api/, ''),
  },
  '/lantern-ws': {
    target: 'ws://127.0.0.1:4777',
    ws: true,
    rewrite: (p) => p.replace(/^\/lantern-ws/, ''),
  },
  '/loom-api': {
    target: 'http://127.0.0.1:41001',  // local fallback only
    rewrite: (p) => p.replace(/^\/loom-api/, ''),
  },
}
```

**Path rewriting:**
- `/lantern-api/api/tools` → `http://127.0.0.1:4777/api/tools`
- `/loom-api/schedules` → `http://127.0.0.1:41001/schedules`

---

## Known Constraints

1. **Lifecycle naming**: custom callers should use Lantern's project-name route semantics consistently.

2. **Extension URL config**: browser extension still requires explicit GlowForge URL in popup.

3. **Callback host assumptions**: callback URLs still assume localhost in some external integrations.

4. **No auth on local APIs**: acceptable for local dev; requires hardening before wider network exposure.
