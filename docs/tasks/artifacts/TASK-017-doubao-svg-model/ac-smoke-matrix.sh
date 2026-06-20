#!/usr/bin/env bash
# AC smoke matrix for TASK-017. Exercises the resolver end-to-end via the
# actual /api/story/generate and /api/story/hint routes. Server must already
# be running on $PORT (default 3999). Artifact only.
set -u
PORT="${1:-3999}"
BASE="http://localhost:${PORT}"
PASS=0
FAIL=0

probe() {
  local label="$1" method="$2" path="$3" body="$4" expect_status="$5" expect_json_key="$6"
  local resp
  resp=$(curl -sS -m 60 -X "$method" "$BASE$path" \
    -H "Content-Type: application/json" \
    --data-binary "$body" \
    -w "\n__HTTP=%{http_code}__TIME=%{time_total}__" 2>&1)
  local http=$(echo "$resp" | grep -oE '__HTTP=[0-9]+' | head -1 | cut -d= -f2)
  local time=$(echo "$resp" | grep -oE '__TIME=[0-9.]+' | head -1 | cut -d= -f2)
  local body_only=$(echo "$resp" | sed 's/__HTTP=.*//')
  if [ "$http" = "$expect_status" ] && echo "$body_only" | grep -q "\"$expect_json_key\""; then
    echo "PASS  $label  HTTP=$http time=${time}s"
    PASS=$((PASS + 1))
  else
    echo "FAIL  $label  HTTP=$http (expected $expect_status) time=${time}s"
    echo "      body: $(echo "$body_only" | head -c 200)"
    FAIL=$((FAIL + 1))
  fi
}

# Restart-preflight note: these tests assume the dev server reads the latest
# .env.local on each request (Next.js dev mode re-reads env on hot reload).
# For env-var changes, we restart the server externally.

# ---------- Test 1: no keys -> mock fallback (AC2) ----------
# Server must be running with BOTH DOUBAO_API_KEY and DEEPSEEK_API_KEY unset.
probe "AC2 generate no-keys -> mock" \
  POST /api/story/generate \
  '{"storySoFar":"","newLine":"test","speaker":"kid"}' \
  200 narration
probe "AC2 hint no-keys -> mock" \
  POST /api/story/hint \
  '{"storySoFar":"","lang":"zh"}' \
  200 hint

# ---------- Test 2: DeepSeek (no Doubao) -> real path or mock on error ----------
# Server should be running with DEEPSEEK_API_KEY set, DOUBAO_API_KEY unset.
probe "AC3 DeepSeek-path generate" \
  POST /api/story/generate \
  '{"storySoFar":"","newLine":"一只小恐龙","speaker":"kid"}' \
  200 narration
probe "AC3 DeepSeek-path hint" \
  POST /api/story/hint \
  '{"storySoFar":"","lang":"en"}' \
  200 hint

# ---------- Test 3: Doubao preferred (when both keys set) ----------
# Server should be running with BOTH keys set. May be slow (~30s) due to Doubao.
probe "AC3 Doubao-preferred generate (may be slow)" \
  POST /api/story/generate \
  '{"storySoFar":"","newLine":"月亮","speaker":"kid"}' \
  200 narration

echo ""
echo "=== Smoke matrix: $PASS pass, $FAIL fail ==="
[ "$FAIL" = "0" ]
