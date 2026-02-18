# QA Fixes — Repair Checklist

Source: `QA-REPORT.md` from 2026-02-18 QA run.

## Fix Order

### 1. ✅ FIXED — Loom proxy port — `c3c8b18`
### 2. ✅ FIXED — Lantern lifecycle API paths — `29f4372`
### 3. ✅ FIXED — Log streaming 406 — `34fbe3f`
### 4. ✅ FIXED — Build polling spam — `ea7d0f1`
### 5. ✅ FIXED — Filter counter mismatch — `9dd3b8c`

### 6. ✅ FIXED — Lifecycle button feedback — already implemented
Spinners (`toggling`/`restarting` state) and `actionError` banner were already in ToolDetail.tsx
from prior session. No new code needed — verified present in code.

### 7. ✅ FIXED — Loom history key mismatch — `2ceeb2d`
`listHistory()` was reading `r.history` but Loom `/history` returns `{"runs": [...]}`.
Fixed to `r.runs ?? r.history ?? []`. History panel now receives data correctly.

---

## SCOUT PHASE — COMPLETE
All 7 fixes applied. Full endpoint sweep run against `https://glowforge.glow`.

### Scout Results
| Endpoint | Status |
|---|---|
| `GET /lantern-api/api/tools` | ✅ 200, 9 tools returned |
| `GET /lantern-api/api/tools/:id` | ✅ 200, full detail |
| `GET /lantern-api/api/tools/:id/docs` | ✅ 200, docs with content |
| `GET /lantern-api/api/health` | ✅ 200, health map by tool name |
| `GET /lantern-api/api/system/health` | ✅ 200, system checks |
| `POST /lantern-api/api/projects/:name/activate` | ✅ route exists |
| `POST /lantern-api/api/projects/:name/deactivate` | ✅ route exists |
| `POST /lantern-api/api/projects/:name/restart` | ✅ route exists |
| `GET /lantern-api/api/projects/:name/logs` | ✅ SSE stream opened |
| `GET /loom-api/health` | ✅ 200, `{status: ok}` |
| `POST /loom-api/prompt` | ✅ 200 |
| `GET /loom-api/history` | ✅ 200, returns `{runs:[...]}` — now correctly read |
| `GET /loom-api/schedules` | ✅ 200, returns `{schedules:[...]}` — correctly read |
| `PATCH /loom-api/schedules/:id` | ✅ route exists |
| `POST /api/scaffold` | ✅ 201 |

### No new bugs found → ALL CLEAR
