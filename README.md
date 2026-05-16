# ProfileX

ProfileX is an Electron desktop client with a cloud backend for browser profiles, proxies, fingerprints, cookies, groups, and permissions.

## Architecture
- Electron launches Chromium/Firefox locally on the user PC.
- PostgreSQL backend stores profiles, browser state, proxy metadata, locks, logs, and team data.
- Optional Redis accelerates realtime sync, locks, websocket sessions, and future distributed rate limits.
- Production VPS runs only the API; it never launches Playwright browsers.

## Local development
```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
npm install
npm run dev
```
`npm run dev` checks ports, starts PostgreSQL with Docker Compose when needed, waits for readiness, applies migrations, then starts backend, Vite, and Electron.

## Docker development
```bash
docker compose up -d postgres
docker compose --profile redis up -d redis
docker compose up -d backend
```
Use Redis only when needed by setting `REDIS_URL=redis://redis:6379`.

## Production deployment
```bash
cp .env.production.example .env
cp apps/backend/.env.production.example apps/backend/.env.production
sudo bash install.sh
sudo bash deploy.sh
```
See `README_DEPLOY.md` for Google Cloud, DNS, SSL, update, rollback, and backup instructions.

## Health
- `GET /api/health`
- `GET /api/health/db`
- `GET /api/health/ws`

## Security
- JWT access tokens + refresh tokens
- bcrypt password hashes
- Helmet, CORS allowlist, auth/general rate limits, configurable request limit
- Electron `contextIsolation`, sandboxed renderer, validated IPC, CSP

## Authentication and invitations
- Roles: `owner`, `admin`, `manager`, `member`, `client`.
- Set `DISABLE_PUBLIC_REGISTRATION=true` to allow onboarding only through invites.
- Admins use `Team / Users` to invite users; links remain visible when SMTP is not configured.
- Invite links open `/invite/:token`; tokens are stored hashed and expire after 7 days.
