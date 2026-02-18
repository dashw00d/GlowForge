# QA Fixes — Repair Checklist

Source: `QA-REPORT.md` from 2026-02-18 QA run.

## Fix Order

### 1. ✅ FIXED — Loom proxy port — `c3c8b18`
### 2. ✅ FIXED — Lantern lifecycle API paths — `29f4372`
### 3. ✅ FIXED — Log streaming 406 — `34fbe3f`
### 4. ✅ FIXED — Build polling spam — `ea7d0f1`
### 5. ✅ FIXED — Filter counter mismatch — `9dd3b8c`

### 6. [LOW] Lifecycle button feedback — NOT FIXED
No loading state on Start/Stop/Restart. Add spinner while action is in progress.
Show error toast if action fails (currently silent).
File: `src/components/ToolRegistry/ToolDetail.tsx` or ToolCard.tsx

### 7. [LOW] Jobs endpoint path — NOT FIXED
UI calls `/loom-api/jobs` → Loom has no `/jobs` endpoint (404).
Should call `/loom-api/history` instead.
File: wherever Jobs/History is fetched — check `src/components/LoomChat/JobPanel.tsx`

## After fixes 6+7 → SCOUT PHASE
Test everything against `https://glowforge.glow` with curl.
Report new findings. If clean → write ALL CLEAR in HANDOFF.md.
