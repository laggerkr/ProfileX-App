# Workspace Profile Manager

Internal desktop application for browser workspace isolation, QA, multi-account corporate workflows, and secure separation of work sessions.

## Stack

- Electron desktop shell
- React + TypeScript + Tailwind UI renderer
- Node.js + Express local REST API
- SQLite local data store
- Playwright persistent Chromium contexts
- Optional Python FastAPI worker for QA automation and diagnostics

## Quick Start

```bash
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`, the local API on `http://localhost:4387`, and Electron opens the desktop shell.

## Optional Python Worker

The Python worker is a sidecar service for tasks that are convenient in Python: QA checks, proxy diagnostics, page checks, reporting, and automation experiments.

```bash
cd apps/python-worker
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m playwright install chromium
python src/main.py
```

The Node API checks it through:

- `GET /api/worker/python/status`
- `POST /api/worker/python/proxy-check`
- `POST /api/worker/python/page-check`

This keeps the production desktop runtime fast and TypeScript-native while still giving the team a Python extension point.

## Build

```bash
npm run package
```

Installers are generated in `release/` for Windows, macOS, and Linux.

## Security Notes

Secrets are encrypted locally with AES-256-GCM. For production deployment, set `PROFILEX_MASTER_KEY` through the OS credential store or company device-management policy.
