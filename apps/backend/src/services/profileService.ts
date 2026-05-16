import type { AuthUser, BrowserProfile, ProfileSyncPayload } from "@profilex/shared";
import { nanoid } from "nanoid";
import { realisticFingerprintPreset } from "./fingerprintService.js";
import { logActivity } from "./activityService.js";
import type { AppDatabase } from "../database/db.js";

function mapProfile(row: any): BrowserProfile {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    tags: JSON.parse(row.tags),
    group: row.profile_group,
    notes: row.notes ?? undefined,
    proxyId: row.proxy_id ?? undefined,
    proxyProtocol: row.proxy_protocol ?? undefined,
    tabBehavior: row.tab_behavior ?? undefined,
    operatingSystem: row.operating_system ?? undefined,
    browserEngine: row.browser_engine ?? undefined,
    storageMode: row.storage_mode ?? undefined,
    fingerprint: JSON.parse(row.fingerprint),
    startupUrls: JSON.parse(row.startup_urls),
    extensions: JSON.parse(row.extensions),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLaunchedAt: row.last_launched_at ?? undefined
  };
}

export function listProfiles(db: AppDatabase) {
  return db.prepare("SELECT * FROM profiles ORDER BY created_at ASC").all().map(mapProfile);
}

export function listProfilesForUser(db: AppDatabase, user: AuthUser) {
  if (user.role === "admin") return listProfiles(db);
  if (user.role === "manager") {
    return db.prepare(`SELECT DISTINCT profiles.* FROM profiles
      JOIN team_groups ON team_groups.name = profiles.profile_group
      JOIN team_group_members ON team_group_members.group_id = team_groups.id
      JOIN team_members ON team_members.id = team_group_members.member_id
      WHERE team_members.email = ? ORDER BY profiles.created_at ASC`).all(user.email).map(mapProfile);
  }
  return db.prepare(`SELECT profiles.* FROM profiles
    JOIN profile_assignments ON profile_assignments.profile_id = profiles.id
    WHERE profile_assignments.user_id = ? ORDER BY profiles.created_at ASC`).all(user.id).map(mapProfile);
}

export function getProfile(db: AppDatabase, id: string) {
  const row = db.prepare("SELECT * FROM profiles WHERE id = ?").get(id);
  return row ? mapProfile(row) : undefined;
}

export function createProfile(db: AppDatabase, input: Partial<BrowserProfile>) {
  const now = new Date().toISOString();
  const profile: BrowserProfile = {
    id: nanoid(),
    workspaceId: "workspace-default",
    name: input.name ?? "New Workspace",
    tags: input.tags ?? [],
    group: input.group ?? "Default",
    notes: input.notes,
    proxyId: input.proxyId,
    proxyProtocol: input.proxyProtocol ?? "http",
    tabBehavior: input.tabBehavior ?? "custom",
    operatingSystem: input.operatingSystem ?? "windows",
    browserEngine: input.browserEngine ?? "chromium",
    storageMode: input.storageMode ?? "device",
    fingerprint: input.fingerprint ?? realisticFingerprintPreset(),
    startupUrls: input.startupUrls ?? ["https://browserleaks.com/ip"],
    extensions: input.extensions ?? [],
    status: "ready",
    createdAt: now,
    updatedAt: now
  };

  db.prepare(
    `INSERT INTO profiles
    (id, workspace_id, name, tags, profile_group, notes, proxy_id, proxy_protocol, tab_behavior, operating_system, browser_engine, storage_mode, fingerprint, startup_urls, extensions, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    profile.id,
    profile.workspaceId,
    profile.name,
    JSON.stringify(profile.tags),
    profile.group,
    profile.notes,
    profile.proxyId,
    profile.proxyProtocol,
    profile.tabBehavior,
    profile.operatingSystem,
    profile.browserEngine,
    profile.storageMode,
    JSON.stringify(profile.fingerprint),
    JSON.stringify(profile.startupUrls),
    JSON.stringify(profile.extensions),
    profile.status,
    profile.createdAt,
    profile.updatedAt
  );
  logActivity(db, "profile.created", profile.name);
  return profile;
}

export function updateProfile(db: AppDatabase, id: string, patch: Partial<BrowserProfile>) {
  const current = getProfile(db, id);
  if (!current) return undefined;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  db.prepare(
    `UPDATE profiles SET name=?, tags=?, profile_group=?, notes=?, proxy_id=?, proxy_protocol=?, tab_behavior=?, operating_system=?, browser_engine=?, storage_mode=?, fingerprint=?, startup_urls=?, extensions=?, status=?, updated_at=?, last_launched_at=? WHERE id=?`
  ).run(
    next.name,
    JSON.stringify(next.tags),
    next.group,
    next.notes,
    next.proxyId,
    next.proxyProtocol,
    next.tabBehavior,
    next.operatingSystem,
    next.browserEngine,
    next.storageMode,
    JSON.stringify(next.fingerprint),
    JSON.stringify(next.startupUrls),
    JSON.stringify(next.extensions),
    next.status,
    next.updatedAt,
    next.lastLaunchedAt,
    id
  );
  logActivity(db, "profile.updated", next.name);
  return next;
}

export function cloneProfile(db: AppDatabase, id: string) {
  const profile = getProfile(db, id);
  if (!profile) return undefined;
  return createProfile(db, { ...profile, name: `${profile.name} Copy` });
}

export function deleteProfile(db: AppDatabase, id: string) {
  const profile = getProfile(db, id);
  db.prepare("DELETE FROM profiles WHERE id = ?").run(id);
  if (profile) logActivity(db, "profile.deleted", profile.name);
  return Boolean(profile);
}

export function assignProfileToUser(db: AppDatabase, profileId: string, userId: string) {
  if (!getProfile(db, profileId)) return undefined;
  if (!db.prepare("SELECT id FROM users WHERE id = ?").get(userId)) return undefined;
  db.prepare("INSERT OR IGNORE INTO profile_assignments (profile_id, user_id) VALUES (?, ?)").run(profileId, userId);
  return { profileId, userId };
}

export function syncProfileState(db: AppDatabase, profileId: string, payload: ProfileSyncPayload) {
  const profile = getProfile(db, profileId);
  if (!profile) return undefined;
  const now = new Date().toISOString();
  db.prepare("INSERT OR REPLACE INTO cookies (profile_id, payload, updated_at) VALUES (?, ?, ?)").run(profileId, JSON.stringify(payload), now);
  return { profileId, syncedAt: now };
}
