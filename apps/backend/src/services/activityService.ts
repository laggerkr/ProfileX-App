import { nanoid } from "nanoid";
import type { AppDatabase } from "../database/db.js";

export async function logActivity(db: AppDatabase, action: string, target: string, actorId?: string, meta?: { ipAddress?: string; deviceId?: string }) {
  await db.exec(`INSERT INTO audit_logs (id, actor_id, action, target, ip_address, device_id, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)`, [nanoid(), actorId, action, target, meta?.ipAddress, meta?.deviceId, new Date().toISOString()]);
}
