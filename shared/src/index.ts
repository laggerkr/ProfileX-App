export type Role = "admin" | "manager" | "employee";
export type Theme = "light" | "dark" | "system";
export type ProxyProtocol = "http" | "https" | "socks5";
export type ProfileStatus = "ready" | "running" | "archived";
export type WebRtcPolicy = "default" | "company-network-only" | "disabled";
export type CanvasMode = "default" | "noise" | "fixed";

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

export interface FingerprintSettings {
  userAgent: string;
  timezone: string;
  language: string;
  screen: { width: number; height: number };
  webRtcPolicy: WebRtcPolicy;
  canvasMode: CanvasMode;
  webGlVendor: string;
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
  fingerprint: FingerprintSettings;
  startupUrls: string[];
  extensions: string[];
  status: ProfileStatus;
  createdAt: string;
  updatedAt: string;
  lastLaunchedAt?: string;
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

export interface ProxylineSettings {
  apiKey?: string;
  hasApiKey?: boolean;
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
