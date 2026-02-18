# Product Vision: GlowForge

**Version:** 3.0 (Reality-Checked, Final)
**Date:** 2026-02-18
**Tagline:** The orchestration platform that empowers agents to create and connect their own tools, create tasks with or without scheduling, and autonomously run the tools.

---

## Reality Check

| Feature | Status | Notes |
|---|---|---|
| `lantern.yaml` — core fields (id, name, kind, run, endpoints, routing) | ✅ Exists | Fully implemented, parsed into `Project` struct |
| `lantern.yaml` — `docs`, `docs_auto`, `api_auto` | ✅ Exists | Auto-discovery working |
| `lantern.yaml` — `depends_on`, `deploy`, `domain`, `upstream_url` | ✅ Exists | Parsed and used |
| `lantern.yaml` — `routing.triggers`, `risk`, `requires_confirmation`, `max_concurrent` | ✅ Exists | Used by Loom for intent routing |
| `lantern.yaml` — `exposure:` field | 🚧 Planned | Not in Project struct — fictional in v2.5 |
| `lantern.yaml` — `capabilities:` block | 🚧 Planned | Not parsed anywhere — fictional |
| `lantern.yaml` — `auto_tasks:` block | 🚧 Planned | Not parsed anywhere — fictional |
| `lantern.yaml` — `visibility:`, `owner:`, `icon:` | 🚧 Planned | Not in schema |
| Port allocation (dynamic, 41000–42000) | ✅ Exists | `PortAllocator` GenServer, TCP probe |
| `${PORT}` env var injection into run cmd | ✅ Exists | `Project.interpolate_cmd/2` |
| `.glow` domain routing via Caddy + dnsmasq | ✅ Exists | Fully operational |
| MCP server on Lantern | ✅ Exists | StreamableHTTP at `/mcp` |
| Lantern REST API — `/api/tools` (tool-focused view) | ✅ Exists | `GET /api/tools`, `/api/tools/:id`, `/api/tools/:id/docs` — the right endpoint for GlowForge's registry panel |
| Lantern REST API — full surface | ✅ Exists | projects, tools, health, ports, dependencies, services, templates, profiles, system, deploy, docs, discovery |
| Lantern Electron desktop app | ✅ Exists | React/TypeScript, 5 pages (Dashboard, Projects, ProjectDetail w/ 10 tabs, Services, Settings), Phoenix channels |
| Lantern headless/daemon-only mode | 🚧 Planned | No `LANTERN_MODE` env var — no mode switch in codebase |
| OpenClaw CLI dispatch from Loom | ✅ Exists | `loom/core/agents.py` — subprocess `openclaw` |
| `OPENCLAW_BIN` / `OPENCLAW_GATEWAY` config | ✅ Exists | `loom/config.py` settings |
| `AgentRuntime` multi-backend abstraction | 🚧 Planned | Loom only calls OpenClaw today — no pluggable provider layer |
| `providers.yaml` config file | 🚧 Planned | Does not exist |
| `glowforge agent message` CLI | 🚧 Planned | No GlowForge CLI exists |
| Loom dashboard (operational monitoring) | ✅ Exists | Real HTML UI: active runs, dead letters, recent completed, registry health, 10s auto-refresh, comment injection |
| GlowForge UI (React/Vite left panel + chat) | 🚧 Planned | GlowForge UI not built; Loom dashboard is minimal ops-only, not the product UI |
| Loom scheduler — YAML-driven, 5 action types | ✅ Exists | `agent`, `http`, `shell`, `prompt`, `trace` actions; per-task timezone |
| Loom scheduler — human-readable expressions | ✅ Exists | `every 8 minutes`, `daily at 9:00`, `weekly on monday`, `cron 0 9 * * 1` |
| Loom scheduler — graph-generated schedules | ✅ Exists | Graph can emit `trace` schedules → stored in `generated_schedules.json`, auto-loaded |
| Loom scheduler — runtime toggle | ✅ Exists | `PATCH /schedules/{task_id}` enable/disable without restart |
| Loom per-agent instruction files | ✅ Exists | `loom/agents/{session_id}.md` prepended to every scheduled agent message |
| Loom memory (ChromaDB + Ollama embeddings) | ✅ Exists | `/memory/store`, `/memory/recall`, `/memory/list` |
| Loom trace system (multi-step, fanout, review) | ✅ Exists | LangGraph, 13 nodes, SQLite checkpointing |
| Lantern MCP — 17 tools exposed | ✅ Exists | ListProjects, StartProject, CallToolAPI, CheckHealth, GetProjectDocs, SearchProjects, GetDependencies, GetPorts, + more |
| Lantern MCP — resources + prompts | ✅ Exists | 3 resources (metadata, docs, discovery) + 2 prompts (DiagnoseService, DependencyTrace) |
| `exposure: public` + public API routing | 🚧 Planned | Aspirational — Caddy only serves `.glow` locals today |
| Remote registry discovery | 🚧 Planned | Not implemented |
| Tool auto-creation from natural language | 🚧 Planned | Core aspiration — not yet built |

---

## The Problem

Companies want AI agents that actually *do* work inside their own systems using real browser sessions and account auth — not brittle API keys.
The missing piece is a **self-extending tool platform** where agents themselves can discover, build, register, schedule, and run new tools in plain English.

---

## The Vision

GlowForge is the unified interface on top of **Lantern** (tool registry & discovery) + **Loom** (orchestration & autonomy).

Users interact almost exclusively through a chat-first TUI/chat window.
Everything else (tool creation, scheduling, monitoring) happens automatically or via simple sidebar clicks.

```
┌──────────────────────┬────────────────────────────────────┐
│  TOOL REGISTRY       │                                    │
│  (Lantern-powered)   │         LOOM CHAT                  │
│                      │                                    │
│  ● twitter-intel     │  > Build me a daily sales → Slack  │
│  ● ghostgraph        │    summarizer                      │
│  ● git-chronicle     │                                    │
│  ○ auto-shorts       │  Loom: Creating new tool...        │
│                      │  Tool "sales_summary" registered   │
│  + New Tool          │  Appears in sidebar. Schedule?     │
│                      │                                    │
│  (click any tool     │  Real-time trace:                  │
│   → full API docs,   │  • Lantern lookup                  │
│      health, calls)  │  • Tool call → salesforce          │
│                      │  • Output → slack                  │
└──────────────────────┴────────────────────────────────────┘
```

> ⚠️ **Planned — GlowForge UI not yet built.** Loom has a real operational dashboard at `/dashboard` (active runs, registry health, 10s auto-refresh, comment injection) but it's an ops tool, not the product UI. The left-panel registry + chat UI is the primary MVP build target.

**Left panel** = live Tool Registry (hot-reloads from Lantern)
**Center** = natural-language chat with Loom (the only interface most users ever need)
**Top bar** = schedule manager, session history, logs

> 💡 **Real autonomy today (no UI needed yet):** When Loom executes a workflow that involves a recurring task, its graph scheduler node emits a `trace` action entry into `state/generated_schedules.json`. The scheduler loop auto-loads this file and begins firing the task on schedule — no human intervention. The agent schedules itself. This is the "create tasks with or without scheduling" tagline, working now.

---

## What's Already Built

### Lantern (✅ Production-quality)
- **Service registry** — scans `~/tools/` and `~/sites/` for `lantern.yaml` manifests
- **Dynamic port allocation** — `PortAllocator` GenServer, range 41000–42000, TCP probe
- **`.glow` domain routing** — dnsmasq + Caddy, automatic local TLS
- **Process lifecycle** — start/stop/restart services, health checks, status tracking
- **API & doc discovery** — OpenAPI spec fetching, markdown doc indexing, endpoint merging
- **MCP server** — StreamableHTTP at `/mcp`, 17 tools + 3 resources + 2 prompts:
  - Tools: ListProjects, GetProject, GetProjectDocs, GetProjectEndpoints, GetProjectDiscovery, StartProject, StopProject, RestartProject, GetProjectLogs, CheckHealth, SearchProjects, GetDependencies, GetPorts, RefreshDiscovery, ListTools, CallToolAPI, GetJobResult
  - Resources: ProjectMetadata, ProjectDocs, ProjectDiscovery
  - Prompts: DiagnoseService, DependencyTrace
- **Desktop Electron app** — React/TypeScript UI with Phoenix channels for real-time updates
- **REST API** — full surface (port 4777 / `http://lantern.glow`):
  - `GET /api/tools` / `/api/tools/:id` / `/api/tools/:id/docs` — tool-focused registry view ← use for GlowForge registry panel
  - `GET /api/projects` — all projects; `POST /api/projects/:id/activate|deactivate|restart`
  - `GET /api/health` — health for all projects (latency, status)
  - `GET /api/ports` — port assignments; `GET /api/dependencies` — dependency graph
  - `GET /api/services` — infrastructure services (redis, postgres, etc.)
  - `GET /api/templates` / `GET /api/profiles` — project templates + config profiles
  - `GET /api/system/health|settings`; `POST /api/system/shutdown`

**Live tools registered:** Lantern, Loom, GhostGraph, Browser, twitter-intel, git-chronicle, auto-shorts

### Loom (✅ Production-quality)
- **LangGraph orchestration** — 13-node graph (intake → categorize → plan → implement → review)
- **Intent routing** — keyword fast-path + OpenClaw agent classification
- **Tool registry** — loads from Lantern API dynamically (no static YAML)
- **OpenClaw dispatch** — subprocess `openclaw` with `--session-id` for persistent/ephemeral sessions
- **Scheduler** — fully operational, running real tasks:
  - **5 action types:** `agent` (OpenClaw session), `http` (health/webhook), `shell` (arbitrary command), `prompt` (POST to Loom `/prompt`), `trace` (preplanned task pack from the graph)
  - **Human-readable expressions:** `every 8 minutes`, `daily at 3:00`, `weekly on monday at 9:00`, `cron 0 9-17 * * 1-5` — no raw cron required
  - **Graph-generated schedules** ← key autonomy feature: when Loom plans a recurring task, it emits a `trace` action schedule to `state/generated_schedules.json`, which the scheduler auto-loads. Agents can schedule themselves.
  - **Per-agent instruction files:** `loom/agents/{session_id}.md` — persistent instructions prepended to every scheduled agent message
  - **Runtime toggle:** `PATCH /schedules/{task_id}` to enable/disable without restart
  - **Real schedules in `schedules.yaml`:** social-cycle (every 8 min), twitter-engagement-cycle (every 3h), nightly-compaction (daily 3am), ghostgraph-health (every 5 min), weekly-research
- **Memory** — ChromaDB + Ollama `nomic-embed-text` embeddings
- **Trace system** — SQLite checkpointing, pause/resume, cancel, per-agent messaging
- **Dashboard** — real HTML operational UI at `/dashboard`: active traces, dead letters, recent completed, registry health, 10s auto-refresh, comment injection to running agents
- **7 named agent roles** with persistent instruction files (`loom/agents/*.md`):
  - `categorize` (router), `planner`, `task-breaker`, `implementer`, `reviewer`, `scheduler`, `social-cycle`
  - Each scheduled agent call prepends its `.md` as a system prompt — persistent behavioral identity across fires
- **Scheduled trace execution** (`trace_executor.py`) — when a `trace` action fires, it rebuilds state from the stored task pack and runs `assign → implement → review` without re-planning. `schedule_review_mode` (always / on_fail / never) is configurable per task.
- **275 tests passing**

### Tool Ecosystem (✅ All operational)
- **GhostGraph** — distributed web extraction (remote service at `ghost.paidfor.net`)
- **Browser daemon** — Camoufox anti-detect automation, persistent profiles, site task modules
- **twitter-intel** — Thompson-sampling engagement, feed analysis, growth tracking
- **git-chronicle** — semantic search over 43 projects' commit history
- **auto-shorts** — ComfyUI + Remotion short-form video generation

---

## Core Architecture

```
Layer 4: GlowForge UI  (WHAT — product interface for users) [Planned]
Layer 3: Loom          (WHY — intent routing, planning, orchestration)
Layer 2: Lantern       (WHERE — service discovery, URL resolution, docs, MCP)
Layer 1: Tools         (HOW — browser, ghostgraph, git-chronicle, twitter-intel, auto-shorts)
Layer 0: Infrastructure (WHAT runs it — Chrome, Postgres, Redis, Vultr, ComfyUI)
```

- **GlowForge UI** = thin React/Vite layer (talks directly to Lantern + Loom APIs) **[Planned]**
- **Loom** = orchestration brain (routes, chains, schedules, and *will build* tools)
- **Lantern** = registry & discovery engine (single source of truth for tool locations, docs, and health)
- **Tools** = isolated services (each in its own folder, own process, own Caddy route)

**Compartmentalization rule:** Tools never call each other directly. Integration always flows through Loom. Loom resolves tool URLs via Lantern at runtime (5-min TTL cache). This keeps each tool simple, testable, and independently deployable.

No monorepo. No shared runtime. Tools can be written in any language.

---

## Real Integration Patterns

These are the tool-to-tool workflows Loom actually orchestrates today:

**Working chains (Loom dispatches both sides):**
- **Loom → GhostGraph** — HTTP dispatch, full 22-endpoint coverage, resolves `ghost.paidfor.net` via Lantern
- **Loom → Browser daemon** — HTTP dispatch via Lantern URL resolution, triggers: browse, twitter, linkedin, screenshot
- **Loom → git-chronicle** — HTTP dispatch, semantic search over 43 projects' commit history
- **Loom → auto-shorts** — HTTP dispatch, video generation from structured schema
- **Loom → twitter-intel** — HTTP dispatch, engagement, feed analysis, tracking

**Planned chains:**
- **Browser → GhostGraph** — Browser finds URLs while scraping → hands off to GhostGraph for bulk structured extraction
- **GhostGraph → Browser** — GhostGraph hits an auth wall → requests Browser to scrape with logged-in profile
- **Job application pipeline** — git-chronicle matches skills → GhostGraph scrapes job requirements → Loom plans cover letter → Browser submits via LinkedIn/Indeed

**Integration rule:** The integration point is always Loom, never direct. `Browser.call(GhostGraph)` never happens — Loom orchestrates both sides independently. This keeps tools simple, testable, and independently deployable.

---

## Lantern Dual-Mode Operation (Desktop + Headless)

> ⚠️ **Planned — not yet implemented.** Lantern today runs as a single Elixir/Phoenix process. Electron is a separate process that connects to the daemon. There is no `LANTERN_MODE` env var or headless-only binary. The daemon itself runs fine without Electron — this is already the "headless" experience. What's aspirational is: a formal headless mode with a lighter footprint, systemd-friendly packaging, and CLI-only interface.

**One codebase, zero drift** — your local Electron UI stays exactly as you love it, while VM/production gets a slim daemon.

- **Desktop mode** (your daily driver)
  Full Elixir + Electron UI, hot-reload sidebar, live project cards, MCP channels — what you have today.

- **Headless mode** (VM / production default) [Planned]
  Pure daemon + CLI only. No Electron. `LANTERN_MODE=headless` env var.
  Already partially true: the Elixir daemon runs independently of Electron.
  Remaining: formal headless flag, CLI module, systemd packaging.

---

## LLM & Agent Runtime Abstraction

> ⚠️ **Partially real.** Loom dispatches to OpenClaw today via subprocess — no abstract `AgentRuntime` layer exists. The providers.yaml config and multi-backend abstraction are aspirational.

Loom calls OpenClaw CLI directly:
```python
# loom/core/agents.py — what actually exists
subprocess.run([settings.OPENCLAW_BIN, "agent",
                "--session-id", session_id,
                "--message", prompt, "--json"])
```

**Aspirational architecture:**
```
GlowForge UI
     ↓
Loom Orchestrator
     ↓
AgentRuntime [Planned]
     ↓
├── OpenClaw (exists — default today)
├── Anthropic SDK [Planned]
├── OpenAI / Azure [Planned]
├── Local (Ollama) [Planned]
└── Future: any provider
```

**Why OpenClaw stays the primary target:**
- Real browser sessions → full account auth, cookies, 2FA.
- Zero API keys required.
- Persistent or ephemeral sessions via `--session-id`.

**Actual config that exists** — `loom/.env`:
```bash
OPENCLAW_BIN=~/.openclaw/bin/openclaw
OPENCLAW_GATEWAY=http://localhost:18789
OPENCLAW_GATEWAY_TOKEN=...
```

---

## The Single Source of Truth: lantern.yaml (Actual Schema)

This is what Lantern **actually parses** today:

```yaml
# Required
id: my-tool                    # Unique slug
name: My Tool                  # Human display name
description: What it does.

# Service classification
kind: service                  # service | project | capability | website | tool
type: proxy                    # php | proxy | static | unknown

# .glow domain (defaults to <id>.glow)
domain: my-tool.glow
upstream_url: https://external.service.com  # For remote proxied services

# Process management
run:
  cmd: .venv/bin/uvicorn api:app --host 0.0.0.0 --port ${PORT}
  cwd: .
  env:
    APP_ENV: development

health_endpoint: /health

# Loom routing (intent matching)
routing:
  triggers:
    - keyword phrase
    - another phrase
  risk: low | medium | high
  requires_confirmation: false
  max_concurrent: 1

# Documentation
tags: [tag1, tag2]
docs:
  - README.md

docs_auto:
  enabled: true
  patterns: ["README.md", "*.md", "docs/**/*.md"]
  ignore: [node_modules/**, .git/**, .venv/**]
  max_files: 20
  max_bytes: 524288

# API endpoints (manual manifest)
endpoints:
  - method: POST
    path: /api/render
    description: Render a video
    category: Render
    risk: medium

# OpenAPI auto-discovery
api_auto:
  enabled: true
  candidates:
    - /openapi.json
  timeout_ms: 2500
  max_endpoints: 100

# Service dependencies
depends_on:
  - redis
  - postgres

# Custom deploy commands (instead of run.cmd)
deploy:
  start: systemctl --user start my-tool
  stop: systemctl --user stop my-tool
  restart: systemctl --user restart my-tool
  logs: journalctl --user -u my-tool -n 100
  status: systemctl --user is-active my-tool
```

**Fields NOT yet in the schema** (planned for future phases):
```yaml
# These are aspirational — not parsed by Lantern today:
exposure: local | public | remote    # Controls public routing
capabilities:                        # Structured intent declaration
  - id: generate_summary
    intent: "daily sales summary"
    ...
auto_tasks:                          # Declarative scheduled jobs
  - capability: generate_summary
    schedule: "0 9 * * 1"
    ...
visibility: private
owner: ryan
icon: 💰
```

---

## Deployment & Organization

> ⚠️ **Local-first today.** Public routing, remote registries, and VM-first deployment are planned.

**Current reality:**
- All tools run locally on `~/tools/`
- `.glow` domains resolve via local dnsmasq + Caddy
- GhostGraph is the only tool with a remote upstream (runs on Vultr)
- Port 443: Nginx holds it; Caddy `.glow` routing requires `sudo bash toggle-server.sh lantern` to activate

**Planned:**
- `exposure: public` → auto-routes via Caddy to `domain.com/glowforge/tools/{id}/api/...`
- Remote registry: `remote_registries: [https://remote.host/glowforge/registry]`
- VM-first headless installs

---

## Tech Stack (Fixed for MVP)

- **Frontend:** React 19 + Vite + Tailwind + shadcn/ui [Planned — doesn't exist yet]
- **Runtime:** OpenClaw (Claude Code) + Docker + Caddy [Caddy ✅, OpenClaw ✅, Docker used by GhostGraph]
- **Lantern:** Elixir/Phoenix + Electron [✅ Exists]
- **Loom:** Python/FastAPI + LangGraph [✅ Exists]
- **Storage:** Lantern filesystem + SQLite (Loom checkpoints) + ChromaDB (Loom memory) [✅]

---

## Development Plan

### Phase 0 – Foundation
- [x] Lantern daemon — service registry, port allocation, `.glow` routing
- [x] Lantern MCP server — 17 tools, 3 resources, 2 prompts exposed to AI agents
- [x] Loom orchestration — 13-node graph, routing, OpenClaw dispatch
- [x] Loom scheduler — 5 action types, human-readable expressions, per-task timezone
- [x] **Graph-generated scheduling** — Loom graph can autonomously emit recurring tasks to `generated_schedules.json`; scheduler auto-loads them. Agents can schedule themselves.
- [x] Loom memory — ChromaDB + Ollama vector store
- [x] Loom dashboard — real HTML operational UI (active runs, registry health, dead letters, comment injection)
- [x] 7 named agent roles with persistent instruction files (categorize, planner, task-breaker, implementer, reviewer, scheduler, social-cycle)
- [x] All 7 tools scouted, tested, and operational (Lantern, Loom, GhostGraph, Browser, twitter-intel, git-chronicle, auto-shorts)
- [ ] Lantern headless mode (LANTERN_MODE=headless, systemd packaging)
- [ ] AgentRuntime abstraction (multi-backend dispatch)
- [ ] `exposure` field + remote registry support

### Phase 1 – MVP GlowForge UI
> Loom's `/dashboard` (operational, exists) can be a reference point for trace visualization patterns. GlowForge UI is a new React/Vite app — different UX, product-facing.
- [ ] React/Vite scaffold (left panel + chat center)
- [ ] Tool Registry panel (calls Lantern `GET /api/tools` — the tool-focused endpoint, not `/api/projects`)
- [ ] Loom chat interface (calls `/prompt`, polls `/status/{trace_id}`)
- [ ] Real-time trace visualization (model: Loom `/dashboard/data` shape)
- [ ] Schedule manager (calls Loom `GET /schedules`, toggle via `PATCH /schedules/{task_id}`)

### Phase 2 – Autonomous Build
- [ ] "Build me a tool" system prompt + Loom node
- [ ] Auto-scaffolding of tool directories + lantern.yaml
- [ ] Registration pipeline (write → Lantern scan → show in UI)

### Phase 3 – Declarative Scheduling & Autonomy
> Note: The core scheduling engine and graph-generated autonomy are already done (Phase 0). The basic schedule UI toggle is in Phase 1. Phase 3 is about making scheduling *declarative* — defined in lantern.yaml, not requiring direct YAML edits.
- [ ] `auto_tasks` in lantern.yaml — Lantern reads → syncs to Loom `schedules.yaml` automatically
- [ ] `capabilities` block in lantern.yaml — structured intent declaration for agent routing
- [ ] Declarative tool scheduling: drop a lantern.yaml, tool schedules itself, no Loom config needed

### Phase 4 – Public & Remote
- [ ] `exposure: public` Caddy routing
- [ ] Remote registry federation
- [ ] VM deploy script (headless Lantern + Loom on $5 droplet)

---

## Next Action — MVP Build Spec

The shortest path to a working GlowForge demo is **~1 day of frontend work**. Zero backend changes needed.

### What to build

```
glowforge/
├── src/
│   ├── App.tsx                    # Two-column layout + routing
│   ├── api/
│   │   ├── lantern.ts             # Client for http://lantern.glow (port 4777)
│   │   └── loom.ts                # Client for http://loom.glow (Lantern-assigned port)
│   ├── components/
│   │   ├── ToolRegistry/          # Left panel
│   │   │   ├── ToolList.tsx       # Cards from GET /api/tools
│   │   │   └── ToolDetail.tsx     # Slide-out: endpoints, docs, health, start/stop
│   │   └── LoomChat/              # Center panel
│   │       ├── ChatInput.tsx      # POST /prompt
│   │       ├── TraceStream.tsx    # Poll GET /status/{trace_id} → live updates
│   │       └── TaskCards.tsx      # Display completed artifacts
│   └── pages/
│       └── Home.tsx               # Main two-column layout
```

### API contracts (all working today)

**Left panel — Tool Registry:**
```
GET  http://lantern.glow/api/tools              → list all tools with status, kind, tags
GET  http://lantern.glow/api/tools/:id          → detail: description, endpoints, docs
GET  http://lantern.glow/api/tools/:id/docs     → docs content
GET  http://lantern.glow/api/health             → { [name]: { status, latency_ms } }
POST http://lantern.glow/api/projects/:id/activate    → start service
POST http://lantern.glow/api/projects/:id/deactivate  → stop service
```

**Center panel — Loom Chat:**
```
POST http://loom.glow/prompt                    → { trace_id }
GET  http://loom.glow/status/{trace_id}         → { status, action, tasks, artifacts }
GET  http://loom.glow/trace/{trace_id}/tasks    → task list with statuses
GET  http://loom.glow/trace/{trace_id}/artifacts → completed task outputs
GET  http://loom.glow/history                   → past traces (sidebar)
GET  http://loom.glow/schedules                 → active schedules (top bar)
PATCH http://loom.glow/schedules/{task_id}      → toggle on/off
```

> Note: Loom's port is Lantern-assigned (dynamic). Use `GET http://lantern.glow/api/tools/loom` to resolve the current `base_url`. The desktop Electron app does the same via `LanternClient.getTool('loom')`.

### Reference: Lantern Electron desktop
The existing desktop app (`~/tools/Lantern/desktop/`) uses React + TypeScript + Tailwind. Its `src/renderer/api/client.ts` is the definitive Lantern API client. Its `Dashboard.tsx` (health grid, active routes, issues panel) and `ProjectDetail.tsx` (10 tabs: Overview, Run, Deploy, Endpoints, Docs, Health, Routing, Dependencies, Mail, Entry) are useful reference implementations. GlowForge should be different UX — tool panel + chat — but the API patterns and TypeScript types in `types.ts` can be lifted directly.

### Stack
- React 19 + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- No new backend code needed for MVP

Everything else (AgentRuntime, headless Lantern, public routing, tool auto-creation) comes after the UI exists and demonstrates the value.
