#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${PROFILEX_APP_DIR:-/opt/profilex}"
cd "$APP_DIR"

git pull --ff-only
docker compose -f docker-compose.production.yml build backend
docker compose -f docker-compose.production.yml up -d postgres backend
docker compose -f docker-compose.production.yml exec -T backend node -e "fetch('http://127.0.0.1:4387/api/health').then(async r=>{if(!r.ok) throw new Error(await r.text()); console.log(await r.text())})"

echo "ProfileX updated."
