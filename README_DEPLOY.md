# ProfileX VPS deployment

Target API host: `https://api.profilex.com.ua` on Ubuntu 22.04 LTS.

## Install
1. Install Node.js LTS, PostgreSQL, Nginx, PM2 and Certbot.
2. Clone the repository and run `npm install`.
3. Copy `apps/backend/.env.example` to `apps/backend/.env` and fill real secrets.
4. Create PostgreSQL database/user, then run:
   `psql "$DATABASE_URL" -f apps/backend/migrations/001_init_postgres.sql`
5. Build: `npm run build`.
6. Start API: `pm2 start ecosystem.config.cjs`.
7. Install `deploy/nginx-api.profilex.com.ua.conf`, obtain TLS certificate, and reload Nginx.

## Commands
- `npm install`
- `npm run build`
- `npm run start -w @profilex/backend`
- `pm2 start ecosystem.config.cjs`

## Architecture notes
- Production VPS runs only the backend API.
- Electron clients use `VITE_API_URL=https://api.profilex.com.ua`.
- Browsers must be launched locally by the client runtime, never on the VPS API server.
- `POST /api/profiles/:id/sync` accepts cookies/local/session state uploaded after a local browser session ends.
