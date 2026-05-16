# ProfileX deployment on Google Cloud VPS

This guide deploys only the ProfileX API backend to an Ubuntu 22.04 VPS. Chromium/Firefox always run locally inside the Electron client and are never started on the server.

## Target architecture
- API domain: `https://api.profilex.com.ua`
- Backend port: `4387`
- PostgreSQL: required
- Redis: optional for locks, websocket sessions, rate limits, and realtime cache
- Nginx: reverse proxy + TLS termination
- PM2: optional alternative when backend runs outside Docker

## 1. Google Cloud preparation
1. Create an Ubuntu 22.04 VM with a static external IP.
2. Add DNS `A` record: `api.profilex.com.ua -> <VPS_IP>`.
3. Open firewall ports `22`, `80`, `443` in Google Cloud. Keep `4387` private; Nginx proxies to `127.0.0.1:4387`.
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
`install.sh` installs Docker Engine, Docker Compose plugin, Nginx, Certbot, clones the repo, creates env files from examples, installs the Nginx site, and requests the Let's Encrypt certificate.

## 3. Configure production env
```bash
cd /opt/profilex
cp .env.production.example .env
cp apps/backend/.env.production.example apps/backend/.env.production
nano .env
nano apps/backend/.env.production
```
Set strong values for `POSTGRES_PASSWORD`, `JWT_SECRET`, `PROFILEX_MASTER_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CORS_ORIGIN`, and SMTP settings. Set `REDIS_URL=redis://redis:6379` only if Redis should be enabled.

## 4. Deploy
```bash
cd /opt/profilex
sudo bash deploy.sh
```
`deploy.sh` builds the backend image, starts PostgreSQL + backend, optionally starts Redis, verifies `/api/health`, installs the Nginx config, and reloads Nginx. Backend startup waits for PostgreSQL, applies migrations, and seeds the first owner from env automatically.

## 5. Verify
```bash
curl https://api.profilex.com.ua/api/health
curl https://api.profilex.com.ua/api/health/db
curl https://api.profilex.com.ua/api/health/ws
sudo docker compose -f docker-compose.production.yml ps
sudo nginx -t
```
Expected health endpoints:
- `GET /api/health`
- `GET /api/health/db`
- `GET /api/health/ws`

## 6. Update
```bash
cd /opt/profilex
sudo bash update.sh
```
The update script pulls the current branch, rebuilds the backend image, restarts services, and checks health.

## 7. Rollback
```bash
cd /opt/profilex
git log --oneline
git checkout <known-good-commit>
sudo docker compose -f docker-compose.production.yml up -d --build backend
```
Keep database backups before schema changes.

## 8. Backup PostgreSQL
```bash
cd /opt/profilex
sudo bash backup.sh
```
Backups are written to `/opt/profilex/backups` and files older than 14 days are removed automatically.

## 9. Optional PM2 mode
If Docker is not used for backend runtime:
```bash
npm install
npm run build
npm run prod:setup
pm2 start ecosystem.config.cjs
pm2 save
```
Use the same Nginx config and keep PostgreSQL available separately.

## 10. Production files
- `docker-compose.production.yml`
- `apps/backend/.env.production.example`
- `deploy/nginx-api.profilex.com.ua.conf`
- `install.sh`, `deploy.sh`, `update.sh`, `backup.sh`
- `ecosystem.config.cjs`

## 11. Security notes
- Public registration can be disabled with `DISABLE_PUBLIC_REGISTRATION=true`.
- JWT secrets and SMTP credentials live only in env files.
- Nginx enables gzip, websocket upgrades, 50 MB upload limit, and baseline security headers.
- Backend uses Helmet, CORS allowlist, rate limits, JWT refresh tokens, and request size limits.
