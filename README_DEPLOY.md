# ProfileX deployment on Google Cloud VPS

This guide deploys the ProfileX API and production web dashboard to an Ubuntu 22.04 VPS. Chromium/Firefox always run locally inside Electron clients and are never started on the server.

## Target architecture
- Web dashboard: `https://app.profilex.com.ua`
- API domain: `https://api.profilex.com.ua`
- Backend port: `4387`
- PostgreSQL: required
- Redis: optional for locks, websocket sessions, rate limits, and realtime cache
- Nginx: serves the React SPA and proxies API/WebSockets
- PM2: optional alternative when backend runs outside Docker

## 1. Google Cloud preparation
1. Create an Ubuntu 22.04 VM with a static external IP.
2. Add DNS `A` records: `api.profilex.com.ua -> <VPS_IP>` and `app.profilex.com.ua -> <VPS_IP>`.
3. Open firewall ports `22`, `80`, `443` in Google Cloud. Keep `4387` private; Nginx proxies API traffic to `127.0.0.1:4387`.
4. SSH to the VM and clone or copy this repository.

Example firewall commands:
```bash
gcloud compute firewall-rules create profilex-http --allow tcp:80 --target-tags=http-server
gcloud compute firewall-rules create profilex-https --allow tcp:443 --target-tags=https-server
```

## 2. One-command base install
```bash
sudo PROFILEX_REPO_URL=https://github.com/laggerkr/ProfileX-App.git \
  PROFILEX_APP_DIR=/opt/profilex \
  PROFILEX_API_DOMAIN=api.profilex.com.ua \
  LETSENCRYPT_EMAIL=admin@profilex.com.ua \
  bash install.sh
```
`install.sh` installs Docker Engine, Docker Compose plugin, Node.js 20, Nginx, Certbot, `rsync`, clones the repo, creates backend env files from examples, installs the API Nginx site, and requests the first API certificate.

## 3. Configure production env
```bash
cd /opt/profilex
cp .env.production.example .env
cp apps/backend/.env.production.example apps/backend/.env.production
cp apps/frontend/.env.production.example apps/frontend/.env.production
nano .env
nano apps/backend/.env.production
```
Required frontend production env:
```env
VITE_API_URL=https://api.profilex.com.ua
```
Set strong backend values for `POSTGRES_PASSWORD`, `JWT_SECRET`, `PROFILEX_MASTER_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CORS_ORIGIN`, and SMTP settings. `CORS_ORIGIN` must include `https://app.profilex.com.ua`. Set `REDIS_URL=redis://redis:6379` only if Redis should be enabled.

## 4. Deploy API
```bash
cd /opt/profilex
sudo bash deploy.sh
```
`deploy.sh` builds the backend image, starts PostgreSQL + backend, optionally starts Redis, verifies `/api/health`, installs the API Nginx config, and reloads Nginx. Backend startup waits for PostgreSQL, applies migrations, and seeds the first owner from env automatically.

## 5. Deploy web dashboard
```bash
cd /opt/profilex
sudo PROFILEX_APP_DOMAIN=app.profilex.com.ua LETSENCRYPT_EMAIL=admin@profilex.com.ua bash deploy-web.sh
```
`deploy-web.sh` runs `npm run build -w @profilex/frontend`, copies `apps/frontend/dist` into `/var/www/profilex-app`, installs `deploy/nginx-app.profilex.com.ua.conf`, requests the app certificate when missing, and reloads Nginx. The web config uses SPA fallback:
```nginx
try_files $uri $uri/ /index.html;
```

## 6. Verify
```bash
curl https://api.profilex.com.ua/api/health
curl https://api.profilex.com.ua/api/health/db
curl https://api.profilex.com.ua/api/health/ws
curl -I https://app.profilex.com.ua
sudo docker compose -f docker-compose.production.yml ps
sudo nginx -t
```
Manual web checks:
1. Open `https://app.profilex.com.ua` and sign in.
2. Register a user if public registration is enabled.
3. Create an invitation and open `https://app.profilex.com.ua/invite/<token>` to verify SPA invite routing.

## 7. Update
```bash
cd /opt/profilex
sudo bash update.sh
sudo bash deploy-web.sh
```
The update script refreshes the API; rerun `deploy-web.sh` after frontend changes.

## 8. Rollback
```bash
cd /opt/profilex
git log --oneline
git checkout <known-good-commit>
sudo docker compose -f docker-compose.production.yml up -d --build backend
sudo bash deploy-web.sh
```
Keep database backups before schema changes.

## 9. Backup PostgreSQL
```bash
cd /opt/profilex
sudo bash backup.sh
```
Backups are written to `/opt/profilex/backups` and files older than 14 days are removed automatically.

## 10. Optional PM2 mode
If Docker is not used for backend runtime:
```bash
npm install
npm run build
npm run prod:setup
pm2 start ecosystem.config.cjs
pm2 save
```
Use the same Nginx configs and keep PostgreSQL available separately.

## 11. Production files
- `docker-compose.production.yml`
- `apps/backend/.env.production.example`
- `apps/frontend/.env.production.example`
- `deploy/nginx-api.profilex.com.ua.conf`
- `deploy/nginx-app.profilex.com.ua.conf`
- `install.sh`, `deploy.sh`, `deploy-web.sh`, `update.sh`, `backup.sh`
- `ecosystem.config.cjs`

## 12. Security notes
- Public registration can be disabled with `DISABLE_PUBLIC_REGISTRATION=true`.
- JWT secrets and SMTP credentials live only in env files.
- API Nginx keeps proxying `https://api.profilex.com.ua -> http://127.0.0.1:4387` and supports WebSockets.
- App Nginx serves only static frontend files and uses SPA fallback.
- Backend uses Helmet, CORS allowlist, rate limits, JWT refresh tokens, and request size limits.
