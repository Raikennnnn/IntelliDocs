#!/usr/bin/env bash
# System Restart Session Validation — run on the droplet as root.
# Expects sessions to be invalidated after restart (server_boot_epoch).
#
# Usage (registrar/admin — no login OTP):
#   bash scripts/test_session_restart_validation.sh 'registrar@school.edu' 'YourPassword'
#
# Optional env:
#   BASE_URL=http://127.0.0.1  SKIP_RESTART=1
set -euo pipefail

CRED="${1:-}"
PASS="${2:-}"
BASE_URL="${BASE_URL:-http://127.0.0.1}"
APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"

if [ -z "$CRED" ] || [ -z "$PASS" ]; then
  echo "Usage: bash $0 <credential> <password>"
  echo "Tip: use a registrar or admin account (students need login OTP)."
  exit 1
fi

step() { printf '\n=== %s ===\n' "$1"; }

json_field() {
  local json="$1"
  local field="$2"
  php -r '
    $d = json_decode(stream_get_contents(STDIN), true);
    if (!is_array($d)) exit(1);
    $f = $argv[0];
    if (!array_key_exists($f, $d)) exit(1);
    $v = $d[$f];
    if (is_bool($v)) { echo $v ? "true" : "false"; exit(0); }
    if ($v === null) exit(1);
    echo $v;
  ' "$field" <<<"$json"
}

step "1) Login"
LOGIN_JSON="$(curl -fsS -X POST "${BASE_URL}/api/auth" \
  -H 'Content-Type: application/json' \
  -d "{\"action\":\"login\",\"credential\":$(php -r 'echo json_encode($argv[1]);' "$CRED"),\"password\":$(php -r 'echo json_encode($argv[1]);' "$PASS")}")"

SUCCESS="$(json_field "$LOGIN_JSON" success 2>/dev/null || echo false)"
if [ "$SUCCESS" != "true" ]; then
  echo "Login failed:"
  echo "$LOGIN_JSON" | php -r 'echo json_encode(json_decode(stream_get_contents(STDIN)), JSON_PRETTY_PRINT);'
  exit 1
fi

if [ "$(json_field "$LOGIN_JSON" requires_otp 2>/dev/null || echo false)" = "true" ]; then
  echo "Login requires OTP (student account). Use a registrar/admin account for this test."
  exit 1
fi

TOKEN="$(json_field "$LOGIN_JSON" token 2>/dev/null || true)"
USER_ID="$(php -r '
  $d = json_decode(stream_get_contents(STDIN), true);
  echo (int)($d["user"]["id"] ?? 0);
' <<<"$LOGIN_JSON")"

if [ -z "$TOKEN" ]; then
  echo "WARNING: No session token returned (legacy_auth_only?). Test may not validate Bearer sessions."
else
  echo "OK: token received (${#TOKEN} chars)"
fi
echo "OK: user id $USER_ID"

step "2) Protected API before restart"
BEFORE_CODE="$(curl -sS -o /tmp/id_before.json -w '%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-User-Id: ${USER_ID}" \
  "${BASE_URL}/api/registrar/overview" || echo 000)"
echo "GET /api/registrar/overview -> HTTP $BEFORE_CODE"
head -c 200 /tmp/id_before.json 2>/dev/null; echo

if [ "$BEFORE_CODE" != "200" ]; then
  echo "Protected API failed before restart — fix auth/nginx first."
  exit 1
fi

if [ "${SKIP_RESTART:-0}" != "1" ]; then
  step "2b) Restart web stack + invalidate sessions"
  for svc in php8.3-fpm php8.2-fpm php-fpm; do
    if systemctl list-unit-files "${svc}.service" 2>/dev/null | grep -q "${svc}.service"; then
      systemctl restart "$svc"
      echo "Restarted $svc"
      break
    fi
  done
  nginx -t
  systemctl restart nginx
  echo "Restarted nginx"
  if command -v php >/dev/null 2>&1; then
    php "$APP_ROOT/scripts/bump_server_boot_epoch.php"
  fi
  sleep 2
else
  echo "SKIP_RESTART=1 — not restarting services"
fi

step "3) Protected API after restart (same token)"
AFTER_CODE="$(curl -sS -o /tmp/id_after.json -w '%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-User-Id: ${USER_ID}" \
  "${BASE_URL}/api/registrar/overview" || echo 000)"
echo "GET /api/registrar/overview -> HTTP $AFTER_CODE"
head -c 200 /tmp/id_after.json 2>/dev/null; echo

step "Result"
if [ "$AFTER_CODE" = "401" ]; then
  echo "PASS (invalidated): Session rejected after restart (HTTP 401)."
  php -r 'echo json_encode(json_decode(file_get_contents("/tmp/id_after.json")), JSON_PRETTY_PRINT);' 2>/dev/null || true
elif [ "$AFTER_CODE" = "200" ]; then
  echo "FAIL: Session still valid after restart — expected HTTP 401."
  echo "Ensure server_boot.php is deployed and bump_server_boot_epoch.php ran."
  exit 1
else
  echo "FAIL: Unexpected HTTP $AFTER_CODE — site may be down or misconfigured."
  echo "Run: nginx -t && systemctl status nginx php8.3-fpm --no-pager"
  echo "Run: bash $APP_ROOT/scripts/repair_nginx_droplet.sh"
  exit 1
fi
