# Integration — Wiring Twitter Intel ↔ GlowForge Queue ↔ Extension ↔ Loom

> Historical integration design doc.
> Keep for reference, but validate runtime behavior against `docs/ENDPOINTS.md` and live smoke tests.

## Current State (2026-02-19)

Core queue connectivity is live:

```
Twitter Intel ──POST──→ GlowForge browser queue
Extension    ──poll──→ executes tasks ──POST results──→ GlowForge
Loom         ──POST──→ GlowForge browser queue (same task path)
```

Remaining work in this area is mostly product polish (auto-discovery, stronger callback guarantees, richer routing policies).

---

## Original Gap Analysis (Historical)

## The Fix

GlowForge's queue is the integration hub:

```
Twitter Intel ──POST──→ GlowForge Queue ←──poll── Extension
                              │
                    results stored
                              │
Twitter Intel ──poll/webhook──┘
Loom ──────────POST──→ GlowForge Queue (same path)
```

---

## Change 1: GlowForge Queue — Add Callbacks

The queue needs to support result callbacks so twitter-intel doesn't have to poll.

### New field on BrowserTask:

```typescript
interface BrowserTask {
  id: string
  created_at: string
  ttl_seconds: number
  action: string
  target_url?: string
  params?: Record<string, unknown>
  callback_url?: string  // NEW — POST result here when complete
  source?: string        // NEW — who submitted ("twitter-intel", "loom", "manual")
  correlation_id?: string // NEW — caller's own ID for matching
}
```

### When extension posts a result:

```
POST /api/browser/results/{task_id}
  → store result as before
  → IF task.callback_url exists:
      → POST result to callback_url (fire-and-forget, 5s timeout)
```

### New endpoint for polling results by source:

```
GET /api/browser/results?source=twitter-intel&since=<ISO timestamp>&limit=50
```

This way twitter-intel can either:
- **Option A:** Submit with `callback_url` → get notified immediately (preferred)
- **Option B:** Poll `/api/browser/results?source=twitter-intel` periodically

---

## Change 2: Twitter Intel — Rewrite browser_executor.py

Replace calls to dead `localhost:41001/tasks/execute` with GlowForge queue submissions.

### Before (dead):
```python
resp = await client.post(f"{BROWSER_BASE_URL}/tasks/execute", json=payload)
# Synchronous — waits for browser to finish
```

### After (async via queue):
```python
GLOWFORGE_URL = os.environ.get("GLOWFORGE_URL", "https://glowforge.glow")

async def submit_browser_task(action: str, params: dict, target_url: str = None) -> str:
    """Submit task to GlowForge queue, return task_id."""
    task = {
        "action": action,
        "target_url": target_url,
        "params": params,
        "ttl_seconds": 120,
        "source": "twitter-intel",
        "callback_url": f"http://localhost:{SELF_PORT}/browser-result",
    }
    resp = await httpx.AsyncClient().post(
        f"{GLOWFORGE_URL}/api/browser/tasks",
        json=task,
    )
    return resp.json()["id"]
```

### New endpoint in twitter-intel: `POST /browser-result`

Receives callbacks from GlowForge when extension completes a task:
```python
@app.post("/browser-result")
async def browser_result_callback(result: dict):
    task_id = result["task_id"]
    status = result["status"]
    data = result.get("data", {})
    
    # Feed into tracker → bandit reward
    tracker.record_result(task_id, status, data)
    
    # If this was a feed scan, ingest the collected posts
    if data.get("items"):
        ingest_posts(data["items"])
```

### Execution flow becomes:

```
1. Twitter Intel: POST /api/browser/tasks → {action: "scroll_feed", callback_url: ...}
2. Extension: polls → gets task → scrolls feed → collects posts
3. Extension: POST /api/browser/results/{id} → {status: "success", data: {items: [...]}}
4. GlowForge: stores result → POSTs to callback_url
5. Twitter Intel: receives callback → ingests posts → runs engagement plan
6. Twitter Intel: POST /api/browser/tasks → {action: "like", target_url: "https://x.com/..."}
7. Extension: executes like with humanize
8. GlowForge: callback → Twitter Intel tracker → bandit reward
```

---

## Change 3: Loom — Browser Tool Awareness

Loom needs a way to dispatch browser tasks. Two options:

### Option A: Tool registration in Lantern (clean)

Twitter-intel already has a `lantern.yaml`. Add GlowForge queue as a registered capability:

```yaml
# ~/tools/twitter-intel/lantern.yaml
browser_actions:
  - scroll_feed
  - like
  - reply
  - follow
  - extract_posts
  - run_steps  # schema-based playback
queue_url: https://glowforge.glow/api/browser
```

Loom's tool selection node can then see "browser actions available" and include them in the plan.

### Option B: Direct HTTP action in Loom scheduler (quick)

Loom already has `http` action type in its scheduler. It can POST directly to GlowForge's queue:

```json
{
  "action_type": "http",
  "url": "https://glowforge.glow/api/browser/tasks",
  "method": "POST",
  "body": {
    "action": "run_steps",
    "params": {
      "steps": [...],
      "params": { "query": "wedding venues 90210" }
    }
  }
}
```

### Recommended: Start with Option B (zero code changes in Loom), migrate to Option A later.

---

## Change 4: Results Feedback Loop

The tracker in twitter-intel needs to close the loop:

```
Extension result → GlowForge callback → twitter-intel tracker
  → log_actions() → check_reciprocity() → update_bandit_from_feedback()
```

This already exists in `tracker.py` — it just needs to be triggered by the callback endpoint instead of the old synchronous execution path.

### Bandit reward mapping:

| Extension Result | Bandit Reward | Reason |
|-----------------|---------------|--------|
| like: success | 0.6 | Baseline positive |
| like: already_liked | 0.3 | Wasted action |
| reply: success | 0.8 | High-value action succeeded |
| reply: error | 0.1 | Failed attempt |
| follow: success | 0.7 | Relationship building |
| follow: already_following | 0.2 | Wasted action |
| scroll_feed: success | N/A | Feed scan, not engagement |

Reciprocity check runs periodically and upgrades rewards retroactively:
- If target replied back within 7 days → bonus +0.3 to original action
- If target liked back → bonus +0.1
