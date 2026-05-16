#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${PROFILEX_APP_DIR:-/opt/profilex}"
WEB_ROOT="${PROFILEX_WEB_ROOT:-/var/www/profilex-app}"
DOMAIN="${PROFILEX_APP_DOMAIN:-app.profilex.com.ua}"
EMAIL="${LETSENCRYPT_EMAIL:-admin@profilex.com.ua}"
cd "$APP_DIR"

[[ -f apps/frontend/.env.production ]] || cp apps/frontend/.env.production.example apps/frontend/.env.production
npm install
npm run build -w @profilex/frontend

sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete apps/frontend/dist/ "$WEB_ROOT/"

if [[ ! -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
  sudo tee /etc/nginx/sites-available/profilex-app.conf >/dev/null <<CONF
server {
  listen 80;
  server_name $DOMAIN;
  root $WEB_ROOT;
  location /.well-known/acme-challenge/ { root /var/www/html; }
  location / { try_files \$uri \$uri/ /index.html; }
}
CONF
  sudo ln -sf /etc/nginx/sites-available/profilex-app.conf /etc/nginx/sites-enabled/profilex-app.conf
  sudo nginx -t
  sudo systemctl reload nginx
  sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect
fi

sudo cp deploy/nginx-app.profilex.com.ua.conf /etc/nginx/sites-available/profilex-app.conf
sudo ln -sf /etc/nginx/sites-available/profilex-app.conf /etc/nginx/sites-enabled/profilex-app.conf
sudo nginx -t
sudo systemctl reload nginx

echo "ProfileX web dashboard deployed to https://$DOMAIN"
