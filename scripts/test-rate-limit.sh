#!/usr/bin/env bash
# Test a Cloudflare WAF rate-limiting rule by firing a burst of requests
# and verifying the expected 200 → 429 pattern, then a recovery check
# after the rate window resets.
#
# Defaults match the `referrals-validate-anti-enum` rule
# (5 req / 10s / Block — see CLAUDE.md). Use --path / --threshold /
# --window to retarget against any other rate-limited endpoint.
#
# Examples:
#   scripts/test-rate-limit.sh --domain wc2026.example.com
#   scripts/test-rate-limit.sh --domain wc2026.example.com \
#       --path /api/auth/forgot-password --threshold 5 --window 60
#   WC2026_DOMAIN=wc2026.example.com scripts/test-rate-limit.sh
#
# Exit codes:
#   0  burst + recovery match the configured rule
#   1  rule isn't matching, fires earlier than expected, or recovery fails
#   2  misconfiguration (missing args, no curl, bad flags)

set -euo pipefail

DOMAIN="${WC2026_DOMAIN:-}"
TEST_PATH="/api/referrals/validate?code=AAAAAAAA"
THRESHOLD=5
WINDOW_SECONDS=10
SKIP_RECOVERY=0

usage() {
  cat <<EOF
Usage: $0 --domain <host> [options]

Required:
  --domain HOST              Production hostname behind Cloudflare
                             (or set WC2026_DOMAIN env var).

Options:
  --path PATH                URL path + query to test
                             (default: $TEST_PATH)
  --threshold N              Expected request threshold the rule enforces
                             (default: $THRESHOLD)
  --window SECS              Rate-limit window in seconds
                             (default: $WINDOW_SECONDS)
  --skip-recovery            Skip the post-window recovery check.
  -h, --help                 Show this help.

Behavior:
  Fires THRESHOLD + 3 requests in rapid succession. Expects ~THRESHOLD
  to return 200 and the remainder to return 429. Then (unless
  --skip-recovery) sleeps WINDOW_SECONDS + 2 and fires 3 more requests,
  expecting all 200.

  '$TEST_PATH' uses a deliberately invalid 8-char code; the API
  returns 200 with { valid: false }. The WAF acts on request count,
  not response body, so the test exercises the rule correctly.
EOF
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --domain)        DOMAIN="$2"; shift 2 ;;
    --path)          TEST_PATH="$2"; shift 2 ;;
    --threshold)     THRESHOLD="$2"; shift 2 ;;
    --window)        WINDOW_SECONDS="$2"; shift 2 ;;
    --skip-recovery) SKIP_RECOVERY=1; shift ;;
    -h|--help)       usage; exit 0 ;;
    *)               echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "$DOMAIN" ]]; then
  echo "ERROR: --domain is required (or set WC2026_DOMAIN)." >&2
  usage >&2
  exit 2
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl not found in PATH." >&2
  exit 2
fi

# Strip any accidental scheme so callers can pass either form.
DOMAIN="${DOMAIN#https://}"
DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN%/}"

URL="https://${DOMAIN}${TEST_PATH}"
BURST=$((THRESHOLD + 3))

# Plain `cat` for the header so terminals without UTF-8 still render it.
cat <<EOF
== Testing rate limit ==
Target:    $URL
Expecting: ~${THRESHOLD}× 200, then 429 (firing $BURST total, ${WINDOW_SECONDS}s window)

EOF

# ---------- Phase 1: burst ----------
# Bash post-increment with set -e: `((n++))` returns the OLD value,
# which when 0 evaluates to false and trips set -e. Use explicit
# `n=$((n + 1))` everywhere to avoid that footgun.
pass_count=0
block_count=0
other_count=0

for ((i = 1; i <= BURST; i++)); do
  ts="$(date '+%H:%M:%S')"
  code=$(curl -s -o /dev/null -w "%{http_code}" \
              --connect-timeout 5 --max-time 10 \
              "$URL" || echo "ERR")
  case "$code" in
    200) marker="ok    "; pass_count=$((pass_count + 1)) ;;
    429) marker="block "; block_count=$((block_count + 1)) ;;
    *)   marker="other "; other_count=$((other_count + 1)) ;;
  esac
  printf "  %s  req %2d  ->  HTTP %s  [%s]\n" "$ts" "$i" "$code" "$marker"
done

echo
echo "Burst summary: ${pass_count}x 200, ${block_count}x 429, ${other_count}x other (of $BURST)"

# A correctly-firing rule should let through THRESHOLD or one less
# (the counter sometimes accepts the request that pushes it to the
# limit before counting it). At least one block confirms the rule
# tripped.
burst_ok=0
if (( pass_count >= THRESHOLD - 1 && pass_count <= THRESHOLD + 1 )) && (( block_count >= 1 )); then
  echo "  PASS - rate limit fired at roughly the expected threshold."
  burst_ok=1
elif (( pass_count == BURST )); then
  echo "  FAIL - all requests returned 200; rule is not matching."
  echo "         Verify the rule expression matches the path"
  echo "         '${TEST_PATH%%\?*}' exactly and that you tested the"
  echo "         hostname the rule is scoped to."
elif (( pass_count == 0 )); then
  echo "  FAIL - all requests blocked; a different rule fired first."
  echo "         Open Cloudflare -> Security -> Events to identify the"
  echo "         blocking rule by name."
else
  echo "  WARN - mixed results don't match the expected pattern."
  echo "         The configured threshold may differ from $THRESHOLD,"
  echo "         or another rule is overlapping. Check Security Events."
fi

# ---------- Phase 2: recovery ----------
recovery_ok=1
if (( SKIP_RECOVERY == 0 )); then
  wait_s=$((WINDOW_SECONDS + 2))
  echo
  echo "== Recovery check =="
  echo "Sleeping ${wait_s}s for the rate window to reset..."
  sleep "$wait_s"

  recovery_pass=0
  for ((i = 1; i <= 3; i++)); do
    ts="$(date '+%H:%M:%S')"
    code=$(curl -s -o /dev/null -w "%{http_code}" \
                --connect-timeout 5 --max-time 10 \
                "$URL" || echo "ERR")
    if [[ "$code" == "200" ]]; then
      recovery_pass=$((recovery_pass + 1))
      marker="ok"
    else
      marker="fail"
    fi
    printf "  %s  recovery req %d  ->  HTTP %s  [%s]\n" "$ts" "$i" "$code" "$marker"
  done

  echo
  if (( recovery_pass == 3 )); then
    echo "  PASS - window resets correctly."
  else
    echo "  FAIL - only ${recovery_pass}/3 recovery requests returned 200."
    echo "         Window may be longer than ${WINDOW_SECONDS}s, or you"
    echo "         hit Cloudflare's per-rule cooldown."
    recovery_ok=0
  fi
fi

echo
if (( burst_ok == 1 && recovery_ok == 1 )); then
  echo "ALL CHECKS PASSED - rate limit behaves as configured."
  exit 0
else
  echo "TEST FAILED - see output above."
  echo "Cloudflare -> Security -> Events shows the rule name that fired."
  exit 1
fi
