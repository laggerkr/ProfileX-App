# Python Worker

Optional sidecar service for internal QA automation, diagnostics, reporting, and long-running jobs.

The desktop app and local API stay in TypeScript. This worker is intentionally separate so Python workflows can evolve without slowing down the Electron runtime.

## Setup

```bash
cd apps/python-worker
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m playwright install chromium
python src/main.py
```

The worker listens on `http://127.0.0.1:4391`.

## Endpoints

- `GET /health`
- `POST /tasks/proxy-check`
- `POST /tasks/page-check`
- `GET /tasks`

The worker uses neutral internal QA terminology and should only be connected to company-approved workspaces.
