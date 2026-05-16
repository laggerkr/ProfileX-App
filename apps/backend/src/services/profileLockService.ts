import { nanoid } from "nanoid";
import type { AuthUser } from "@profilex/shared";
import type { AppDatabase } from "../database/db.js";
import { logActivity } from "./activityService.js";
import { log } from "../logger.js";
import { cacheDel, cacheSet } from "../cache.js";

export async function acquireProfileLock(db: AppDatabase, profileId: string, user: AuthUser, meta: { deviceId?: string; ipAddress?: string; userAgent?: string }) {
  return db.transaction(async (tx) => {
    const existing = await tx.one<any>("SELECT * FROM profile_locks WHERE profile_id=$1", [profileId]);
    if (existing && existing.user_id !== user.id) return { acquired: false, reason: "Profile already in use", lock: existing };
    const now = new Date().toISOString();
    await tx.exec(`INSERT INTO profile_locks (profile_id,user_id,device_id,acquired_at,heartbeat_at) VALUES ($1,$2,$3,$4,$4)
      ON CONFLICT (profile_id) DO UPDATE SET user_id=EXCLUDED.user_id,device_id=EXCLUDED.device_id,heartbeat_at=EXCLUDED.heartbeat_at`, [profileId,user.id,meta.deviceId,now]);
    const sessionId = nanoid();
    await tx.exec("INSERT INTO active_sessions (id,profile_id,user_id,device_id,ip_address,user_agent,started_at) VALUES ($1,$2,$3,$4,$5,$6,$7)", [sessionId,profileId,user.id,meta.deviceId,meta.ipAddress,meta.userAgent,now]);
    await tx.exec("INSERT INTO browser_launch_logs (id,profile_id,user_id,ip_address,device_id,user_agent,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)", [nanoid(),profileId,user.id,meta.ipAddress,meta.deviceId,meta.userAgent,now]);
    await logActivity(tx, "profile.locked", profileId, user.id, meta); await cacheSet(`profile-lock:${profileId}`, user.id, 3600); log("profile-lock", "acquired", { profileId, userId: user.id });
    return { acquired: true, sessionId, acquiredAt: now };
  });
}
export async function releaseProfileLock(db: AppDatabase, profileId: string, user: AuthUser, force = false) {
  const lock = await db.one<any>("SELECT * FROM profile_locks WHERE profile_id=$1", [profileId]);
  if (!lock) return { released: false };
  if (!force && lock.user_id !== user.id) throw new Error("Profile already in use");
  await db.exec("DELETE FROM profile_locks WHERE profile_id=$1", [profileId]);
  await db.exec("UPDATE active_sessions SET ended_at=$1 WHERE profile_id=$2 AND ended_at IS NULL", [new Date().toISOString(), profileId]);
  await logActivity(db, force ? "profile.force_unlocked" : "profile.unlocked", profileId, user.id); await cacheDel(`profile-lock:${profileId}`); log("profile-lock", force ? "force released" : "released", { profileId, userId: user.id });
  return { released: true };
}
export async function listActiveSessions(db: AppDatabase) { return db.query("SELECT * FROM active_sessions WHERE ended_at IS NULL ORDER BY started_at DESC"); }
