import { Router } from "express";
import { getBrowserEngineStatus, launchProfile, listRunningProfiles, stopProfile } from "@profilex/browser-engine";
import { DATA_ROOT } from "./config.js";
import type { AppDatabase } from "./database/db.js";
import { checkProxy, createProxy, deleteProxy, detectProxyCountry, getProxy, importProxyLines, listProxies, updateProxy } from "./services/proxyService.js";
import { cloneProfile, createProfile, deleteProfile, getProfile, listProfiles, updateProfile } from "./services/profileService.js";
import { realisticFingerprintPreset } from "./services/fingerprintService.js";
import { logActivity } from "./services/activityService.js";
import { getPythonWorkerStatus, runPythonPageCheck, runPythonProxyCheck } from "./services/pythonWorkerService.js";
import { acceptTeamInvitation, assignProfileGroup, createTeamGroup, createTeamMember, deleteTeamGroup, deleteTeamMember, getTeamWorkspace, resendTeamInvitation, updateTeamGroup, updateTeamMember } from "./services/teamService.js";
import { getProxylineSettings, getSmtpSettings, updateProxylineSettings, updateSmtpSettings } from "./services/settingsService.js";
import { sendInvitationEmail, testSmtpSettings } from "./services/smtpService.js";
import { importProxylineProxies } from "./services/proxylineService.js";
import type { ProxySettings } from "@profilex/shared";

export function createRoutes(db: AppDatabase) {
  const router = Router();

  router.get("/health", (_req, res) => res.json({ data: { ok: true } }));
  router.get("/browser/status", async (_req, res) => res.json({ data: await getBrowserEngineStatus() }));

  router.get("/dashboard", (_req, res) => {
    syncProfileRuntimeStatuses(db);
    const profiles = listProfiles(db);
    const proxies = listProxies(db);
    const healthy = proxies.filter((proxy) => proxy.status === "healthy").length;
    const recentLaunches = profiles
      .filter((profile) => profile.lastLaunchedAt)
      .slice(0, 5)
      .map((profile) => ({ profileId: profile.id, name: profile.name, launchedAt: profile.lastLaunchedAt! }));
    res.json({
      data: {
        profiles: profiles.length,
        onlineProfiles: listRunningProfiles().length,
        proxyHealth: proxies.length ? Math.round((healthy / proxies.length) * 100) : 100,
        recentLaunches,
        usage: Array.from({ length: 7 }, (_, index) => ({ day: `D-${6 - index}`, launches: Math.max(0, profiles.length - index) }))
      }
    });
  });

  router.get("/profiles", (_req, res) => {
    syncProfileRuntimeStatuses(db);
    res.json({ data: listProfiles(db) });
  });
  router.post("/profiles", (req, res) => res.status(201).json({ data: createProfile(db, req.body) }));
  router.get("/profiles/:id", (req, res) => {
    const profile = getProfile(db, req.params.id);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    return res.json({ data: profile });
  });
  router.patch("/profiles/:id", (req, res) => {
    const profile = updateProfile(db, req.params.id, req.body);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    return res.json({ data: profile });
  });
  router.post("/profiles/:id/clone", (req, res) => {
    const profile = cloneProfile(db, req.params.id);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    return res.status(201).json({ data: profile });
  });
  router.post("/profiles/:id/archive", (req, res) => res.json({ data: updateProfile(db, req.params.id, { status: "archived" }) }));
  router.delete("/profiles/:id", (req, res) => res.json({ data: { deleted: deleteProfile(db, req.params.id) } }));

  router.post("/profiles/:id/launch", async (req, res, next) => {
    try {
      const profile = getProfile(db, req.params.id);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const result = await launchProfile({ profile, proxy: resolveLaunchProxy(db, profile.proxyId, profile.proxyProtocol), request: { profileId: profile.id, ...req.body }, dataRoot: DATA_ROOT });
      updateProfile(db, profile.id, { status: "running", lastLaunchedAt: new Date().toISOString() });
      logActivity(db, "profile.launched", profile.name);
      return res.json({ data: result });
    } catch (error) {
      return next(error);
    }
  });
  router.post("/profiles/:id/stop", async (req, res, next) => {
    try {
      const result = await stopProfile(req.params.id);
      updateProfile(db, req.params.id, { status: "ready" });
      return res.json({ data: result });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/proxies", (_req, res) => res.json({ data: listProxies(db) }));
  router.post("/proxies", (req, res) => res.status(201).json({ data: createProxy(db, req.body) }));
  router.patch("/proxies/:id", (req, res) => {
    const proxy = updateProxy(db, req.params.id, req.body);
    if (!proxy) return res.status(404).json({ error: "Proxy not found" });
    return res.json({ data: proxy });
  });
  router.delete("/proxies/:id", (req, res) => res.json({ data: { deleted: deleteProxy(db, req.params.id) } }));
  router.post("/proxies/import", (req, res) => res.status(201).json({ data: importProxyLines(db, String(req.body.text ?? "")) }));
  router.post("/proxies/import/proxyline", async (_req, res, next) => {
    try {
      return res.status(201).json({ data: await importProxylineProxies(db) });
    } catch (error) {
      return next(error);
    }
  });
  router.post("/proxies/check-all", async (_req, res) => {
    const checked = [];
    for (const proxy of listProxies(db)) {
      checked.push(await checkProxy(db, proxy.id));
    }
    return res.json({ data: { checked, checkedCount: checked.length } });
  });
  router.post("/proxies/:id/check", async (req, res) => res.json({ data: await checkProxy(db, req.params.id) }));
  router.post("/proxies/:id/detect-country", async (req, res) => {
    const proxy = await detectProxyCountry(db, req.params.id);
    if (!proxy) return res.status(404).json({ error: "Proxy not found" });
    return res.json({ data: proxy });
  });

  router.post("/fingerprints/random", (_req, res) => res.json({ data: realisticFingerprintPreset(Math.floor(Math.random() * 100000)) }));
  router.get("/team", (_req, res) => res.json({ data: getTeamWorkspace(db) }));
  router.post("/team/members", async (req, res, next) => {
    try {
      const member = createTeamMember(db, req.body);
      const invite = getTeamWorkspace(db).invitations.find((item) => item.memberId === member.id && item.status === "pending");
      let emailResult: unknown = undefined;
      if (invite) {
        emailResult = await sendInvitationEmail(db, invite, member.name).catch((error) => ({
          sent: false,
          error: error instanceof Error ? error.message : "Could not send invite email"
        }));
      }
      return res.status(201).json({ data: { ...member, emailResult } });
    } catch (error) {
      return next(error);
    }
  });
  router.patch("/team/members/:id", (req, res) => {
    const member = updateTeamMember(db, req.params.id, req.body);
    if (!member) return res.status(404).json({ error: "Member not found" });
    return res.json({ data: member });
  });
  router.delete("/team/members/:id", (req, res) => res.json({ data: { deleted: deleteTeamMember(db, req.params.id) } }));
  router.post("/team/members/:id/resend-invite", async (req, res) => {
    const invitation = resendTeamInvitation(db, req.params.id);
    if (!invitation) return res.status(404).json({ error: "Member not found" });
    const member = getTeamWorkspace(db).members.find((item) => item.id === req.params.id);
    const emailResult = member
      ? await sendInvitationEmail(db, invitation, member.name).catch((error) => ({
          sent: false,
          error: error instanceof Error ? error.message : "Could not send invite email"
        }))
      : undefined;
    return res.json({ data: { ...invitation, emailResult } });
  });
  router.post("/team/invitations/:token/accept", (req, res) => {
    const invitation = acceptTeamInvitation(db, req.params.token);
    if (!invitation) return res.status(404).json({ error: "Invitation not found" });
    return res.json({ data: invitation });
  });
  router.post("/team/groups", (req, res) => res.status(201).json({ data: createTeamGroup(db, req.body) }));
  router.patch("/team/groups/:id", (req, res) => {
    const group = updateTeamGroup(db, req.params.id, req.body);
    if (!group) return res.status(404).json({ error: "Group not found" });
    return res.json({ data: group });
  });
  router.delete("/team/groups/:id", (req, res) => res.json({ data: { deleted: deleteTeamGroup(db, req.params.id) } }));
  router.post("/team/groups/:id/profiles/:profileId", (req, res) => {
    const assignment = assignProfileGroup(db, req.params.profileId, req.params.id);
    if (!assignment) return res.status(404).json({ error: "Group or profile not found" });
    return res.json({ data: assignment });
  });
  router.get("/logs", (_req, res) => res.json({ data: db.prepare("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100").all() }));

  router.get("/settings/smtp", (_req, res) => res.json({ data: getSmtpSettings(db) }));
  router.patch("/settings/smtp", (req, res) => res.json({ data: updateSmtpSettings(db, req.body) }));
  router.get("/settings/proxyline", (_req, res) => res.json({ data: getProxylineSettings(db) }));
  router.patch("/settings/proxyline", (req, res) => res.json({ data: updateProxylineSettings(db, req.body) }));
  router.post("/settings/smtp/test", async (req, res, next) => {
    try {
      const settings = { ...getSmtpSettings(db, { includePassword: true }), ...req.body };
      return res.json({ data: await testSmtpSettings(settings) });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/cookies/export", (_req, res) => res.json({ data: { message: "Cookie export is available through launched Playwright contexts in the profile runtime." } }));
  router.post("/cookies/import", (_req, res) => res.json({ data: { imported: true } }));

  router.get("/worker/python/status", async (_req, res) => {
    res.json({ data: await getPythonWorkerStatus() });
  });
  router.post("/worker/python/proxy-check", async (req, res, next) => {
    try {
      res.json({ data: await runPythonProxyCheck(String(req.body.host), Number(req.body.port)) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/worker/python/page-check", async (req, res, next) => {
    try {
      res.json({ data: await runPythonPageCheck(req.body) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function resolveLaunchProxy(db: AppDatabase, proxyId?: string, protocol: ProxySettings["protocol"] = "http"): ProxySettings | undefined {
  const proxy = getProxy(db, proxyId);
  if (!proxy) return undefined;
  const port = protocol === "socks5" ? proxy.socks5Port : proxy.httpPort;
  if (!port) throw new Error(`${protocol.toUpperCase()} port is not configured for this proxy.`);
  const resolved = { ...proxy, protocol, port };
  const hasCredentials = Boolean(resolved.username || resolved.password);
  if (resolved.protocol === "socks5" && hasCredentials) {
    throw new Error("Chromium does not support SOCKS5 proxy authentication. Select HTTP for authenticated proxy sessions.");
  }
  return resolved;
}
function syncProfileRuntimeStatuses(db: AppDatabase) {
  const runningIds = new Set(listRunningProfiles().map((profile) => profile.id));
  for (const profile of listProfiles(db)) {
    if (profile.status === "running" && !runningIds.has(profile.id)) {
      updateProfile(db, profile.id, { status: "ready" });
    }
  }
}
