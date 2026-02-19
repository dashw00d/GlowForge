# GlowForge Production Runbook

## Goal

Deploy the current GlowForge + Loom + Lantern integration and verify the core path:

1. Scaffold tool
2. Register/sync in Lantern
3. Trigger Loom build
4. Build phases move to `ready`
5. Tool ends in `running`

## 1) Pre-deploy checks (source repos)

### GlowForge

```bash
cd /home/ryan/tools/GlowForge
npm run lint
npm run build
```

### Loom

```bash
cd /home/ryan/tools/Loom
python3 -m compileall api.py loom
```

### Lantern

```bash
cd /home/ryan/tools/Lantern/daemon
mix compile
```

## 2) Build and install Lantern runtime

```bash
cd /home/ryan/tools/Lantern
bash packaging/build-deb.sh
sudo bash install.sh
sudo systemctl restart lanternd
sudo systemctl status lanternd --no-pager
```

Expected: `Active: active (running)`.

## 3) Restart managed app processes

```bash
curl -sS -X POST http://127.0.0.1:4777/api/projects/Loom/restart
curl -sS -X POST http://127.0.0.1:4777/api/projects/GlowForge/restart
```

## 4) Verify ports and routing

```bash
ss -ltnp | rg ':4777|:41000|:41001|:41002'
curl -sS http://127.0.0.1:41000/loom-api/health
```

Expected:
- Lantern: `127.0.0.1:4777`
- GlowForge: `:41000`
- Loom: `:41001`
- `:41002` may belong to another managed project; it should not be mistaken for Loom
- `/loom-api/health` returns `"service":"loom"`

## 5) Run automated smoke checks

```bash
cd /home/ryan/tools/GlowForge
bash scripts/prod-smoke.sh
```

This checks:
- Lantern health + list endpoints
- GlowForge -> Loom proxy correctness
- No `500` responses from `/api/projects` or `/api/tools` during active scan/refresh

## 6) Full MVP flow spot-check (manual)

In GlowForge UI:
1. Create a tool via New Tool wizard
2. Confirm BuildCard appears in `pending`
3. Confirm phases progress and final status becomes `ready`
4. Confirm tool appears/runs in registry without manual refresh

## Rollback

If production behavior regresses:

1. Reinstall previous known-good Lantern package
2. Restart `lanternd`
3. Restart Loom + GlowForge projects via Lantern API

Keep commit SHAs and package artifacts for the last known-good release.
