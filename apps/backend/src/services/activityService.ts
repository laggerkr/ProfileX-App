import { nanoid } from "nanoid";
import type { AppDatabase } from "../database/db.js";
import { logWarn } from "../logger.js";

export async function logActivity(db: AppDatabase, action: string, target: string, actorId?: string, meta?: { ipAddress?: string; deviceId?: string }) {
  try {
    const validActorId = actorId && await db.one("SELECT 1 FROM users WHERE id=$1", [actorId]) ? actorId : undefined;
    if (actorId && !validActorId) logWarn("auth", "[audit] skipped invalid actor_id", { actorId, action, target });
    await db.exec(`INSERT INTO audit_logs (id, actor_id, action, target, ip_address, device_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)`, [nanoid(), validActorId, action, target, meta?.ipAddress, meta?.deviceId, new Date().toISOString()]);
  } catch (error) {
    logWarn("auth", "[audit] write skipped", { action, target, actorId, error: error instanceof Error ? error.message : String(error) });
  }
}
