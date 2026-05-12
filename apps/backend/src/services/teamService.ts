import type { Role, TeamGroup, TeamInvitation, TeamMember, TeamWorkspaceData } from "@profilex/shared";
import { nanoid } from "nanoid";
import type { AppDatabase } from "../database/db.js";
import { logActivity } from "./activityService.js";
import { getSmtpSettings } from "./settingsService.js";

function mapMember(row: any): TeamMember {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: Boolean(row.active)
  };
}

function mapGroup(row: any): TeamGroup {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description ?? undefined,
    createdAt: row.created_at
  };
}

function mapInvitation(row: any, inviteBaseUrl = "profilex://invite"): TeamInvitation {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    memberId: row.member_id,
    email: row.email,
    token: row.token,
    status: row.status,
    inviteUrl: `${inviteBaseUrl.replace(/\/$/, "")}/${row.token}`,
    invitedAt: row.invited_at
  };
}

export function getTeamWorkspace(db: AppDatabase): TeamWorkspaceData {
  ensureProfileGroups(db);
  const members = db.prepare("SELECT * FROM team_members ORDER BY role ASC, name ASC").all().map(mapMember);
  const groups = db.prepare("SELECT * FROM team_groups ORDER BY name ASC").all().map((row) => {
    const group = mapGroup(row);
    const memberIds = db.prepare("SELECT member_id FROM team_group_members WHERE group_id = ?").all(group.id).map((item) => String(item.member_id));
    const profileIds = db.prepare("SELECT id FROM profiles WHERE profile_group = ? ORDER BY name ASC").all(group.name).map((item) => String(item.id));
    return { ...group, memberIds, profileIds };
  });
  const inviteBaseUrl = getSmtpSettings(db).inviteBaseUrl;
  const invitations = db.prepare("SELECT * FROM team_invitations ORDER BY invited_at DESC").all().map((row) => mapInvitation(row, inviteBaseUrl));
  return { members, groups, invitations };
}

export function createTeamMember(db: AppDatabase, input: { name: string; email: string; role: Role; groupIds?: string[] }) {
  const name = input.name.trim();
  const email = input.email.trim();
  if (!name || !email) throw new Error("Member name and email are required");
  const member: TeamMember = {
    id: nanoid(),
    workspaceId: "workspace-default",
    name,
    email,
    role: input.role,
    active: false
  };
  db.prepare("INSERT INTO team_members (id, workspace_id, name, email, role, active) VALUES (?, ?, ?, ?, ?, ?)").run(
    member.id,
    member.workspaceId,
    member.name,
    member.email,
    member.role,
    0
  );
  setMemberGroups(db, member.id, input.groupIds ?? []);
  const invitation = createInvitation(db, member.id, member.email);
  logActivity(db, "member.invited", `${member.name} <${member.email}>`);
  return { ...member, inviteUrl: invitation.inviteUrl };
}

export function resendTeamInvitation(db: AppDatabase, memberId: string) {
  const member = db.prepare("SELECT * FROM team_members WHERE id = ?").get(memberId);
  if (!member) return undefined;
  db.prepare("UPDATE team_invitations SET status = 'revoked' WHERE member_id = ? AND status = 'pending'").run(memberId);
  const invitation = createInvitation(db, memberId, member.email);
  logActivity(db, "member.invite_resent", member.email);
  return invitation;
}

export function acceptTeamInvitation(db: AppDatabase, token: string) {
  const invitation = db.prepare("SELECT * FROM team_invitations WHERE token = ? AND status = 'pending'").get(token);
  if (!invitation) return undefined;
  db.prepare("UPDATE team_invitations SET status = 'accepted' WHERE id = ?").run(invitation.id);
  db.prepare("UPDATE team_members SET active = 1 WHERE id = ?").run(invitation.member_id);
  logActivity(db, "member.invite_accepted", invitation.email);
  return mapInvitation({ ...invitation, status: "accepted" }, getSmtpSettings(db).inviteBaseUrl);
}

function createInvitation(db: AppDatabase, memberId: string, email: string) {
  const invitation: TeamInvitation = {
    id: nanoid(),
    workspaceId: "workspace-default",
    memberId,
    email,
    token: nanoid(32),
    status: "pending",
    invitedAt: new Date().toISOString(),
    inviteUrl: ""
  };
  invitation.inviteUrl = `${getSmtpSettings(db).inviteBaseUrl.replace(/\/$/, "")}/${invitation.token}`;
  db.prepare("INSERT INTO team_invitations (id, workspace_id, member_id, email, token, status, invited_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    invitation.id,
    invitation.workspaceId,
    invitation.memberId,
    invitation.email,
    invitation.token,
    invitation.status,
    invitation.invitedAt
  );
  return invitation;
}

export function updateTeamMember(db: AppDatabase, id: string, patch: Partial<TeamMember> & { groupIds?: string[] }) {
  const current = db.prepare("SELECT * FROM team_members WHERE id = ?").get(id);
  if (!current) return undefined;
  const next = { ...mapMember(current), ...patch };
  db.prepare("UPDATE team_members SET name=?, email=?, role=?, active=? WHERE id=?").run(
    next.name,
    next.email,
    next.role,
    next.active ? 1 : 0,
    id
  );
  if (patch.groupIds) setMemberGroups(db, id, patch.groupIds);
  logActivity(db, "member.updated", next.name);
  return next;
}

export function deleteTeamMember(db: AppDatabase, id: string) {
  const member = db.prepare("SELECT * FROM team_members WHERE id = ?").get(id);
  db.prepare("DELETE FROM team_group_members WHERE member_id = ?").run(id);
  db.prepare("DELETE FROM team_members WHERE id = ?").run(id);
  if (member) logActivity(db, "member.deleted", member.name);
  return Boolean(member);
}

export function createTeamGroup(db: AppDatabase, input: { name: string; description?: string }) {
  const name = input.name.trim();
  if (!name) throw new Error("Group name is required");
  const now = new Date().toISOString();
  const group: TeamGroup = {
    id: nanoid(),
    workspaceId: "workspace-default",
    name,
    description: input.description?.trim() || undefined,
    createdAt: now
  };
  db.prepare("INSERT INTO team_groups (id, workspace_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)").run(
    group.id,
    group.workspaceId,
    group.name,
    group.description,
    group.createdAt
  );
  logActivity(db, "group.created", group.name);
  return group;
}

export function updateTeamGroup(db: AppDatabase, id: string, patch: Partial<TeamGroup>) {
  const currentRow = db.prepare("SELECT * FROM team_groups WHERE id = ?").get(id);
  if (!currentRow) return undefined;
  const current = mapGroup(currentRow);
  const next = {
    ...current,
    ...patch,
    name: patch.name?.trim() || current.name,
    description: patch.description?.trim() || undefined
  };
  db.prepare("UPDATE team_groups SET name=?, description=? WHERE id=?").run(next.name, next.description, id);
  if (next.name !== current.name) {
    db.prepare("UPDATE profiles SET profile_group = ? WHERE profile_group = ?").run(next.name, current.name);
  }
  logActivity(db, "group.updated", next.name);
  return next;
}

export function deleteTeamGroup(db: AppDatabase, id: string) {
  const group = db.prepare("SELECT * FROM team_groups WHERE id = ?").get(id);
  if (!group) return false;
  db.prepare("UPDATE profiles SET profile_group = 'Default' WHERE profile_group = ?").run(group.name);
  db.prepare("DELETE FROM team_group_members WHERE group_id = ?").run(id);
  db.prepare("DELETE FROM team_groups WHERE id = ?").run(id);
  ensureGroup(db, "Default");
  logActivity(db, "group.deleted", group.name);
  return true;
}

export function assignProfileGroup(db: AppDatabase, profileId: string, groupId: string) {
  const group = db.prepare("SELECT * FROM team_groups WHERE id = ?").get(groupId);
  const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(profileId);
  if (!group || !profile) return undefined;
  db.prepare("UPDATE profiles SET profile_group=?, updated_at=? WHERE id=?").run(group.name, new Date().toISOString(), profileId);
  logActivity(db, "profile.group_assigned", `${profile.name} -> ${group.name}`);
  return { profileId, groupId };
}

function setMemberGroups(db: AppDatabase, memberId: string, groupIds: string[]) {
  db.prepare("DELETE FROM team_group_members WHERE member_id = ?").run(memberId);
  for (const groupId of groupIds.filter(Boolean)) {
    db.prepare("INSERT OR IGNORE INTO team_group_members (group_id, member_id) VALUES (?, ?)").run(groupId, memberId);
  }
}

function ensureProfileGroups(db: AppDatabase) {
  ensureGroup(db, "Default");
  const profileGroups = db.prepare("SELECT DISTINCT profile_group FROM profiles").all();
  for (const row of profileGroups) {
    ensureGroup(db, String(row.profile_group || "Default"));
  }
}

function ensureGroup(db: AppDatabase, name: string) {
  const existing = db.prepare("SELECT id FROM team_groups WHERE name = ?").get(name);
  if (existing) return;
  db.prepare("INSERT INTO team_groups (id, workspace_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)").run(
    nanoid(),
    "workspace-default",
    name,
    name === "Default" ? "Default profile access group" : undefined,
    new Date().toISOString()
  );
}
