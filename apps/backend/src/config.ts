import os from "node:os";
import path from "node:path";

export const PORT = Number(process.env.PROFILEX_API_PORT ?? 4387);
export const DATA_ROOT =
  process.env.PROFILEX_DATA_ROOT ??
  (process.env.NODE_ENV === "production"
    ? path.join(os.homedir(), "ProfileXData")
    : path.join(process.cwd(), "ProfileXData"));
export const DB_PATH = path.join(DATA_ROOT, "profilex.sqlite");
export const MASTER_KEY =
  process.env.PROFILEX_MASTER_KEY ?? "dev-only-change-me-profilex-master-key";
export const PYTHON_WORKER_URL = process.env.PROFILEX_PYTHON_WORKER_URL ?? "http://127.0.0.1:4391";
