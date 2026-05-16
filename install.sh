#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${PROFILEX_REPO_URL:-https://github.com/laggerkr/ProfileX-App.git}"
APP_DIR="${PROFILEX_APP_DIR:-/opt/profilex}"
DOMAIN="${PROFILEX_API_DOMAIN:-api.profilex.com.ua}"
EMAIL="${LETSENCRYPT_EMAIL:-admin@profilex.com.ua}"

if [[ $EUID -ne 0 ]]; then
  echo "Run install.sh as root or via sudo." >&2
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl gnupg git nginx certbot python3-certbot-nginx
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker nginx

if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
[[ -f .env ]] || cp .env.production.example .env
[[ -f apps/backend/.env.production ]] || cp apps/backend/.env.production.example apps/backend/.env.production

cat >/etc/nginx/sites-available/profilex-api.conf <<CONF
server {
  listen 80;
  server_name $DOMAIN;
  location /.well-known/acme-challenge/ { root /var/www/html; }
  location / { return 301 https://\$host\$request_uri; }
}
CONF
ln -sf /etc/nginx/sites-available/profilex-api.conf /etc/nginx/sites-enabled/profilex-api.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if [[ ! -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect
fi

cp deploy/nginx-api.profilex.com.ua.conf /etc/nginx/sites-available/profilex-api.conf
nginx -t
systemctl reload nginx

echo "Installation complete. Edit $APP_DIR/.env and $APP_DIR/apps/backend/.env.production, then run sudo ./deploy.sh"
