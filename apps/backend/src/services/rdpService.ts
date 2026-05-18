import { spawn, spawnSync } from "node:child_process";
import { nanoid } from "nanoid";
import type { RdpConnection } from "@profilex/shared";
import type { AppDatabase } from "../database/db.js";
import { decryptSecret, encryptSecret } from "../security/encryption.js";

export async function listRdpConnections(db: AppDatabase, organizationId: string, options?: { includePassword?: boolean }) {
  return (await db.query("SELECT * FROM rdp_connections WHERE organization_id=$1 ORDER BY name ASC", [organizationId])).map((row) => mapRdp(row, options));
}
export async function createRdpConnection(db: AppDatabase, input: Partial<RdpConnection>, organizationId: string) {
  const now = new Date().toISOString(), connection = normalizeInput(input, now);
  await db.exec(`INSERT INTO rdp_connections (id,organization_id,name,host,username,password_encrypted,domain,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [connection.id, organizationId, connection.name, connection.host, connection.username, encryptSecret(input.password), connection.domain, now, now]);
  return connection;
}
export async function updateRdpConnection(db: AppDatabase, id: string, patch: Partial<RdpConnection>, organizationId: string) {
  const current = await getRdpConnection(db, id, organizationId, { includePassword: true }); if (!current) return undefined;
  const next = normalizeInput({ ...current, ...patch }, current.createdAt, id);
  await db.exec(`UPDATE rdp_connections SET name=$1,host=$2,username=$3,password_encrypted=$4,domain=$5,updated_at=$6 WHERE id=$7 AND organization_id=$8`, [next.name, next.host, next.username, patch.password === undefined ? encryptSecret(current.password) : encryptSecret(patch.password), next.domain, next.updatedAt, id, organizationId]);
  return getRdpConnection(db, id, organizationId);
}
export async function deleteRdpConnection(db: AppDatabase, id: string, organizationId: string) {
  const current = await getRdpConnection(db, id, organizationId);
  await db.exec("DELETE FROM rdp_connections WHERE id=$1 AND organization_id=$2", [id, organizationId]);
  return Boolean(current);
}
export async function getRdpConnection(db: AppDatabase, id: string, organizationId: string, options?: { includePassword?: boolean }) {
  const row = await db.one<any>("SELECT * FROM rdp_connections WHERE id=$1 AND organization_id=$2", [id, organizationId]);
  return row ? mapRdp(row, options) : undefined;
}
export async function launchRdpConnection(db: AppDatabase, id: string, organizationId: string) {
  const connection = await getRdpConnection(db, id, organizationId, { includePassword: true }); if (!connection) return undefined;
  if (process.platform !== "win32") throw new Error("RDP launch is supported only on Windows.");
  const target = !connection.domain || connection.username.includes("\\") || connection.username.includes("@") ? connection.username : `${connection.domain}\\${connection.username}`;
  if (connection.password) {
    spawnSync("cmdkey.exe", [`/delete:TERMSRV/${connection.host}`], { windowsHide: true, stdio: "ignore" });
    spawnSync("cmdkey.exe", [`/generic:TERMSRV/${connection.host}`, `/user:${target}`, `/pass:${connection.password}`], { windowsHide: true, stdio: "ignore" });
  }
  spawn("mstsc.exe", [`/v:${connection.host}`], { detached: true, windowsHide: false, stdio: "ignore" }).unref();
  const now = new Date().toISOString();
  await db.exec("UPDATE rdp_connections SET last_launched_at=$1,updated_at=$1 WHERE id=$2 AND organization_id=$3", [now, id, organizationId]);
  return getRdpConnection(db, id, organizationId);
}
function normalizeInput(input: Partial<RdpConnection>, createdAt = new Date().toISOString(), id = nanoid()): RdpConnection { const name = String(input.name ?? "").trim(), host = String(input.host ?? "").trim(), username = String(input.username ?? "").trim(), domain = String(input.domain ?? "").trim() || undefined; if (!name) throw new Error("RDP name is required."); if (!host) throw new Error("RDP host / IP is required."); if (!username) throw new Error("RDP login is required."); return { id, name, host, username, domain, createdAt, updatedAt: new Date().toISOString() }; }
function mapRdp(row: any, options?: { includePassword?: boolean }): RdpConnection { const password = decryptSecret(row.password_encrypted); return { id: row.id, name: row.name, host: row.host, username: row.username, ...(options?.includePassword ? { password } : {}), hasPassword: Boolean(password), domain: row.domain ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at, lastLaunchedAt: row.last_launched_at ?? undefined }; }
