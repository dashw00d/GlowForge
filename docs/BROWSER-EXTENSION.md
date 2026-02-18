# GlowForge Browser Extension

## The Model

The browser isn't on the server — it's on the user's machine, where they're already logged into everything. The server dispatches tasks, the extension executes them.

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  VM (GlowForge)         │         │  User's Browser          │
│                         │  poll   │                          │
│  Loom: "scroll twitter, │◄────────│  Chrome/Brave Extension  │
│   collect posts"        │         │                          │
│                         │────────►│  - Human-like mouse      │
│  /api/browser/tasks     │  task   │  - Natural scroll        │
│  /api/browser/results   │         │  - Typing cadence        │
│                         │◄────────│  - Anti-detection        │
│  Task queue + results   │ results │  - Already authed ✅      │
└─────────────────────────┘         └──────────────────────────┘
```

## Two Data Paths

- **Mass data** (public, no auth) → GhostGraph workers on VPS fleet
- **Auth-gated / slow / interactive** → Extension in user's real browser

## Extension Architecture

### Components

```
extension/
  manifest.json          — Manifest V3, permissions for tabs + activeTab + storage
  background.js          — Service worker: polls task queue, manages tab lifecycle
  content.js             — Injected into pages: DOM interaction, scraping, humanized actions
  lib/
    humanize.js          — Mouse curves, scroll patterns, typing cadence (ported from ~/tools/browser/)
    task-executor.js     — Parses task payloads, dispatches to content script actions
    queue-client.js      — Polls /api/browser/tasks, posts to /api/browser/results
  popup/
    popup.html           — Simple config: GlowForge URL, connection status, task count
    popup.js
```

### Task Flow

1. **background.js** polls `{glowforge_url}/api/browser/tasks` every 5s
2. Gets a task payload (or empty — sleep)
3. Opens a new tab (or reuses existing) for the target URL
4. Injects **content.js** into the tab
5. content.js executes the task with **humanize.js** behaviors
6. Results (scraped data, screenshots, success/fail) sent back via background.js
7. background.js POSTs to `{glowforge_url}/api/browser/results/{task_id}`

### Task Payload Format

```json
{
  "id": "task_abc123",
  "created_at": "2026-02-18T03:55:00Z",
  "ttl_seconds": 300,
  "action": "scroll_feed",
  "target_url": "https://twitter.com/home",
  "params": {
    "scroll_times": 5,
    "max_tweets": 50,
    "collect": true
  }
}
```

### Task Types (MVP)

| Action | What it does | Returns |
|--------|-------------|---------|
| `navigate` | Open URL in tab | page title, final URL |
| `scroll_feed` | Scroll and collect posts | array of post objects |
| `click` | Click element by selector | success/fail |
| `type` | Type text into element | success/fail |
| `scrape` | Extract data via selectors | structured data |
| `screenshot` | Capture visible tab | base64 PNG |
| `follow` | Follow a user (Twitter) | success/already_following |
| `like` | Like a post | success/already_liked |
| `reply` | Type and submit reply | success/fail |

### TTL / Timeout

- Tasks have a `ttl_seconds` field (default 300 = 5 min)
- Extension checks `created_at + ttl_seconds > now` before executing
- Expired tasks are skipped and reported as `{ status: "expired" }`
- If browser was closed for an hour, old tasks won't run, fresh ones will

### No Auth (MVP)

- No authentication between extension and GlowForge API
- Just a URL configured in the popup
- Future: CSRF token, API key, or cookie-based auth

### Installation

Developer mode sideload (same as OpenClaw):
1. `chrome://extensions` → Enable Developer Mode
2. Load unpacked → point to `extension/` folder
3. Click extension icon → enter GlowForge URL
4. Green dot = connected, polling for tasks

## Server Side (Lantern endpoint)

New Lantern-managed endpoint or simple addition to GlowForge API:

```
GET  /api/browser/tasks          — returns next pending task (FIFO, respects TTL)
POST /api/browser/results/{id}   — extension posts task result
GET  /api/browser/queue           — queue status (pending count, recent results)
```

Task queue can be in-memory for MVP (array with TTL expiry). Redis later if needed.

## Humanize Intelligence (ported from ~/tools/browser/)

The extension carries the same anti-detection behaviors:
- **Mouse curves**: Bezier paths, not teleporting
- **Scroll patterns**: Variable speed, occasional pauses, overshoot
- **Typing cadence**: Per-character delays with variance, occasional typos + backspace
- **Click behavior**: Move to element, hover briefly, then click
- **Idle behavior**: Random micro-movements when "thinking"

These are the same algorithms from `~/tools/browser/` but compiled into the extension's `lib/humanize.js`.
