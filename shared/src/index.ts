export type Role = "admin" | "manager" | "client";
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
  createdAt: string;
}

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
