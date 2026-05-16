# ProfileX VPS deployment

Target API host: `https://api.profilex.com.ua` on Ubuntu 22.04 LTS.

## 1. Prepare VPS
Install Node.js LTS, PostgreSQL 16+, Nginx, PM2, Certbot, Docker, and Docker Compose. Clone the repository and run `npm install`.

## 2. Configure env
```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
```
Fill production values for `DATABASE_URL`, `JWT_SECRET`, `PROFILEX_MASTER_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `CORS_ORIGIN`. `REDIS_URL` is optional.

## 3. Bootstrap
```bash
npm run build
npm run prod:setup
pm2 start ecosystem.config.cjs
```
`prod:setup` validates env, creates the database when missing, applies migrations, seeds the first admin, and checks PM2/Nginx assets.

## 4. Nginx / Cloudflare
Install `deploy/nginx-api.profilex.com.ua.conf`, issue TLS certificates, and reload Nginx. The example already proxies `/ws` upgrades. If Cloudflare is enabled, use Full (strict) TLS and keep WebSockets enabled.

## 5. Docker alternative
```bash
docker compose up -d postgres backend
# optional redis
docker compose --profile redis up -d redis
```
Volumes: `postgres_data`, `redis_data`. Healthchecks are built in.

## 6. Verification
```bash
curl https://api.profilex.com.ua/api/health
curl https://api.profilex.com.ua/api/health/db
curl https://api.profilex.com.ua/api/health/ws
pm2 status
```

## Notes
- Electron clients use `VITE_API_URL=https://api.profilex.com.ua`.
- Browser runtime stays on client machines only.
- `POST /api/profiles/:id/sync` uploads local browser state after profile close.
- PostgreSQL migrations live in `apps/backend/migrations/001_init_postgres.sql`.
