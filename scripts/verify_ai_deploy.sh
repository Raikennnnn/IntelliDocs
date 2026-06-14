#!/usr/bin/env bash
# Confirm the droplet is running the latest AI code (not an old checkout or stale service).
#   bash /var/www/intellidocs/scripts/verify_ai_deploy.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"
BRANCH="${BRANCH:-IntelliDocs-V4}"
EXPECTED_BUILD="${EXPECTED_AI_VERIFY_BUILD:-20250603-seal-signature-v2}"
FAIL=0

warn() { echo "WARNING: $*"; FAIL=1; }
ok() { echo "OK: $*"; }

echo "=== IntelliDocs AI deploy verification ==="
echo "App root: $APP_ROOT"

if [ ! -d "$APP_ROOT/.git" ]; then
  warn "Not a git clone — deploy with git fetch + reset, not SFTP upload only."
else
  cd "$APP_ROOT"
  git fetch origin 2>/dev/null || true
  HEAD="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  REMOTE="$(git rev-parse --short "origin/${BRANCH}" 2>/dev/null || echo unknown)"
  echo "Git HEAD:        $HEAD — $(git log -1 --format=%s 2>/dev/null || true)"
  echo "origin/${BRANCH}: $REMOTE"
  if [ "$HEAD" != "$REMOTE" ] && [ "$REMOTE" != "unknown" ]; then
    warn "Server is NOT on latest origin/${BRANCH}. Run: bash scripts/deploy_ai_hotfix.sh"
  else
    ok "Git matches origin/${BRANCH}"
  fi
fi

MARKERS=(
  "_SEAL_SCAN_DOC_TYPES"
  "_scan_school_header_seal"
  "def get_bgr"
  "_header_layout_regions"
  "AI_VERIFY_BUILD"
)
for m in "${MARKERS[@]}"; do
  if [ -f "$APP_ROOT/ai/app.py" ] && grep -q "$m" "$APP_ROOT/ai/app.py"; then
    ok "ai/app.py contains $m"
  else
    warn "ai/app.py missing $m — old AI code still on disk"
  fi
done

if [ -f "$APP_ROOT/ai/BUILD_REV" ]; then
  echo "BUILD_REV file:  $(cat "$APP_ROOT/ai/BUILD_REV")"
else
  warn "ai/BUILD_REV missing — run deploy_ai_hotfix.sh to stamp the running revision"
fi

if systemctl is-active --quiet intellidocs-ai 2>/dev/null; then
  ok "intellidocs-ai service is active"
  WD="$(systemctl show intellidocs-ai -p WorkingDirectory --value 2>/dev/null || true)"
  echo "WorkingDirectory: ${WD:-unknown}"
  if [ -n "$WD" ] && [ "$WD" != "${APP_ROOT}/ai" ]; then
    warn "systemd WorkingDirectory is not ${APP_ROOT}/ai"
  fi
else
  warn "intellidocs-ai is not running — run: systemctl restart intellidocs-ai"
fi

HEALTH="$(curl -fsS --max-time 10 http://127.0.0.1:8080/health 2>/dev/null || true)"
if [ -z "$HEALTH" ]; then
  warn "AI health check failed at http://127.0.0.1:8080/health"
else
  echo "Health JSON: $HEALTH"
  echo "$HEALTH" | grep -q '"ok"[[:space:]]*:[[:space:]]*true' && ok "OCR engine ready" || warn "OCR not ready"
  if echo "$HEALTH" | grep -q "\"ai_verify_build\"[[:space:]]*:[[:space:]]*\"${EXPECTED_BUILD}\""; then
    ok "Running AI verify build ${EXPECTED_BUILD}"
  else
    warn "ai_verify_build is not ${EXPECTED_BUILD} — restart intellidocs-ai after deploy"
  fi
  if echo "$HEALTH" | grep -q "seal_layout_agnostic"; then
    ok "Seal/signature v2 capabilities reported"
  else
    warn "Health response missing seal_layout_agnostic capability"
  fi
fi

echo ""
if [ "$FAIL" = "0" ]; then
  echo "PASS: AI deploy looks current. Re-run AI verify on documents in the registrar portal."
  exit 0
fi
echo "FAIL: AI deploy is outdated or misconfigured. Run on this server:"
echo "  cd $APP_ROOT && bash scripts/deploy_ai_hotfix.sh"
exit 1
