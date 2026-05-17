import type { RequestHandler } from "express";
import {
  canAccessAutomationApi,
  canAccessRecovery,
  canAccessSettings,
  canCreateProfile,
  canDeleteProfile,
  canEditProfile,
  canLaunchProfile,
  canManageFingerprints,
  canManageGroups,
  canManageProxy,
  canManageRdp,
  canManageUsers,
  type AuthUser,
  type Role
} from "@profilex/shared";
import type { AppDatabase } from "../database/db.js";
import { getUserByToken } from "./authService.js";
import { logActivity } from "./activityService.js";

const rank: Record<Role, number> = { owner: 5, admin: 4, manager: 3, member: 2, client: 1 };
export function can(role: Role, minimum: Role) { return rank[role] >= rank[minimum]; }

export function requireAuth(db: AppDatabase): RequestHandler {
  return async (req, res, next) => {
    const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7).trim() : undefined;
    const user = await getUserByToken(db, token);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    res.locals.authUser = user;
    next();
  };
}
export function requireRole(...roles: Role[]): RequestHandler {
  return (_req, res, next) => roles.includes((res.locals.authUser as AuthUser).role) ? next() : res.status(403).json({ error: "Forbidden" });
}
export function requireOrganizationAccess(): RequestHandler {
  return (_req, res, next) => res.locals.authUser?.organizationId ? next() : res.status(403).json({ error: "Organization required" });
}
export function requireDesktopClient(): RequestHandler {
  return (req, res, next) => req.headers["x-profilex-client"] === "electron" ? next() : res.status(403).json({ error: "Launch is available only in the desktop app" });
}
export function requirePermission(db: AppDatabase, action: string, predicate: (user: AuthUser) => boolean): RequestHandler {
  return async (_req, res, next) => {
    const user = res.locals.authUser as AuthUser;
    if (predicate(user)) return next();
    await logActivity(db, "access.denied", action, user.id);
    return res.status(403).json({ error: "Forbidden" });
  };
}
export const permissionChecks = {
  manageUsers: (user: AuthUser) => canManageUsers(user.role),
  createProfile: (user: AuthUser) => canCreateProfile(user.role),
  editProfile: (user: AuthUser) => canEditProfile(user.role),
  deleteProfile: (user: AuthUser) => canDeleteProfile(user.role),
  launchProfile: (user: AuthUser) => canLaunchProfile(user.role),
  manageProxy: (user: AuthUser) => canManageProxy(user.role),
  manageFingerprints: (user: AuthUser) => canManageFingerprints(user.role),
  manageGroups: (user: AuthUser) => canManageGroups(user.role),
  manageRdp: (user: AuthUser) => canManageRdp(user.role),
  automation: (user: AuthUser) => canAccessAutomationApi(user.role),
  settings: (user: AuthUser) => canAccessSettings(user.role),
  recovery: (user: AuthUser) => canAccessRecovery(user.role)
};
export async function hasProfileAccess(db: AppDatabase, user: AuthUser, profileId: string) {
  const row = await db.one<any>("SELECT organization_id FROM profiles WHERE id=$1", [profileId]);
  if (!row || row.organization_id !== user.organizationId) return false;
  if (can(user.role, "admin")) return true;
  if (user.role === "manager") return Boolean(await db.one(`SELECT 1 FROM profiles p JOIN team_group_members tgm ON tgm.group_id=p.profile_group_id JOIN team_members tm ON tm.id=tgm.member_id WHERE p.id=$1 AND tm.email=$2`, [profileId, user.email]));
  return Boolean(await db.one("SELECT 1 FROM profile_assignments WHERE profile_id=$1 AND user_id=$2", [profileId, user.id]));
}
export function requireProfileAccess(db: AppDatabase): RequestHandler {
  return async (req, res, next) => {
    if (await hasProfileAccess(db, res.locals.authUser, req.params.id)) return next();
    await logActivity(db, "access.denied", `profile:${req.params.id}`, res.locals.authUser.id);
    return res.status(403).json({ error: "Profile access denied" });
  };
}
