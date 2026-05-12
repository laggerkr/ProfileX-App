from __future__ import annotations

import asyncio
import socket
import time
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel, Field, HttpUrl
from playwright.async_api import async_playwright


TaskStatus = Literal["queued", "running", "completed", "failed"]


class TaskRecord(BaseModel):
    id: str
    kind: str
    status: TaskStatus
    created_at: str
    result: dict | None = None
    error: str | None = None


class ProxyCheckRequest(BaseModel):
    host: str
    port: int = Field(gt=0, lt=65536)
    timeout_seconds: float = Field(default=5.0, gt=0, le=30)


class PageCheckRequest(BaseModel):
    url: HttpUrl
    user_agent: str | None = None
    timezone: str = "UTC"
    locale: str = "en-US"
    width: int = Field(default=1440, ge=320, le=7680)
    height: int = Field(default=900, ge=240, le=4320)


app = FastAPI(title="Workspace Profile Manager Python Worker", version="0.1.0")
tasks: dict[str, TaskRecord] = {}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_task(kind: str) -> TaskRecord:
    record = TaskRecord(id=str(uuid4()), kind=kind, status="queued", created_at=now_iso())
    tasks[record.id] = record
    return record


@app.get("/health")
async def health() -> dict:
    return {
        "ok": True,
        "service": "python-worker",
        "capabilities": ["proxy-check", "page-check", "qa-automation"],
        "time": now_iso(),
    }


@app.get("/tasks")
async def list_tasks() -> dict:
    return {"data": list(tasks.values())}


@app.post("/tasks/proxy-check")
async def proxy_check(payload: ProxyCheckRequest) -> dict:
    record = create_task("proxy-check")
    record.status = "running"
    started = time.perf_counter()
    try:
        await asyncio.wait_for(asyncio.open_connection(payload.host, payload.port), timeout=payload.timeout_seconds)
        latency_ms = round((time.perf_counter() - started) * 1000)
        record.status = "completed"
        record.result = {"status": "healthy", "latency_ms": latency_ms}
    except (TimeoutError, OSError, socket.gaierror) as error:
        record.status = "failed"
        record.error = str(error)
        record.result = {"status": "offline"}
    return {"data": record}


@app.post("/tasks/page-check")
async def page_check(payload: PageCheckRequest) -> dict:
    record = create_task("page-check")
    record.status = "running"
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=payload.user_agent,
                timezone_id=payload.timezone,
                locale=payload.locale,
                viewport={"width": payload.width, "height": payload.height},
            )
            page = await context.new_page()
            response = await page.goto(str(payload.url), wait_until="domcontentloaded", timeout=20000)
            title = await page.title()
            await browser.close()
        record.status = "completed"
        record.result = {
            "status_code": response.status if response else None,
            "title": title,
            "url": str(payload.url),
        }
    except Exception as error:
        record.status = "failed"
        record.error = str(error)
    return {"data": record}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=4391)
