import type { AuthUser, BrowserProfile, ProfileSyncPayload } from "@profilex/shared";
import { nanoid } from "nanoid";
import { realisticFingerprintPreset } from "./fingerprintService.js";
import { logActivity } from "./activityService.js";
import type { AppDatabase } from "../database/db.js";

type ProfileRow = any;
function mapProfile(row: ProfileRow): BrowserProfile {
  return {
    id: row.id, workspaceId: row.workspace_id, name: row.name,
    tags: row.tags ?? [], group: row.profile_group_name ?? "Default", notes: row.notes ?? undefined,
    proxyId: row.proxy_id ?? undefined, proxyProtocol: row.proxy_protocol ?? undefined,
    tabBehavior: row.tab_behavior ?? undefined, operatingSystem: row.operating_system ?? undefined,
    browserEngine: row.browser_engine ?? undefined, storageMode: row.storage_mode ?? undefined,
    fingerprint: row.fingerprint ?? {}, startupUrls: row.startup_urls ?? [], extensions: row.extensions ?? [],
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    lastLaunchedAt: row.last_launched_at ?? undefined, version: row.version, lastSyncAt: row.last_sync_at ?? undefined,
    lockedByUserId: row.locked_by_user_id ?? undefined, lockedAt: row.locked_at ?? undefined
  };
}
const profileSelect = `SELECT p.*, g.name AS profile_group_name, l.user_id AS locked_by_user_id, l.acquired_at AS locked_at
  FROM profiles p LEFT JOIN profile_groups g ON g.id = p.profile_group_id LEFT JOIN profile_locks l ON l.profile_id = p.id`;
export async function listProfiles(db: AppDatabase) { return (await db.query(`${profileSelect} ORDER BY p.created_at ASC`)).map(mapProfile); }
export async function listProfilesForUser(db: AppDatabase, user: AuthUser) {
  if (user.role === "admin") return listProfiles(db);
  if (user.role === "manager") return (await db.query(`${profileSelect}
    JOIN team_group_members tgm ON tgm.group_id = p.profile_group_id
    JOIN team_members tm ON tm.id = tgm.member_id WHERE tm.email = $1 ORDER BY p.created_at ASC`, [user.email])).map(mapProfile);
  return (await db.query(`${profileSelect}
    JOIN profile_assignments pa ON pa.profile_id = p.id WHERE pa.user_id = $1 ORDER BY p.created_at ASC`, [user.id])).map(mapProfile);
}
export async function getProfile(db: AppDatabase, id: string) { const row = await db.one(`${profileSelect} WHERE p.id = $1`, [id]); return row ? mapProfile(row) : undefined; }
export async function createProfile(db: AppDatabase, input: Partial<BrowserProfile>, actorId?: string) {
  const now = new Date().toISOString();
  const group = await ensureGroup(db, input.group ?? "Default");
  const profile: BrowserProfile = { id: nanoid(), workspaceId: "workspace-default", name: input.name ?? "New Workspace", tags: input.tags ?? [], group: group.name, notes: input.notes, proxyId: input.proxyId, proxyProtocol: input.proxyProtocol ?? "http", tabBehavior: input.tabBehavior ?? "custom", operatingSystem: input.operatingSystem ?? "windows", browserEngine: input.browserEngine ?? "chromium", storageMode: input.storageMode ?? "cloud", fingerprint: input.fingerprint ?? realisticFingerprintPreset(), startupUrls: input.startupUrls ?? ["https://browserleaks.com/ip"], extensions: input.extensions ?? [], status: "ready", createdAt: now, updatedAt: now, version: 1 };
  await db.exec(`INSERT INTO profiles (id, workspace_id, name, tags, profile_group_id, notes, proxy_id, proxy_protocol, tab_behavior, operating_system, browser_engine, storage_mode, fingerprint, startup_urls, extensions, status, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`, [profile.id, profile.workspaceId, profile.name, JSON.stringify(profile.tags), group.id, profile.notes, profile.proxyId, profile.proxyProtocol, profile.tabBehavior, profile.operatingSystem, profile.browserEngine, profile.storageMode, JSON.stringify(profile.fingerprint), JSON.stringify(profile.startupUrls), JSON.stringify(profile.extensions), profile.status, now, now]);
  await logActivity(db, "profile.created", profile.name, actorId); return profile;
}
export async function updateProfile(db: AppDatabase, id: string, patch: Partial<BrowserProfile> & { expectedVersion?: number }, actorId?: string) {
  const current = await getProfile(db, id); if (!current) return undefined;
  if (patch.expectedVersion !== undefined && patch.expectedVersion !== current.version) throw new Error("Profile version conflict");
  const group = await ensureGroup(db, patch.group ?? current.group);
  const next = { ...current, ...patch, group: group.name, updatedAt: new Date().toISOString(), version: (current.version ?? 1) + 1 };
  await db.exec(`UPDATE profiles SET name=$1,tags=$2,profile_group_id=$3,notes=$4,proxy_id=$5,proxy_protocol=$6,tab_behavior=$7,operating_system=$8,browser_engine=$9,storage_mode=$10,fingerprint=$11,startup_urls=$12,extensions=$13,status=$14,updated_at=$15,last_launched_at=$16,version=$17 WHERE id=$18`,
    [next.name, JSON.stringify(next.tags), group.id, next.notes, next.proxyId, next.proxyProtocol, next.tabBehavior, next.operatingSystem, next.browserEngine, next.storageMode, JSON.stringify(next.fingerprint), JSON.stringify(next.startupUrls), JSON.stringify(next.extensions), next.status, next.updatedAt, next.lastLaunchedAt, next.version, id]);
  await logActivity(db, "profile.updated", next.name, actorId); return next;
}
export async function cloneProfile(db: AppDatabase, id: string, actorId?: string) { const profile = await getProfile(db, id); return profile ? createProfile(db, { ...profile, name: `${profile.name} Copy` }, actorId) : undefined; }
export async function deleteProfile(db: AppDatabase, id: string, actorId?: string) { const profile = await getProfile(db, id); await db.exec("DELETE FROM profiles WHERE id=$1", [id]); if (profile) await logActivity(db, "profile.deleted", profile.name, actorId); return Boolean(profile); }
export async function assignProfileToUser(db: AppDatabase, profileId: string, userId: string) { if (!(await getProfile(db, profileId)) || !(await db.one("SELECT id FROM users WHERE id=$1", [userId]))) return undefined; await db.exec("INSERT INTO profile_assignments (profile_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [profileId, userId]); return { profileId, userId }; }
export async function syncProfileState(db: AppDatabase, profileId: string, payload: ProfileSyncPayload, actorId?: string) {
  return db.transaction(async (tx) => {
    const profile = await getProfile(tx, profileId); if (!profile) return undefined;
    if (payload.expectedVersion !== undefined && payload.expectedVersion !== profile.version) throw new Error("Profile version conflict");
    const now = new Date().toISOString();
    await tx.exec(`INSERT INTO cookies (profile_id,payload,updated_at) VALUES ($1,$2,$3)
      ON CONFLICT (profile_id) DO UPDATE SET payload=EXCLUDED.payload, updated_at=EXCLUDED.updated_at`, [profileId, JSON.stringify(payload.cookies ?? []), now]);
    await tx.exec(`INSERT INTO browser_states (profile_id,local_storage,session_storage,storage_state,session_metadata,browser_state,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (profile_id) DO UPDATE SET local_storage=EXCLUDED.local_storage,session_storage=EXCLUDED.session_storage,storage_state=EXCLUDED.storage_state,session_metadata=EXCLUDED.session_metadata,browser_state=EXCLUDED.browser_state,updated_at=EXCLUDED.updated_at`,
      [profileId, JSON.stringify(payload.localStorage ?? {}), JSON.stringify(payload.sessionStorage ?? {}), JSON.stringify(payload.storageState ?? null), JSON.stringify(payload.sessionMetadata ?? {}), JSON.stringify(payload.browserState ?? {}), now]);
    await tx.exec("UPDATE profiles SET last_sync_at=$1, updated_at=$1, version=version+1 WHERE id=$2", [now, profileId]);
    await logActivity(tx, "profile.synced", profile.name, actorId);
    return { profileId, syncedAt: now, version: (profile.version ?? 1) + 1 };
  });
}
export async function getProfileBrowserState(db: AppDatabase, profileId: string) {
  const row = await db.one<any>(`SELECT c.payload AS cookies, b.local_storage, b.session_storage, b.storage_state, b.session_metadata, b.browser_state
    FROM profiles p LEFT JOIN cookies c ON c.profile_id=p.id LEFT JOIN browser_states b ON b.profile_id=p.id WHERE p.id=$1`, [profileId]);
  if (!row) return undefined;
  return { cookies: row.cookies ?? [], localStorage: row.local_storage ?? {}, sessionStorage: row.session_storage ?? {}, storageState: row.storage_state ?? undefined, sessionMetadata: row.session_metadata ?? {}, browserState: row.browser_state ?? {} };
}
async function ensureGroup(db: AppDatabase, name: string) { const current = await db.one<any>("SELECT * FROM profile_groups WHERE name=$1", [name]); if (current) return current; const row = { id: nanoid(), workspace_id: "workspace-default", name, description: name === "Default" ? "Default profile access group" : null, created_at: new Date().toISOString() }; await db.exec("INSERT INTO profile_groups (id,workspace_id,name,description,created_at) VALUES ($1,$2,$3,$4,$5)", [row.id,row.workspace_id,row.name,row.description,row.created_at]); return row; }
