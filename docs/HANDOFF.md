# GlowForge Handoff — Builder Mode

## Last Run (2026-02-18)

### Completed: Browser Extension Scaffold — `9492910`

Built the **complete Chrome/Brave Manifest V3 extension** at `extension/`:

```
extension/
  manifest.json          ← MV3, host_permissions: <all_urls>, module background
  background.js          ← Service worker: poll loop (5s), tab pool, task dispatch
  content.js             ← DOM actions: navigate/click/type/scrape/scroll_feed/like/follow/reply
  lib/
    humanize.js          ← Bezier mouse curves, ease-in-out scroll, per-char typing cadence
    queue-client.js      ← fetchTask() with TTL check, postResult(), fetchQueueStatus()
    task-executor.js     ← executeTask(task, tabId): navigate tab + message content script
  popup/
    popup.html           ← Dark UI: URL config, status dot, stats grid, enable toggle
    popup.js             ← GET_STATUS / SET_CONFIG / TEST_CONNECTION ↔ background.js
  icons/
    icon16/48/128.png    ← Generated orange gradient icons
```

**Key design decisions:**
- `background.js` uses `setTimeout` loop (not just `chrome.alarms`) for 5s polling since alarms min is 1 min
- Content script loaded via manifest `content_scripts` so it's always ready before background messages it
- `humanize.js` ported from Python: BezierCurve.decasteljau, ease-in-out, overshoot/correction, per-char typing delay with punctuation variance, smooth scroll with easing
- Extension is zero-auth for MVP — just a URL in the popup

## What's Next

The extension needs a **server to talk to**. Pick next:

### Option A: Server-side task queue (Phase 4)
- `GET /api/browser/tasks` — returns next pending task
- `POST /api/browser/results/{id}` — store result
- `GET /api/browser/queue` — queue status
- In-memory queue with TTL expiry (array + filter)
- Add to GlowForge's Vite dev server or create `server/browser-queue.ts`

### Option B: Tab management standalone task
- More extension polish: retry logic, per-tab timeout, task progress reporting

### Recommended: Server-side task queue
Without the server endpoints, the extension has nothing to poll. Build that next so the full loop works end-to-end.

## Install the Extension Now

```
chrome://extensions → Enable Developer Mode → Load unpacked → extension/
```

Then click the 🔥 icon, enter `http://localhost:5274`, save.

## Project State
- `~/tools/GlowForge/` — 9 commits total
- Extension: complete scaffold, all files passing syntax check
- Frontend: Phase 1 UI complete (7 commits)
- Server-side queue: not yet built
