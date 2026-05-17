import type { AuthUser, Role } from "@profilex/shared";
import { canChangeRole, canDeleteUser } from "@profilex/shared";
import type { AppDatabase } from "../database/db.js";
import { logActivity } from "./activityService.js";
const map = (r: any): AuthUser => ({ id: r.id, name: r.name, email: r.email, role: r.member_role ?? r.role, organizationId: r.organization_id, lastLoginAt: r.last_login_at ?? undefined, status: r.member_status ?? r.status, createdAt: r.created_at });
export async function listUsers(db: AppDatabase, orgId: string) { return (await db.query(`SELECT u.*,om.organization_id,om.role AS member_role,om.status AS member_status FROM users u JOIN organization_members om ON om.user_id=u.id WHERE om.organization_id=$1 ORDER BY u.created_at`, [orgId])).map(map); }
async function ownerCount(db: AppDatabase, orgId: string) { const row = await db.one<{ count: number }>(`SELECT COUNT(*)::int AS count FROM organization_members WHERE organization_id=$1 AND role='owner'`, [orgId]); return row?.count ?? 0; }
export async function updateUser(db: AppDatabase, orgId: string, id: string, patch: { role?: Role; status?: string }, actor: AuthUser) {
  const row = await db.one<any>("SELECT * FROM organization_members WHERE organization_id=$1 AND user_id=$2", [orgId, id]);
  if (!row) return undefined;
  const role = patch.role ?? row.role, status = patch.status ?? row.status;
  if (row.role === "owner" && actor.role !== "owner") throw new Error("Forbidden");
  if (role !== row.role && !canChangeRole(actor.role, role)) throw new Error("Forbidden");
  if (row.role === "owner" && role !== "owner" && await ownerCount(db, orgId) <= 1) throw new Error("Cannot change the last owner");
  await db.exec("UPDATE organization_members SET role=$1,status=$2 WHERE organization_id=$3 AND user_id=$4", [role, status, orgId, id]);
  await db.exec("UPDATE users SET role=$1,status=$2 WHERE id=$3", [role, status, id]);
  await logActivity(db, "user.role_changed", id, actor.id);
  return (await listUsers(db, orgId)).find((user) => user.id === id);
}
export async function deleteUser(db: AppDatabase, orgId: string, id: string, actor: AuthUser) {
  const row = await db.one<any>("SELECT role FROM organization_members WHERE organization_id=$1 AND user_id=$2", [orgId, id]);
  if (!row) return false;
  if (!canDeleteUser(actor.role, row.role)) throw new Error("Forbidden");
  if (row.role === "owner" && await ownerCount(db, orgId) <= 1) throw new Error("Cannot delete the last owner");
  await db.exec("DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2", [orgId, id]);
  await logActivity(db, "user.removed", id, actor.id);
  return true;
}
