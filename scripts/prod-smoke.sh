#!/usr/bin/env bash
set -euo pipefail

LANTERN_URL="${LANTERN_URL:-http://127.0.0.1:4777}"
GLOWFORGE_URL="${GLOWFORGE_URL:-http://127.0.0.1:41000}"
TRIES="${TRIES:-3}"
TIMEOUT_SEC="${TIMEOUT_SEC:-10}"

TMP_ROOT="${TMPDIR:-/tmp}/gf_prod_smoke"
mkdir -p "$TMP_ROOT"

pass() {
  printf '[PASS] %s\n' "$1"
}

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  exit 1
}

check_status() {
  local label="$1"
  local method="$2"
  local url="$3"
  local expected="$4"
  local body_file="$TMP_ROOT/${label}.json"

  local code
  if [[ "$method" == "GET" ]]; then
    code=$(curl -sS -m "$TIMEOUT_SEC" -o "$body_file" -w '%{http_code}' "$url")
  else
    code=$(curl -sS -m "$TIMEOUT_SEC" -X "$method" -o "$body_file" -w '%{http_code}' "$url")
  fi

  if [[ "$code" != "$expected" ]]; then
    printf '[DEBUG] %s returned %s (expected %s)\n' "$label" "$code" "$expected" >&2
    cat "$body_file" >&2 || true
    fail "$label"
  fi

  pass "$label"
}

check_contains() {
  local label="$1"
  local file="$2"
  local token="$3"

  if ! grep -q "$token" "$file"; then
    printf '[DEBUG] %s missing token %s\n' "$label" "$token" >&2
    cat "$file" >&2 || true
    fail "$label"
  fi

  pass "$label"
}

probe_during() {
  local label="$1"
  local trigger_url="$2"
  local check_url="$3"

  local i
  for i in $(seq 1 "$TRIES"); do
    local trigger_file="$TMP_ROOT/${label}_trigger_${i}.json"
    local check_file="$TMP_ROOT/${label}_check_${i}.json"

    curl -sS -m 120 -X POST "$trigger_url" >"$trigger_file" &
    local trigger_pid=$!

    sleep 0.4

    local code
    code=$(curl -sS -m "$TIMEOUT_SEC" -o "$check_file" -w '%{http_code}' "$check_url")

    wait "$trigger_pid"

    if [[ "$code" != "200" ]]; then
      printf '[DEBUG] %s attempt %s returned %s\n' "$label" "$i" "$code" >&2
      cat "$check_file" >&2 || true
      fail "$label"
    fi
  done

  pass "$label"
}

printf 'Running GlowForge production smoke checks...\n'

check_status "lantern_health" "GET" "$LANTERN_URL/api/health" "200"
check_status "projects_list" "GET" "$LANTERN_URL/api/projects" "200"
check_status "tools_list" "GET" "$LANTERN_URL/api/tools" "200"
check_status "loom_proxy_health" "GET" "$GLOWFORGE_URL/loom-api/health" "200"
check_contains "loom_proxy_service" "$TMP_ROOT/loom_proxy_health.json" '"service":"loom"'

probe_during "projects_during_scan" "$LANTERN_URL/api/projects/scan" "$LANTERN_URL/api/projects"
probe_during "tools_during_scan" "$LANTERN_URL/api/projects/scan" "$LANTERN_URL/api/tools"
probe_during "projects_during_refresh" "$LANTERN_URL/api/projects/discovery/refresh" "$LANTERN_URL/api/projects"

printf 'All production smoke checks passed.\n'
