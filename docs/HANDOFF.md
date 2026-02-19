# GlowForge Handoff

## Status (2026-02-19)

Operational handoff is complete. Current work is in steady-state operations and production hardening.

Use these docs as the source of truth:

- `docs/PRODUCTION-RUNBOOK.md` — deploy/restart/verification steps
- `docs/ENDPOINTS.md` — current endpoint map and routing notes
- `docs/QA-FIXES.md` — historical repair checklist from prior QA cycle

## Notes

- Loom routing is dynamic via Lantern project data, with `/loom-api` as a fallback path.
- New-tool build flows depend on workspace metadata (`workspace`, `tool_id`) being passed into Loom prompt execution.
- If behavior diverges from docs, run `scripts/prod-smoke.sh` first, then update docs with observed runtime truth.
