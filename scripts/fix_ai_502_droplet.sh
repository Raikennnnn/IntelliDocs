#!/usr/bin/env bash
# One-shot fix for recurring "AI verify timed out (HTTP 502)" on the droplet.
# Run as root in DigitalOcean console:
#   bash /var/www/intellidocs/scripts/fix_ai_502_droplet.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"
BRANCH="${BRANCH:-IntelliDocs-V4}"

step() { printf '\n=== %s ===\n' "$1"; }

step "Pull latest code (OCR speed + verify-on-demand fixes)"
cd "$APP_ROOT"
git fetch origin
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
echo "At: $(git log -1 --oneline)"

step "Deploy AI service"
bash "$APP_ROOT/scripts/deploy_ai_hotfix.sh"

step "Deploy registrar UI (stops auto re-OCR on every page open)"
bash "$APP_ROOT/scripts/deploy_ui_hotfix.sh"

step "Summary"
echo "502 causes addressed:"
echo "  1. nginx/PHP timeouts raised to 300s"
echo "  2. Good moral / SF9 skip slow multi-pass OCR when first read is OK"
echo "  3. Review page no longer re-runs AI on all 5 docs every time you open it"
echo ""
echo "Use Re-run AI on one application when you need fresh scores."
echo "Form 137 (SF10) alone may still take 1–3 min — run Re-run AI once, not on every visit."
