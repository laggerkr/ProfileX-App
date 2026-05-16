import "dotenv/config";
import os from "node:os";
import path from "node:path";

export const NODE_ENV = process.env.NODE_ENV ?? "development";
export const IS_PRODUCTION = NODE_ENV === "production";
export const PORT = Number(process.env.PORT ?? process.env.PROFILEX_API_PORT ?? 4387);
export const HOST = process.env.HOST ?? "0.0.0.0";
export const DATABASE_URL = process.env.DATABASE_URL;
export const JWT_SECRET = process.env.JWT_SECRET ?? (IS_PRODUCTION ? "" : "dev-only-change-me-jwt-secret");
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://127.0.0.1:5173,http://localhost:5173";
export const REDIS_URL = process.env.REDIS_URL;
export const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL ?? "15m";
export const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30);
export const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT ?? "2mb";
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
export const DISABLE_PUBLIC_REGISTRATION = process.env.DISABLE_PUBLIC_REGISTRATION === "true";
export const APP_URL = process.env.APP_URL ?? "profilex://app";
export const API_URL = process.env.API_URL ?? `http://127.0.0.1:${PORT}`;
export const SMTP_HOST = process.env.SMTP_HOST;
export const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
export const SMTP_FROM = process.env.SMTP_FROM ?? "invite@profilex.com.ua";
export const DATA_ROOT =
  process.env.PROFILEX_DATA_ROOT ??
  (IS_PRODUCTION ? path.join(os.homedir(), "ProfileXData") : path.join(process.cwd(), "ProfileXData"));
export const MASTER_KEY = process.env.PROFILEX_MASTER_KEY ?? (IS_PRODUCTION ? "" : "dev-only-change-me-profilex-master-key");
export const PYTHON_WORKER_URL = process.env.PROFILEX_PYTHON_WORKER_URL ?? "http://127.0.0.1:4391";

if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
if (IS_PRODUCTION && !JWT_SECRET) throw new Error("JWT_SECRET is required in production");
if (IS_PRODUCTION && !MASTER_KEY) throw new Error("PROFILEX_MASTER_KEY is required in production");
