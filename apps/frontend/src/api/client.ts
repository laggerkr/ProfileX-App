import type { ApiEnvelope, BrowserProfile, DashboardStats, FingerprintSettings, ProxylineSettings, ProxySettings, Role, SmtpSettings, TeamGroup, TeamInvitation, TeamMember, TeamWorkspaceData } from "@profilex/shared";

const apiBase = (window as any).profilex?.apiBaseUrl ?? "/api";

export interface EmailResult {
  sent?: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers
    }
  });
  if (!response.ok) throw new Error(await response.text());
  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
}

export const api = {
  dashboard: () => request<DashboardStats>("/dashboard"),
  profiles: () => request<BrowserProfile[]>("/profiles"),
  createProfile: (profile: Partial<BrowserProfile>) => request<BrowserProfile>("/profiles", { method: "POST", body: JSON.stringify(profile) }),
  updateProfile: (id: string, profile: Partial<BrowserProfile>) => request<BrowserProfile>(`/profiles/${id}`, { method: "PATCH", body: JSON.stringify(profile) }),
  deleteProfile: (id: string) => request<{ deleted: boolean }>(`/profiles/${id}`, { method: "DELETE" }),
  cloneProfile: (id: string) => request<BrowserProfile>(`/profiles/${id}/clone`, { method: "POST" }),
  archiveProfile: (id: string) => request<BrowserProfile>(`/profiles/${id}/archive`, { method: "POST" }),
  launchProfile: (id: string) => request<{ profileId: string }>(`/profiles/${id}/launch`, { method: "POST", body: JSON.stringify({}) }),
  stopProfile: (id: string) => request<{ profileId: string }>(`/profiles/${id}/stop`, { method: "POST" }),
  browserStatus: () => request<{ ok: boolean; engine: string; runningProfiles: number; executablePath?: string; error?: string }>("/browser/status"),
  proxies: () => request<ProxySettings[]>("/proxies"),
  createProxy: (proxy: Omit<ProxySettings, "id" | "status">) => request<ProxySettings>("/proxies", { method: "POST", body: JSON.stringify(proxy) }),
  updateProxy: (id: string, proxy: Partial<ProxySettings>) => request<ProxySettings>(`/proxies/${id}`, { method: "PATCH", body: JSON.stringify(proxy) }),
  deleteProxy: (id: string) => request<{ deleted: boolean }>(`/proxies/${id}`, { method: "DELETE" }),
  importProxies: (text: string) => request<ProxySettings[]>("/proxies/import", { method: "POST", body: JSON.stringify({ text }) }),
  importProxylineProxies: () => request<{ imported: ProxySettings[]; importedCount: number; updatedCount: number }>("/proxies/import/proxyline", { method: "POST" }),
  checkAllProxies: () => request<{ checked: Array<ProxySettings | undefined>; checkedCount: number }>("/proxies/check-all", { method: "POST" }),
  checkProxy: (id: string) => request<ProxySettings>(`/proxies/${id}/check`, { method: "POST" }),
  detectProxyCountry: (id: string) => request<ProxySettings>(`/proxies/${id}/detect-country`, { method: "POST" }),
  randomFingerprint: () => request<FingerprintSettings>("/fingerprints/random", { method: "POST" }),
  team: () => request<TeamWorkspaceData>("/team"),
  createTeamMember: (member: { name: string; email: string; role: Role; groupIds: string[] }) =>
    request<TeamMember & { inviteUrl: string; emailResult?: EmailResult }>("/team/members", { method: "POST", body: JSON.stringify(member) }),
  updateTeamMember: (id: string, member: Partial<TeamMember> & { groupIds?: string[] }) =>
    request<TeamMember>(`/team/members/${id}`, { method: "PATCH", body: JSON.stringify(member) }),
  deleteTeamMember: (id: string) => request<{ deleted: boolean }>(`/team/members/${id}`, { method: "DELETE" }),
  resendTeamInvite: (id: string) => request<TeamInvitation & { emailResult?: EmailResult }>(`/team/members/${id}/resend-invite`, { method: "POST" }),
  createTeamGroup: (group: { name: string; description?: string }) =>
    request<TeamGroup>("/team/groups", { method: "POST", body: JSON.stringify(group) }),
  updateTeamGroup: (id: string, group: Partial<TeamGroup>) => request<TeamGroup>(`/team/groups/${id}`, { method: "PATCH", body: JSON.stringify(group) }),
  deleteTeamGroup: (id: string) => request<{ deleted: boolean }>(`/team/groups/${id}`, { method: "DELETE" }),
  assignProfileGroup: (groupId: string, profileId: string) =>
    request<{ groupId: string; profileId: string }>(`/team/groups/${groupId}/profiles/${profileId}`, { method: "POST" }),
  removeProfileFromGroup: (groupId: string, profileId: string) =>
    request<{ groupId: string; profileId: string }>(`/team/groups/${groupId}/profiles/${profileId}`, { method: "DELETE" }),
  removeMemberFromGroup: (groupId: string, memberId: string) =>
    request<{ groupId: string; memberId: string }>(`/team/groups/${groupId}/members/${memberId}`, { method: "DELETE" }),
  smtpSettings: () => request<SmtpSettings>("/settings/smtp"),
  updateSmtpSettings: (settings: Partial<SmtpSettings>) => request<SmtpSettings>("/settings/smtp", { method: "PATCH", body: JSON.stringify(settings) }),
  proxylineSettings: () => request<ProxylineSettings>("/settings/proxyline"),
  updateProxylineSettings: (settings: Partial<ProxylineSettings>) => request<ProxylineSettings>("/settings/proxyline", { method: "PATCH", body: JSON.stringify(settings) }),
  deleteProxylineSettings: () => request<ProxylineSettings>("/settings/proxyline", { method: "DELETE" }),
  testSmtpSettings: (settings: Partial<SmtpSettings>) => request<{ ok: boolean }>("/settings/smtp/test", { method: "POST", body: JSON.stringify(settings) }),
  logs: () => request<any[]>("/logs"),
  clearLogs: () => request<{ cleared: boolean }>("/logs", { method: "DELETE" }),
  pythonWorkerStatus: () => request<{ ok: boolean; url: string; capabilities: string[]; error?: string }>("/worker/python/status")
};
