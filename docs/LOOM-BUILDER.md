# Loom Builder Agent — build.yaml Integration

This document explains how Loom builder agents should interact with `build.yaml`
so the GlowForge UI shows live build progress.

---

## Overview

When the GlowForge wizard creates a tool, it writes an initial `build.yaml` in
the tool directory with `status: pending`. GlowForge polls this file every 3
seconds and renders a `BuildCard` in the registry with a live progress bar.

**Your job as the builder agent:** Keep `build.yaml` up to date as you work.
Every phase/step completion should immediately update the file.

---

## File Location

```
~/tools/{tool-id}/build.yaml
```

The `tool-id` matches the `id` field in `lantern.yaml` (slugified, lowercase).

---

## Status Lifecycle

```
pending → building → testing → ready
                  ↘ failed
```

- **pending** — Scaffolded, waiting for agent to start
- **building** — Agent is working (core + API phases)
- **testing** — Running tests, verifying health endpoint
- **ready** — Done! GlowForge transitions to normal ToolCard
- **failed** — Something broke; `error` field is set

---

## Standard Phases

Every build follows these phases (skip or add as needed):

| Phase ID  | Name                  | When                          |
|-----------|-----------------------|-------------------------------|
| `scaffold`| Project Scaffold      | Files created, deps installed |
| `core`    | Core Implementation   | Main logic written            |
| `api`     | API Endpoints         | HTTP routes, health check     |
| `test`    | Testing & Verification| Tests run, build verified     |
| `register`| Lantern Registration  | Service started, health OK    |

---

## build.yaml Schema

```yaml
tool_id: my-tool           # matches lantern.yaml id
name: My Tool              # display name
prompt: "Build me a..."    # original user request
status: building           # pending | building | testing | ready | failed
started_at: "2026-02-18T10:30:00Z"
progress: 0.35             # 0-1 float — computed from phases

# Set when status → ready|failed:
completed_at: "2026-02-18T10:35:00Z"
error: "npm run build failed"   # only set on failure

phases:
  - id: scaffold
    name: Project Scaffold
    status: done           # pending | in_progress | done | failed | skipped
    started_at: "2026-02-18T10:30:01Z"
    completed_at: "2026-02-18T10:30:05Z"
    artifacts:             # optional — files created
      - lantern.yaml
      - README.md

  - id: core
    name: Core Implementation
    status: in_progress
    started_at: "2026-02-18T10:30:06Z"
    steps:                 # optional — granular step tracking
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

  - id: test
    name: Testing & Verification
    status: pending

  - id: register
    name: Lantern Registration
    status: pending

log:
  - time: "2026-02-18T10:30:01Z"
    msg: "Starting core implementation"
  - time: "2026-02-18T10:30:15Z"
    msg: "✓ RSS parser module — feedparser + async fetch"
```

---

## Update Protocol

**After EVERY phase or step completion, update build.yaml:**

1. Set the completed step/phase `status: done` and `completed_at: <now>`
2. Set the next step/phase `status: in_progress` and `started_at: <now>`
3. Recalculate `progress`:
   - `progress = done_phases / total_phases` (simple)
   - Or partial: account for in_progress phase's step completion
4. Append to the `log` array with timestamp + message
5. Write the file

**Example — transitioning from scaffold → core:**

```yaml
# Before:
- id: scaffold
  status: in_progress
  started_at: "2026-02-18T10:30:01Z"
- id: core
  status: pending

# After scaffold completes:
- id: scaffold
  status: done
  started_at: "2026-02-18T10:30:01Z"
  completed_at: "2026-02-18T10:30:05Z"
  artifacts:
    - lantern.yaml
    - README.md
- id: core
  status: in_progress
  started_at: "2026-02-18T10:30:05Z"
```

---

## Progress Calculation

```
progress = sum(phase_weight for done phases) + partial_weight

Where:
  phase_weight = 1 / total_phases   # equal weight per phase
  partial_weight = (done_steps / total_steps) * phase_weight  # if steps defined
```

**Examples (5 phases):**
- 0 done → `progress: 0`
- 1 done, 0 in_progress → `progress: 0.2`
- 2 done, in_progress with 2/3 steps done → `progress: 0.53`
- All done → `progress: 1.0`

---

## Key Status Transitions

### Start building
```yaml
status: building
progress: 0
# set scaffold phase to in_progress
```

### Advance a phase
```yaml
# complete current phase, start next
# recalculate progress
# append log entry
```

### Start testing
```yaml
status: testing
# test phase → in_progress
```

### Success
```yaml
status: ready
progress: 1.0
completed_at: "2026-02-18T10:35:00Z"
# all phases → done
```

### Failure
```yaml
status: failed
error: "Describe what went wrong"
completed_at: "2026-02-18T10:34:30Z"
# failed phase → failed
```

---

## Minimal Start (first thing you do)

When you pick up a tool with `status: pending`, immediately update to `building`:

```yaml
tool_id: my-tool
name: My Tool
prompt: "Original user request"
status: building
started_at: "2026-02-18T10:30:00Z"   # keep original
progress: 0

phases:
  - id: scaffold
    name: Project Scaffold
    status: in_progress
    started_at: "2026-02-18T10:30:06Z"
  # ... rest of phases remain pending

log:
  - time: "2026-02-18T10:30:00Z"
    msg: "Tool created via GlowForge wizard"
  - time: "2026-02-18T10:30:06Z"
    msg: "Builder agent started — beginning scaffold phase"
```

---

## Resume on Failure

Because all state is in `build.yaml`, you can always resume:

1. Read `build.yaml` → find last `done` phase
2. Find next `pending` or `failed` phase
3. Set it to `in_progress` and continue
4. Update status back to `building`

---

## GlowForge API (read-only, for verification)

If you need to check the current state from the API:

```
GET http://localhost:5274/api/build/{tool-id}
→ returns parsed BuildManifest JSON
```

To write from a script during build:
```
POST http://localhost:5274/api/build/{tool-id}/write
Content-Type: application/json
{ "content": "...yaml string..." }
```

---

## Summary Checklist

Before marking any phase done:
- [ ] All files for this phase are written and valid
- [ ] Updated `build.yaml` with phase status + timestamps
- [ ] Recalculated and set `progress`
- [ ] Appended a log entry
- [ ] Written the file to disk

Before marking the build ready:
- [ ] All phases are `done`
- [ ] `progress: 1.0`
- [ ] `status: ready`
- [ ] `completed_at` is set
- [ ] Lantern has the tool registered and healthy
