import type { BrowserProfile } from "@profilex/shared";
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
  return db.prepare("SELECT * FROM profiles ORDER BY updated_at DESC").all().map(mapProfile);
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
    fingerprint: input.fingerprint ?? realisticFingerprintPreset(),
    startupUrls: input.startupUrls ?? ["https://example.com"],
    extensions: input.extensions ?? [],
    status: "ready",
    createdAt: now,
    updatedAt: now
  };

  db.prepare(
    `INSERT INTO profiles
    (id, workspace_id, name, tags, profile_group, notes, proxy_id, fingerprint, startup_urls, extensions, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    profile.id,
    profile.workspaceId,
    profile.name,
    JSON.stringify(profile.tags),
    profile.group,
    profile.notes,
    profile.proxyId,
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
    `UPDATE profiles SET name=?, tags=?, profile_group=?, notes=?, proxy_id=?, fingerprint=?, startup_urls=?, extensions=?, status=?, updated_at=?, last_launched_at=? WHERE id=?`
  ).run(
    next.name,
    JSON.stringify(next.tags),
    next.group,
    next.notes,
    next.proxyId,
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
