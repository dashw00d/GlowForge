# Build System — Live Tool Construction

## Overview

When Loom builds a new tool, it writes a `build.yaml` manifest in the tool's directory. GlowForge watches this file and renders live build progress in the UI — phases checking off, progress bar filling, build log streaming.

The tool appears in the registry immediately with a "building" state and transitions to a normal card when complete.

---

## build.yaml Schema

Lives at `~/tools/{tool-id}/build.yaml` alongside `lantern.yaml`.

```yaml
# Required
tool_id: rss-monitor                    # matches lantern.yaml id
name: RSS Feed Monitor                  # display name
prompt: "Build me a tool that..."       # original user request
status: building                        # pending | building | testing | ready | failed
started_at: "2026-02-18T10:30:00Z"
progress: 0.35                          # 0-1 computed from phase completion

# Optional
completed_at: "2026-02-18T10:35:00Z"   # set when status → ready|failed
error: "npm run build failed: ..."      # set when status → failed

phases:
  - id: scaffold
    name: Project Scaffold
    status: done                        # pending | in_progress | done | failed | skipped
    started_at: "2026-02-18T10:30:01Z"
    completed_at: "2026-02-18T10:30:05Z"
    artifacts:                          # files created in this phase
      - lantern.yaml
      - README.md
      - pyproject.toml

  - id: core
    name: Core Implementation
    status: in_progress
    started_at: "2026-02-18T10:30:06Z"
    steps:                              # optional granular steps within a phase
      - name: RSS parser module
        status: done
        file: src/parser.py
      - name: Feed polling loop
        status: in_progress
        file: src/poller.py
      - name: Storage layer
        status: pending
        file: src/storage.py

  - id: api
    name: API Endpoints
    status: pending
    steps:
      - name: Health endpoint
        status: pending
      - name: Feed CRUD
        status: pending
      - name: Webhook notifications
        status: pending

  - id: test
    name: Testing & Verification
    status: pending

  - id: register
    name: Lantern Registration
    status: pending

log:                                    # append-only build log
  - time: "2026-02-18T10:30:01Z"
    msg: Creating project scaffold
  - time: "2026-02-18T10:30:05Z"
    msg: "Scaffold complete — lantern.yaml, README.md, pyproject.toml"
  - time: "2026-02-18T10:30:06Z"
    msg: Starting core implementation
  - time: "2026-02-18T10:30:15Z"
    msg: "✓ RSS parser module — feedparser + async fetch"
```

### Status Lifecycle

```
pending → building → testing → ready
                  ↘ failed
                     ↓
                  (retry → building)
```

### Progress Calculation

`progress` is a float 0-1 computed from phases:
- Each phase has equal weight (1 / total_phases)
- Within a phase with steps: (done_steps / total_steps) * phase_weight
- `done` phase = full weight, `pending` = 0, `in_progress` = partial

---

## Standard Phases

Every tool build follows these phases (Loom can add/skip as needed):

| Phase | What Happens |
|-------|-------------|
| `scaffold` | Create dir, lantern.yaml, README, package config |
| `core` | Main implementation — the actual tool logic |
| `api` | API endpoints (if kind=service) |
| `test` | Run tests, verify build, check health endpoint |
| `register` | Lantern picks it up, start the service, verify health |

---

## Loom Integration

### How Loom writes build.yaml

When the build agent starts:
1. Create `~/tools/{id}/`
2. Write `build.yaml` with `status: pending`, all phases listed
3. Write minimal `lantern.yaml` (id, name, description, kind)
4. Update `build.yaml` → `status: building`
5. Work through phases, updating the file after each step
6. On success: `status: ready`, `completed_at` set
7. On failure: `status: failed`, `error` set

### Loom builder agent instructions (add to builder prompt)

```
After EVERY phase or step completion, update build.yaml:
1. Set the completed step/phase status to "done" with completed_at
2. Set the next step/phase status to "in_progress" with started_at
3. Recalculate progress (done_phases / total_phases)
4. Append to the log array
5. Write the file

This is how the UI tracks your progress in real time.
```

### Resume on failure

Because state is in `build.yaml`, Loom can resume:
1. Read `build.yaml` → find last `done` phase
2. Pick up from next `pending` or `failed` phase
3. Continue updating normally

---

## GlowForge UI Components

### BuildCard (in ToolRegistry)

Replaces the normal ToolCard when `build.yaml` exists and `status !== ready`.

```
┌─────────────────────────────────┐
│ 🔨 RSS Feed Monitor             │
│ ━━━━━━━━━━━░░░░░░░░░░░  35%    │
│ Building: Feed polling loop      │
│                                  │
│ ✓ Scaffold                       │
│ ◐ Core Implementation (2/3)     │
│ ○ API Endpoints                  │
│ ○ Testing                        │
│ ○ Registration                   │
└─────────────────────────────────┘
```

### Visual States

| Status | Card Style |
|--------|-----------|
| `pending` | Faded/ghost card, dashed border, "Queued..." text |
| `building` | Pulsing border glow, progress bar, active step shown |
| `testing` | Amber pulse, "Verifying..." text, spinner |
| `ready` | Brief ✨ animation, transitions to normal ToolCard |
| `failed` | Red border, error message shown, "Retry" button |

### Build Detail View (expanded)

When user clicks into a building tool:
- Full phase list with step-level checkboxes
- Current step highlighted with pulse animation
- Build log at the bottom (auto-scrolls, monospace)
- File artifacts as clickable links
- Original prompt shown at the top
- Elapsed time / ETA

### Polling

- While any tool has `status: building|testing|pending`:
  - Poll `build.yaml` every 3s via Lantern API or direct file read
- When all tools are `ready|failed`:
  - Stop polling, fall back to normal registry refresh interval

---

## GlowForge API

### Reading build.yaml

Option A: **Lantern API** (preferred — already scans tool dirs)
- Add `GET /api/tools/:id/build` → returns parsed build.yaml
- Lantern already watches tool dirs, minimal new code

Option B: **Vite plugin** (like browser-queue)
- `GET /api/build/:tool_id` → reads ~/tools/{id}/build.yaml
- More control but duplicates Lantern's dir scanning

### New frontend files

```
src/
  api/build.ts                    # fetchBuildStatus(toolId) → BuildManifest
  components/ToolRegistry/
    BuildCard.tsx                  # Card variant for building tools
    BuildDetail.tsx                # Expanded view with phases, steps, log
    BuildProgress.tsx              # Progress bar + phase indicators
```

---

## Multiple Concurrent Builds

When user says "build me 3 tools," all three appear simultaneously:

```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ 🔨 RSS Monitor    │ │ 🔨 Slack Bot      │ │ 🔨 PDF Generator  │
│ ━━━━━━━░░░  35%  │ │ ━━━━━━━━━░  60%  │ │ ━░░░░░░░░  10%  │
│ Core (2/3)       │ │ Testing...       │ │ Scaffold...      │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

Each has its own `build.yaml`, each updates independently.

---

## Build Phases for the Build System Itself

### 1. build.yaml reader + types
- Parse YAML, TypeScript types for BuildManifest, Phase, Step
- `src/api/build.ts` with `fetchBuildStatus()`

### 2. BuildCard component
- Compact card with progress bar, phase list, status styling
- Pulsing border animation for active builds

### 3. BuildDetail view
- Full expanded view with step-level progress
- Build log with auto-scroll
- File artifact links

### 4. Registry integration
- ToolList checks for build.yaml on each tool
- Renders BuildCard instead of ToolCard when building
- Polls build.yaml at 3s interval during active builds
- Transitions to ToolCard when ready

### 5. Loom builder prompt update
- Add build.yaml update instructions to the tool creation agent
- Ensure every phase/step writes progress
