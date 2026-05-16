#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${PROFILEX_APP_DIR:-/opt/profilex}"
BACKUP_DIR="${PROFILEX_BACKUP_DIR:-$APP_DIR/backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"
set -a
source .env
set +a

docker compose -f docker-compose.production.yml exec -T postgres pg_dump -U "${POSTGRES_USER:-profilex}" "${POSTGRES_DB:-profilex}" > "$BACKUP_DIR/profilex-$TIMESTAMP.sql"
find "$BACKUP_DIR" -type f -name 'profilex-*.sql' -mtime +14 -delete

echo "Backup saved to $BACKUP_DIR/profilex-$TIMESTAMP.sql"
