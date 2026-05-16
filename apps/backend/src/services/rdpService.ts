import { spawn, spawnSync } from "node:child_process";
import { nanoid } from "nanoid";
import type { RdpConnection } from "@profilex/shared";
import type { AppDatabase } from "../database/db.js";
import { decryptSecret, encryptSecret } from "../security/encryption.js";

export function listRdpConnections(db: AppDatabase) {
  return db.prepare("SELECT * FROM rdp_connections ORDER BY name ASC").all().map((row) => mapRdp(row));
}

export function createRdpConnection(db: AppDatabase, input: Partial<RdpConnection>) {
  const now = new Date().toISOString();
  const connection = normalizeInput(input, now);
  db.prepare(`INSERT INTO rdp_connections
    (id, name, host, username, password_encrypted, domain, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(connection.id, connection.name, connection.host, connection.username, encryptSecret(input.password), connection.domain, now, now);
  return connection;
}

export function updateRdpConnection(db: AppDatabase, id: string, patch: Partial<RdpConnection>) {
  const current = getRdpConnection(db, id, { includePassword: true });
  if (!current) return undefined;
  const next = normalizeInput({ ...current, ...patch }, current.createdAt, id);
  db.prepare(`UPDATE rdp_connections SET name=?, host=?, username=?, password_encrypted=?, domain=?, updated_at=? WHERE id=?`)
    .run(next.name, next.host, next.username, patch.password === undefined ? encryptSecret(current.password) : encryptSecret(patch.password), next.domain, next.updatedAt, id);
  return getRdpConnection(db, id);
}

export function deleteRdpConnection(db: AppDatabase, id: string) {
  const current = getRdpConnection(db, id);
  if (!current) return false;
  db.prepare("DELETE FROM rdp_connections WHERE id = ?").run(id);
  return true;
}

export function getRdpConnection(db: AppDatabase, id: string, options?: { includePassword?: boolean }) {
  const row = db.prepare("SELECT * FROM rdp_connections WHERE id = ?").get(id);
  return row ? mapRdp(row, options) : undefined;
}

export function launchRdpConnection(db: AppDatabase, id: string) {
  const connection = getRdpConnection(db, id, { includePassword: true });
  if (!connection) return undefined;
  if (process.platform !== "win32") throw new Error("RDP launch is supported only on Windows.");
  const target = connection.domain ? `${connection.domain}\${connection.username}` : connection.username;
  if (connection.password) {
    spawnSync("cmdkey.exe", ["/generic:TERMSRV/" + connection.host, "/user:" + target, "/pass:" + connection.password], { windowsHide: true, stdio: "ignore" });
  }
  spawn("mstsc.exe", ["/v:" + connection.host], { detached: true, windowsHide: false, stdio: "ignore" }).unref();
  const launchedAt = new Date().toISOString();
  db.prepare("UPDATE rdp_connections SET last_launched_at=?, updated_at=? WHERE id=?").run(launchedAt, launchedAt, id);
  return getRdpConnection(db, id);
}

function normalizeInput(input: Partial<RdpConnection>, createdAt = new Date().toISOString(), id = nanoid()): RdpConnection {
  const name = String(input.name ?? "").trim();
  const host = String(input.host ?? "").trim();
  const username = String(input.username ?? "").trim();
  const domain = String(input.domain ?? "").trim() || undefined;
  if (!name) throw new Error("RDP name is required.");
  if (!host) throw new Error("RDP host / IP is required.");
  if (!username) throw new Error("RDP login is required.");
  return { id, name, host, username, domain, createdAt, updatedAt: new Date().toISOString() };
}

function mapRdp(row: any, options?: { includePassword?: boolean }): RdpConnection {
  const password = decryptSecret(row.password_encrypted);
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    username: row.username,
    ...(options?.includePassword ? { password } : {}),
    hasPassword: Boolean(password),
    domain: row.domain ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLaunchedAt: row.last_launched_at ?? undefined
  };
}
