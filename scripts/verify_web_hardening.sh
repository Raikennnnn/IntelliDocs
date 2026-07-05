#!/usr/bin/env bash
# Verify Gobuster-style web hardening on the droplet (run after nginx repair/deploy).
#   bash /var/www/intellidocs/scripts/verify_web_hardening.sh
set -euo pipefail

BASE="${1:-http://127.0.0.1}"
pass=0
fail=0

check() {
  local name="$1"
  local path="$2"
  local expect="$3"
  local code
  code="$(curl -fsS -o /dev/null -w '%{http_code}' "${BASE}${path}" 2>/dev/null || echo '000')"
  if [ "$code" = "$expect" ]; then
    printf 'OK   %-28s %s -> %s\n' "$name" "$path" "$code"
    pass=$((pass + 1))
  else
    printf 'FAIL %-28s %s -> %s (expected %s)\n' "$name" "$path" "$code" "$expect"
    fail=$((fail + 1))
  fi
}

echo "=== Web hardening checks (${BASE}) ==="
check ".htaccess blocked" "/.htaccess" "404"
check "index.php no 500 leak" "/index.php" "404"
check "landing page" "/landing" "200"
check "robots.txt" "/robots.txt" "200"
check "errors dir blocked" "/errors/" "404"
check "uploads dir no listing" "/uploads/" "404"

# Body must not expose stack traces on index.php
body="$(curl -fsS "${BASE}/index.php" 2>/dev/null || true)"
if echo "$body" | grep -qiE '(fatal error|stack trace|exception|/var/www|CodeIgniter\\\\Boot)'; then
  printf 'FAIL index.php body            leaks error details\n'
  fail=$((fail + 1))
else
  printf 'OK   index.php body            no stack trace\n'
  pass=$((pass + 1))
fi

echo ""
printf 'Results: %s passed, %s failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
