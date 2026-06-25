#!/usr/bin/env bash
# Raise PHP upload limits for enrollment document uploads (10MB app cap; headroom for multipart).
# Run on the droplet as root:
#   bash /var/www/intellidocs/scripts/configure_php_upload_limits.sh
set -euo pipefail

UPLOAD_MAX="${UPLOAD_MAX:-12M}"
POST_MAX="${POST_MAX:-14M}"

PHP_VERSION="${PHP_VERSION:-8.3}"
INI_DIR="/etc/php/${PHP_VERSION}/fpm/conf.d"
INI_FILE="${INI_DIR}/99-intellidocs-uploads.ini"

if [ ! -d "$INI_DIR" ]; then
  echo "ERROR: PHP FPM conf.d not found at $INI_DIR — set PHP_VERSION (e.g. 8.2)."
  exit 1
fi

cat > "$INI_FILE" <<EOF
; IntelliDocs enrollment document uploads (see api/upload_limits.php)
upload_max_filesize = ${UPLOAD_MAX}
post_max_size = ${POST_MAX}
EOF

echo "Wrote $INI_FILE:"
cat "$INI_FILE"

systemctl reload "php${PHP_VERSION}-fpm"
echo "Reloaded php${PHP_VERSION}-fpm"

php -r "echo 'upload_max_filesize=' . ini_get('upload_max_filesize') . PHP_EOL;"
php -r "echo 'post_max_size=' . ini_get('post_max_size') . PHP_EOL;"
