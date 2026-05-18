import type { AppDatabase } from "../database/db.js";
import { logActivity } from "./activityService.js";

export async function createRecoveryBackup(db: AppDatabase, actorId?: string) {
  const [profiles, proxies, settings] = await Promise.all([
    db.query("SELECT * FROM profiles ORDER BY created_at ASC"),
    db.query("SELECT * FROM proxies ORDER BY name ASC"),
    db.query("SELECT * FROM settings ORDER BY key ASC")
  ]);
  const backup = { version: 1, createdAt: new Date().toISOString(), profiles, proxies, settings };
  await logActivity(db, "recovery.backup_created", `${profiles.length}:${proxies.length}`, actorId);
  return backup;
}

export async function restoreRecoveryBackup(db: AppDatabase, backup: any, actorId?: string) {
  if (!backup || backup.version !== 1 || !Array.isArray(backup.profiles) || !Array.isArray(backup.proxies) || !Array.isArray(backup.settings)) throw new Error("Invalid backup format.");
  await db.transaction(async (tx) => {
    for (const row of backup.settings) await tx.exec("INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", [row.key, row.value]);
    for (const row of backup.proxies) await tx.exec(`INSERT INTO proxies (id,organization_id,name,protocol,host,port,http_port,socks5_port,username,password_encrypted,proxy_group,country,country_code,status,last_checked_at,latency_ms)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (id) DO UPDATE SET organization_id=EXCLUDED.organization_id,name=EXCLUDED.name,protocol=EXCLUDED.protocol,host=EXCLUDED.host,port=EXCLUDED.port,http_port=EXCLUDED.http_port,socks5_port=EXCLUDED.socks5_port,username=EXCLUDED.username,password_encrypted=EXCLUDED.password_encrypted,proxy_group=EXCLUDED.proxy_group,country=EXCLUDED.country,country_code=EXCLUDED.country_code,status=EXCLUDED.status,last_checked_at=EXCLUDED.last_checked_at,latency_ms=EXCLUDED.latency_ms`, [row.id,row.organization_id,row.name,row.protocol,row.host,row.port,row.http_port,row.socks5_port,row.username,row.password_encrypted,row.proxy_group,row.country,row.country_code,row.status,row.last_checked_at,row.latency_ms]);
    for (const row of backup.profiles) await tx.exec(`INSERT INTO profiles (id,workspace_id,organization_id,name,tags,profile_group_id,notes,proxy_id,proxy_protocol,tab_behavior,operating_system,browser_engine,storage_mode,fingerprint,startup_urls,extensions,status,version,created_at,updated_at,last_launched_at,last_sync_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      ON CONFLICT (id) DO UPDATE SET workspace_id=EXCLUDED.workspace_id,organization_id=EXCLUDED.organization_id,name=EXCLUDED.name,tags=EXCLUDED.tags,profile_group_id=EXCLUDED.profile_group_id,notes=EXCLUDED.notes,proxy_id=EXCLUDED.proxy_id,proxy_protocol=EXCLUDED.proxy_protocol,tab_behavior=EXCLUDED.tab_behavior,operating_system=EXCLUDED.operating_system,browser_engine=EXCLUDED.browser_engine,storage_mode=EXCLUDED.storage_mode,fingerprint=EXCLUDED.fingerprint,startup_urls=EXCLUDED.startup_urls,extensions=EXCLUDED.extensions,status=EXCLUDED.status,version=EXCLUDED.version,updated_at=EXCLUDED.updated_at,last_launched_at=EXCLUDED.last_launched_at,last_sync_at=EXCLUDED.last_sync_at`, [row.id,row.workspace_id,row.organization_id,row.name,row.tags,row.profile_group_id,row.notes,row.proxy_id,row.proxy_protocol,row.tab_behavior,row.operating_system,row.browser_engine,row.storage_mode,row.fingerprint,row.startup_urls,row.extensions,row.status,row.version,row.created_at,row.updated_at,row.last_launched_at,row.last_sync_at]);
  });
  await logActivity(db, "recovery.backup_restored", `${backup.profiles.length}:${backup.proxies.length}`, actorId);
  return { restored: true, profiles: backup.profiles.length, proxies: backup.proxies.length, settings: backup.settings.length };
}

export async function clearStaleSessions(db: AppDatabase, actorId?: string) {
  const sessions = await db.query<any>("UPDATE active_sessions SET ended_at=now() WHERE ended_at IS NULL RETURNING id");
  await db.exec("DELETE FROM profile_locks");
  await logActivity(db, "recovery.sessions_cleared", String(sessions.length), actorId);
  return { clearedSessions: sessions.length };
}

export async function fixRunningProfiles(db: AppDatabase, actorId?: string) {
  const rows = await db.query<any>("UPDATE profiles SET status='ready',updated_at=now() WHERE status='running' AND id NOT IN (SELECT profile_id FROM profile_locks) RETURNING id");
  await logActivity(db, "recovery.running_profiles_fixed", String(rows.length), actorId);
  return { fixedProfiles: rows.length };
}