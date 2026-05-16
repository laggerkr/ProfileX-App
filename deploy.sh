#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${PROFILEX_APP_DIR:-/opt/profilex}"
cd "$APP_DIR"

[[ -f .env ]] || cp .env.example .env
[[ -f apps/backend/.env.production ]] || cp apps/backend/.env.production.example apps/backend/.env.production

docker compose -f docker-compose.production.yml up -d --build postgres backend
if grep -q '^REDIS_URL=redis://redis:6379' .env apps/backend/.env.production 2>/dev/null; then
  docker compose -f docker-compose.production.yml --profile redis up -d redis
fi

docker compose -f docker-compose.production.yml exec -T backend node -e "fetch('http://127.0.0.1:4387/api/health').then(async r=>{if(!r.ok) throw new Error(await r.text()); console.log(await r.text())})"
sudo cp deploy/nginx-api.profilex.com.ua.conf /etc/nginx/sites-available/profilex-api.conf
sudo ln -sf /etc/nginx/sites-available/profilex-api.conf /etc/nginx/sites-enabled/profilex-api.conf
sudo nginx -t
sudo systemctl reload nginx

echo "ProfileX API deployed. Run sudo bash deploy-web.sh to publish the web dashboard."
