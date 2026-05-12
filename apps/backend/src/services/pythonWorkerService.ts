import { PYTHON_WORKER_URL } from "../config.js";

export interface PythonWorkerStatus {
  enabled: boolean;
  url: string;
  ok: boolean;
  capabilities: string[];
  error?: string;
}

async function workerRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PYTHON_WORKER_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers
    },
    signal: AbortSignal.timeout(2500)
  });
  if (!response.ok) throw new Error(`Python worker responded with ${response.status}`);
  return (await response.json()) as T;
}

export async function getPythonWorkerStatus(): Promise<PythonWorkerStatus> {
  try {
    const health = await workerRequest<{ ok: boolean; capabilities?: string[] }>("/health");
    return {
      enabled: true,
      url: PYTHON_WORKER_URL,
      ok: Boolean(health.ok),
      capabilities: health.capabilities ?? []
    };
  } catch (error) {
    return {
      enabled: true,
      url: PYTHON_WORKER_URL,
      ok: false,
      capabilities: [],
      error: error instanceof Error ? error.message : "Python worker unavailable"
    };
  }
}

export async function runPythonProxyCheck(host: string, port: number) {
  return workerRequest("/tasks/proxy-check", {
    method: "POST",
    body: JSON.stringify({ host, port })
  });
}

export async function runPythonPageCheck(input: {
  url: string;
  userAgent?: string;
  timezone?: string;
  locale?: string;
  width?: number;
  height?: number;
}) {
  return workerRequest("/tasks/page-check", {
    method: "POST",
    body: JSON.stringify({
      url: input.url,
      user_agent: input.userAgent,
      timezone: input.timezone,
      locale: input.locale,
      width: input.width,
      height: input.height
    })
  });
}
