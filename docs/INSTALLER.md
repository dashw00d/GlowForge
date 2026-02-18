# GlowForge Installer & Settings

## Overview

Single command to install the entire GlowForge stack. Settings panel in the UI to configure providers, models, and services after install.

**Key insight:** Most users have Claude Pro/Max or ChatGPT Plus subscriptions, NOT API keys. OpenClaw already supports subscription auth:
- `mode: token` — Claude subscription (browser cookie auth)
- `mode: oauth` — OpenAI/Codex subscription (OAuth flow)
- `mode: api_key` — Traditional API key

The installer and settings panel must prioritize subscription-based auth as the default path.

---

## Installer

### Entry Point

```bash
# One-liner
curl -sSL https://glowforge.dev/install | bash

# Or clone
git clone https://github.com/glowforge/glowforge-installer
cd glowforge-installer && ./install.sh
```

### What Gets Installed

| Component | Source | Install Method | Required |
|-----------|--------|---------------|----------|
| OpenClaw | npm registry | `npm i -g openclaw` | Yes |
| Lantern | GitHub | Clone + mix release | Yes |
| Loom | GitHub | Clone + uv sync | Yes |
| GlowForge | GitHub | Clone + npm install | Yes |
| Browser Tool | GitHub | Clone (extension is manual sideload) | Optional |
| Ollama | ollama.com | curl installer | Yes (for memory) |
| ChromaDB | pip | pip install in Loom venv | Yes (for memory) |
| Caddy | apt/brew | Package manager | Yes (for .glow routing) |
| dnsmasq | apt/brew | Package manager | Yes (for .glow DNS) |

### Installer Flow

```
🔥 GlowForge Installer v1.0
════════════════════════════

[1/7] System check...
      ✓ Linux x64 (Ubuntu 24.04)
      ✓ Node.js 22.x
      ✓ Python 3.12
      ○ Elixir — installing via asdf...  ✓
      ○ Ollama — installing...  ✓

[2/7] Cloning projects into ~/tools/...
      ✓ Lantern    → ~/tools/Lantern
      ✓ Loom       → ~/tools/Loom
      ✓ GlowForge  → ~/tools/GlowForge
      ✓ Browser    → ~/tools/browser

[3/7] Installing dependencies...
      ✓ Lantern (mix deps.get + release)
      ✓ Loom (uv sync + chromadb)
      ✓ GlowForge (npm install)
      ✓ Ollama model: nomic-embed-text

[4/7] Installing OpenClaw...
      ✓ npm i -g openclaw

[5/7] Connect your AI provider...

      How do you access Claude/GPT?

      [1] Claude Pro/Max subscription (recommended — no API key)
          → Opens browser for Anthropic authentication
          
      [2] ChatGPT Plus/Pro subscription (no API key)
          → OAuth flow for OpenAI authentication
          
      [3] Anthropic API key
          → Paste your sk-ant-... key
          
      [4] OpenAI API key
          → Paste your sk-... key

      [5] Custom provider (OpenAI-compatible API)
          → Any provider: Z.AI, OpenRouter, Together, Groq, Ollama, etc.
          → Enter: name, base URL, API key
          
      [6] Multiple providers
          → Configure more than one (run this step again after)

      Choice: 5

      Provider name: Z.AI
      Base URL: https://api.z.ai/api/coding/paas/v4
      API key: ••••••••••••••••

      Testing connection...
      ✓ Connected to Z.AI
      ✓ Found 4 models: glm-5, glm-4.7, glm-4.7-flash, glm-4.7-flashx
      
      Use glm-5 as default model? [Y/n]: y

[6/7] Configuring services...
      ✓ OpenClaw gateway config written
      ✓ Lantern configured (scan: ~/tools/)
      ✓ Loom configured (OpenClaw + ChromaDB + Ollama)
      ✓ .glow DNS + Caddy routes configured
      ✓ systemd user services created

[7/7] Starting everything...
      ✓ Ollama          localhost:11434    🟢
      ✓ ChromaDB        localhost:8100     🟢
      ✓ OpenClaw        localhost:18789    🟢
      ✓ Lantern         localhost:4777     🟢
      ✓ Loom            loom.glow          🟢
      ✓ GlowForge       localhost:5274     🟢

════════════════════════════
🔥 GlowForge is ready!

Open: http://localhost:5274
      http://glowforge.glow

Browser extension: chrome://extensions → Load unpacked → ~/tools/browser/extension/
```

### OpenClaw Config Template (what installer writes)

For a subscription user, the config is minimal:

```json
{
  "auth": {
    "profiles": {
      "anthropic:default": {
        "provider": "anthropic",
        "mode": "token"
      }
    },
    "order": {
      "anthropic": ["anthropic:default"]
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-6"
      },
      "workspace": "~/glowforge/workspace",
      "timeoutSeconds": 600,
      "maxConcurrent": 8
    },
    "list": [
      {
        "id": "main",
        "model": "anthropic/claude-sonnet-4-6"
      }
    ]
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "auth": { "mode": "token" }
  },
  "cron": {
    "enabled": true,
    "maxConcurrentRuns": 8
  },
  "plugins": {
    "entries": {
      "chromadb-memory": {
        "enabled": true,
        "config": {
          "chromaUrl": "http://localhost:8100",
          "ollamaUrl": "http://localhost:11434",
          "embeddingModel": "nomic-embed-text"
        }
      }
    }
  }
}
```

No custom agents, no channels, no skills. Just the bare minimum to make Loom work. Users add complexity through the GlowForge settings panel later.

### Auth Patterns

Three auth modes, covering every provider:

| Mode | Config | Examples | UX |
|------|--------|----------|-----|
| `token` | Browser cookie auth | Claude Pro/Max | Opens browser → user logs in |
| `oauth` | OAuth2 flow | ChatGPT Plus, Codex | Opens browser → OAuth consent |
| `api_key` | Paste key | Anthropic, OpenAI, Z.AI, OpenRouter, Groq, Together, Fireworks | Enter key + optional base URL |

**Claude subscription (`mode: token`):**
- `openclaw configure --section model` triggers browser-based auth
- User logs into claude.ai in their browser
- OpenClaw captures the session token
- No API key needed, uses their existing subscription

**OpenAI subscription (`mode: oauth`):**
- OAuth flow via browser
- Connects to user's ChatGPT Plus/Pro or Codex account

**API key — native provider (`mode: api_key`):**
- Paste key, provider endpoints are known
- `openclaw config set auth.profiles.anthropic:default.apiKey sk-ant-...`

**API key — OpenAI-compatible (`mode: api_key` + custom baseUrl):**
- Any provider that speaks the OpenAI API format
- User provides: name, base URL, API key
- Models auto-detected via `GET {baseUrl}/models` or added manually
- OpenClaw config:
  ```json
  {
    "auth.profiles.zai:default": {
      "provider": "zai",
      "mode": "api_key"
    },
    "models.providers.zai": {
      "baseUrl": "https://api.z.ai/api/coding/paas/v4",
      "api": "openai-completions",
      "models": [
        { "id": "glm-5", "name": "GLM-5", "contextWindow": 204800 }
      ]
    }
  }
  ```
- This is how Z.AI, OpenRouter, Together, Groq, Fireworks, local Ollama, vLLM, etc. all connect
- The settings panel "Test Connection" button verifies the key + discovers models

### Installer Script Structure

```
glowforge-installer/
  install.sh                  # Entry point
  lib/
    detect.sh                 # OS, arch, existing deps
    deps.sh                   # Install missing system deps
    clone.sh                  # Git clone all components
    build.sh                  # Build/install per-project deps
    auth.sh                   # Provider auth flow (wraps openclaw configure)
    config.sh                 # Write OpenClaw + Loom + Lantern configs
    services.sh               # Create systemd user services
    dns.sh                    # dnsmasq + Caddy .glow routing
    verify.sh                 # Health check all services
  configs/
    openclaw-template.json    # Minimal OpenClaw config
    loom-env.template         # Loom .env template
    caddy.json                # .glow proxy routes
    dnsmasq.conf              # .glow DNS resolution
  uninstall.sh                # Clean removal
```

### dns.sh — critical implementation notes

On Ubuntu/Debian with systemd-resolved (the default), standalone dnsmasq **will fail** because
systemd-resolved holds port 53 on 127.0.0.53. The installer must:

1. **Use NetworkManager's built-in dnsmasq** (not the standalone service):
   - Add `dns=dnsmasq` under `[main]` in `/etc/NetworkManager/NetworkManager.conf`
   - Write `address=/.glow/127.0.0.1` to `/etc/NetworkManager/dnsmasq.d/lantern.conf`
   - Disable the standalone dnsmasq service: `systemctl disable --now dnsmasq`
   - Restart NetworkManager: `systemctl restart NetworkManager`

2. **Fix resolv.conf** to use NM's dnsmasq (which listens on 127.0.1.1):
   - `ln -sf /run/NetworkManager/resolv.conf /etc/resolv.conf`
   - This ensures `.glow` queries hit NM's dnsmasq, which also forwards non-`.glow` upstream

3. **Verify** with `dig +short test.glow` — should return `127.0.0.1`

The Lantern `dns.ex` module writes the config file but does NOT enable `dns=dnsmasq` in
NetworkManager or fix the resolv.conf symlink — those are the installer's responsibility.

---

## Settings Panel (GlowForge UI)

### Location
Gear icon (⚙️) in top bar → opens Settings drawer/modal.

### Sections

#### Provider Config

```
AI Provider
───────────────────────────────

Connection: Claude Pro subscription  ✅ Connected
Account: ryan@example.com
Models available: Sonnet 4.6, Opus 4.6

Active Model: [Claude Sonnet 4.6  ▾]

───────────────────────────────

[+ Add another provider]

  Subscriptions (no API key needed):
  → Claude Pro / Max
  → ChatGPT Plus / Pro

  API Key (native):
  → Anthropic API
  → OpenAI API

  API Key (OpenAI-compatible — any provider):
  → Custom provider URL + key
  → e.g. Z.AI, OpenRouter, Together, Groq, Fireworks, local Ollama

  ┌─ Custom Provider ─────────────────────────┐
  │ Name:     [Z.AI                           ]│
  │ Base URL: [https://api.z.ai/api/coding/...] │
  │ API Key:  [••••••••••••••••••••••••••••••] │
  │                                            │
  │ Models: (auto-detected via /v1/models)     │
  │  ✅ glm-5           200K ctx   reasoning   │
  │  ✅ glm-4.7         200K ctx   reasoning   │
  │  ✅ glm-4.7-flash   200K ctx   reasoning   │
  │  ☐ glm-4.7-flashx  200K ctx   reasoning   │
  │                                            │
  │ [+ Add model manually]                     │
  │                                            │
  │ [Test Connection ✓]          [Save]        │
  └────────────────────────────────────────────┘

[Save & Restart Gateway]
```

**How it works:**
- `GET /api/settings/providers` → reads OpenClaw config, returns authed providers + available models
- `PUT /api/settings/model` → sets active model in OpenClaw config
- `POST /api/settings/auth/start` → initiates OAuth/token flow (opens browser)
- `POST /api/settings/restart` → restarts OpenClaw gateway

#### Service Health

```
Services
───────────────────────────────

OpenClaw    localhost:18789    🟢 running    [Restart]
Lantern     localhost:4777     🟢 running    [Restart]
Loom        loom.glow          🟢 running    [Restart]
ChromaDB    localhost:8100     🟢 running    [Restart]
Ollama      localhost:11434    🟢 running    
Extension   —                  🟡 not connected

                    [Restart All]
```

**How it works:**
- `GET /api/settings/health` → pings each service, returns status
- `POST /api/settings/services/:name/restart` → restart via systemd

#### Agent Config (advanced, collapsible)

```
▸ Advanced: Agent Config

  Workspace: ~/glowforge/workspace
  Max concurrent: [8]
  Timeout: [600s]
  
  Agents:
  ┌──────────┬────────────────────┬────────┐
  │ main     │ claude-sonnet-4-6  │ active │
  └──────────┴────────────────────┴────────┘
  
  [+ Add Agent]
```

Most users never touch this. Power users can add multiple agents for parallel work.

### GlowForge API Routes (Vite plugin)

```
GET    /api/settings                    → full settings state
GET    /api/settings/providers          → authed providers + models
PUT    /api/settings/model              → set active model
POST   /api/settings/auth/start         → begin auth flow for provider
POST   /api/settings/auth/callback      → complete auth flow
GET    /api/settings/health             → service health check
POST   /api/settings/services/:id/restart → restart a service
POST   /api/settings/gateway/restart    → restart OpenClaw gateway
PUT    /api/settings/agents             → update agent config
```

Under the hood, these routes call:
- `openclaw config get/set` for reading/writing OpenClaw config
- `openclaw gateway restart` or the gateway API for restarts
- `systemctl --user restart <service>` for Lantern/Loom/ChromaDB
- Direct HTTP pings for health checks

---

## Loom Dependencies

Loom needs these configured by the installer:

```bash
# .env for Loom
OPENCLAW_BIN=~/.volta/bin/openclaw    # or wherever npm put it
OPENCLAW_GATEWAY=http://localhost:18789
OPENCLAW_GATEWAY_TOKEN=<from openclaw config get gateway.auth.token>

# ChromaDB (for memory)
CHROMA_URL=http://localhost:8100

# Ollama (for embeddings)
OLLAMA_URL=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
```

The installer writes this after OpenClaw is configured, pulling the gateway token automatically.

---

## Upgrade Path

```bash
# Update all components
glowforge update

# Or individually
glowforge update openclaw
glowforge update lantern
glowforge update loom
```

The `glowforge` CLI could be a thin wrapper script installed alongside:
```bash
# ~/bin/glowforge or /usr/local/bin/glowforge
case "$1" in
  update) ... ;;
  start)  ... ;;
  stop)   ... ;;
  status) ... ;;
  doctor) ... ;; # health check everything
esac
```

---

## Build Order

### Phase 1: Installer script
- System detection + dep installation
- Clone repos + install deps
- Auth flow (subscription-first)
- Config generation
- Service startup + verification

### Phase 2: Settings Vite plugin
- `/api/settings/*` routes
- OpenClaw config read/write via CLI
- Service health pings
- Gateway restart

### Phase 3: Settings UI
- Provider config panel (subscription-first UX)
- Model picker dropdown
- Service health dashboard
- Restart buttons

### Phase 4: CLI wrapper
- `glowforge start/stop/status/update/doctor`
- Wraps systemd + git pull + npm/uv install
