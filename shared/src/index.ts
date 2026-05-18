export type Role = "owner" | "admin" | "manager" | "member" | "client";
export type Theme = "light" | "dark" | "system";
export type ProxyProtocol = "http" | "https" | "socks5";
export type ProfileStatus = "ready" | "running" | "archived";
export type WebRtcPolicy = "default" | "company-network-only" | "disabled";
export type CanvasMode = "default" | "noise" | "fixed";
export type BrowserEngine = "chromium" | "firefox";
export type ProfileTabBehavior = "restore" | "custom";
export type ProfileStorageMode = "cloud" | "device";
export type FingerprintMode = "mask" | "custom" | "real";
export type GeolocationAccess = "ask" | "allow" | "block";
export type OperatingSystem = "macos" | "windows" | "linux" | "android";

export interface ProxySettings {
  id: string;
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  httpPort?: number;
  socks5Port?: number;
  username?: string;
  password?: string;
  hasPassword?: boolean;
  group?: string;
  country?: string;
  countryCode?: string;
  status: "unknown" | "healthy" | "degraded" | "offline";
  lastCheckedAt?: string;
  latencyMs?: number;
}

export interface ProfileCompatibilityCheck {
  profileId: string;
  score: number;
  status: "good" | "warning" | "risk";
  checks: Array<{ key: string; label: string; status: "pass" | "warning" | "fail"; detail: string }>;
}

export interface RdpConnection {
  id: string;
  name: string;
  host: string;
  username: string;
  password?: string;
  hasPassword?: boolean;
  domain?: string;
  createdAt: string;
  updatedAt: string;
  lastLaunchedAt?: string;
  version?: number;
  lastSyncAt?: string;
  lockedByUserId?: string;
  lockedAt?: string;
}

export interface FingerprintSettings {
  userAgent: string;
  timezone: string;
  timezoneMode?: FingerprintMode;
  language: string;
  languageMode?: FingerprintMode;
  screen: { width: number; height: number };
  screenMode?: FingerprintMode;
  webRtcPolicy: WebRtcPolicy;
  geolocationAccess?: GeolocationAccess;
  geolocationMode?: Exclude<FingerprintMode, "real">;
  geolocation?: { latitude: number; longitude: number };
  navigatorMode?: FingerprintMode;
  platform?: string;
  hardwareConcurrency?: number;
  osCpu?: string;
  canvasMode: CanvasMode;
  webGlMode?: FingerprintMode;
  webGlVendor: string;
  webGlRenderer?: string;
  webGpuVendorId?: string;
  webGpuDeviceId?: string;
  fonts: string[];
  mediaDevices: { audioInputs: number; videoInputs: number; audioOutputs: number };
}

export interface BrowserProfile {
  id: string;
  name: string;
  tags: string[];
  group: string;
  notes?: string;
  workspaceId: string;
  proxyId?: string;
  proxyProtocol?: ProxyProtocol;
  tabBehavior?: ProfileTabBehavior;
  operatingSystem?: OperatingSystem;
  browserEngine?: BrowserEngine;
  storageMode?: ProfileStorageMode;
  fingerprint: FingerprintSettings;
  startupUrls: string[];
  extensions: string[];
  status: ProfileStatus;
  createdAt: string;
  updatedAt: string;
  lastLaunchedAt?: string;
  version?: number;
  lastSyncAt?: string;
  lockedByUserId?: string;
  lockedAt?: string;
  assignedUsers?: Array<Pick<AuthUser, "id" | "name" | "email" | "role">>;
}

export interface Workspace {
  id: string;
  name: string;
  ownerEmail: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

export interface TeamGroup {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface TeamInvitation {
  id: string;
  workspaceId: string;
  memberId: string;
  email: string;
  token: string;
  status: "pending" | "accepted" | "revoked";
  inviteUrl: string;
  invitedAt: string;
}

export interface SmtpSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  startTls: boolean;
  username?: string;
  password?: string;
  hasPassword?: boolean;
  fromEmail: string;
  fromName: string;
  inviteBaseUrl: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationId?: string;
  lastLoginAt?: string;
  status?: "active" | "invited" | "disabled";
  createdAt: string;
}

export interface Organization { id: string; name: string; createdAt: string; }
export interface Team { id: string; organizationId: string; name: string; createdAt: string; }
export interface Invitation { id: string; organizationId: string; email: string; role: Role; teamId?: string; status: "pending" | "accepted" | "expired" | "revoked"; inviteUrl: string; expiresAt: string; acceptedAt?: string; createdAt: string; }

export interface ProfileSyncPayload {
  cookies?: unknown[];
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
  storageState?: unknown;
  sessionMetadata?: Record<string, unknown>;
  browserState?: Record<string, unknown>;
  expectedVersion?: number;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  refreshToken?: string;
}

export interface ProxylineSettings {
  apiKey?: string;
  hasApiKey?: boolean;
  accountName?: string;
  keySuffix?: string;
  balance?: number;
  partnerBalance?: number;
}

export interface TeamWorkspaceData {
  members: TeamMember[];
  groups: Array<TeamGroup & { memberIds: string[]; profileIds: string[] }>;
  invitations: TeamInvitation[];
}

export interface ActivityLog {
  id: string;
  workspaceId: string;
  actor: string;
  action: string;
  target: string;
  createdAt: string;
}

export interface ProxyTrafficStats {
  total: { bytesIn: number; bytesOut: number; totalBytes: number };
  today: { bytesIn: number; bytesOut: number; totalBytes: number };
  last7days: { bytesIn: number; bytesOut: number; totalBytes: number };
  byProxy: Array<{ proxyId: string; proxyName: string; bytesIn: number; bytesOut: number; totalBytes: number }>;
}

export interface BillingStatus {
  status: "trial" | "active" | "expired";
  plan: string;
  expiresAt: string;
  daysLeft: number;
  canLaunch: boolean;
  paymentMethod: "crypto";
  wallets: Array<{ network: string; address: string }>;
  lastPaymentAt?: string;
}

export interface CryptoPaymentRequest {
  id: string;
  network: string;
  amountUsd: number;
  walletAddress: string;
  status: "pending" | "paid" | "expired";
  createdAt: string;
  paidAt?: string;
}

export interface DashboardStats {
  profiles: number;
  onlineProfiles: number;
  proxyHealth: number;
  recentLaunches: Array<{ profileId: string; name: string; launchedAt: string }>;
  usage: Array<{ day: string; launches: number }>;
}

export interface LaunchProfileRequest {
  profileId: string;
  headless?: boolean;
  minimized?: boolean;
  startupUrls?: string[];
}

export interface ApiEnvelope<T> {
  data: T;
}


export type WorkspacePage =
  | "Dashboard"
  | "Profiles"
  | "RDP"
  | "Proxy Manager"
  | "Fingerprints"
  | "Groups"
  | "Team / Users"
  | "Logs"
  | "Automation API"
  | "Settings"
  | "Billing"
  | "Login Page"
  | "Recovery";

export const roleDescriptions: Record<Role, string> = {
  owner: "Full workspace ownership and role management.",
  admin: "Workspace administration without owner control.",
  manager: "Operational management of assigned workspace objects.",
  member: "Works only with assigned browser profiles.",
  client: "Limited access to assigned profiles only."
};

const pageAccess: Record<Role, WorkspacePage[]> = {
  owner: ["Dashboard", "Profiles", "RDP", "Proxy Manager", "Fingerprints", "Groups", "Team / Users", "Logs", "Automation API", "Settings", "Billing", "Recovery"],
  admin: ["Dashboard", "Profiles", "RDP", "Proxy Manager", "Fingerprints", "Groups", "Team / Users", "Logs", "Automation API", "Settings", "Billing", "Recovery"],
  manager: ["Dashboard", "Profiles", "RDP", "Proxy Manager", "Fingerprints", "Groups", "Team / Users", "Logs"],
  member: ["Dashboard", "Profiles"],
  client: ["Dashboard", "Profiles"]
};

export function canAccessPage(role: Role, page: WorkspacePage) {
  return pageAccess[role].includes(page);
}
export function canManageUsers(role: Role) {
  return role === "owner" || role === "admin" || role === "manager";
}
export function canInviteRole(currentRole: Role, targetRole: Role) {
  if (currentRole === "owner") return true;
  if (currentRole === "admin") return ["manager", "member", "client"].includes(targetRole);
  if (currentRole === "manager") return ["member", "client"].includes(targetRole);
  return false;
}
export function canChangeRole(currentRole: Role, targetRole: Role) {
  return canInviteRole(currentRole, targetRole);
}
export function canDeleteUser(currentRole: Role, targetUserRole: Role) {
  if (currentRole === "owner") return true;
  if (currentRole === "admin") return ["manager", "member", "client"].includes(targetUserRole);
  if (currentRole === "manager") return ["member", "client"].includes(targetUserRole);
  return false;
}
export function canCreateProfile(role: Role) { return ["owner", "admin", "manager"].includes(role); }
export function canEditProfile(role: Role, _profile?: BrowserProfile) { return ["owner", "admin", "manager"].includes(role); }
export function canDeleteProfile(role: Role, _profile?: BrowserProfile) { return ["owner", "admin"].includes(role); }
export function canLaunchProfile(role: Role, _profile?: BrowserProfile) { return ["owner", "admin", "manager", "member", "client"].includes(role); }
export function canManageProxy(role: Role) { return ["owner", "admin", "manager"].includes(role); }
export function canManageFingerprints(role: Role) { return ["owner", "admin"].includes(role); }
export function canAccessAutomationApi(role: Role) { return role === "owner"; }
export function canAccessSettings(role: Role) { return ["owner", "admin"].includes(role); }
export function canAccessRecovery(role: Role) { return role === "owner"; }
export function canManageGroups(role: Role) { return ["owner", "admin", "manager"].includes(role); }
export function canManageRdp(role: Role) { return ["owner", "admin", "manager"].includes(role); }
export function canClearLogs(role: Role) { return ["owner", "admin"].includes(role); }

export interface PasskeyCredentialSummary {
  credentialId: string;
  transports: string[];
  createdAt: string;
  lastUsedAt?: string;
}

export interface CloudAppLockSettings {
  enabled: boolean;
  updatedAt?: string;
}
