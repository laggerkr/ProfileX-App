import { Router } from "express";
import type { AppDatabase } from "./database/db.js";
import { checkProxy, createProxy, deleteProxy, detectProxyCountry, getProxy, importProxyLines, listProxies, updateProxy } from "./services/proxyService.js";
import { assignProfileToUser, cloneProfile, createProfile, deleteProfile, getProfile, getProfileBrowserState, listProfilesForUser, syncProfileState, unassignProfileFromUser, updateProfile } from "./services/profileService.js";
import { realisticFingerprintPreset } from "./services/fingerprintService.js";
import { getPythonWorkerStatus, runPythonPageCheck, runPythonProxyCheck } from "./services/pythonWorkerService.js";
import { acceptTeamInvitation, assignProfileGroup, createTeamGroup, createTeamMember, deleteTeamGroup, deleteTeamMember, getTeamWorkspace, removeMemberFromGroup, removeProfileFromGroup, resendTeamInvitation, updateTeamGroup, updateTeamMember } from "./services/teamService.js";
import { deleteProxylineSettings, getProxylineSettings, getSmtpSettings, updateProxylineSettings, updateSmtpSettings } from "./services/settingsService.js";
import { sendInvitationEmail, testSmtpSettings } from "./services/smtpService.js";
import { getProxylineAccountSummary, importProxylineProxies } from "./services/proxylineService.js";
import { getUserByToken, loginUser, logoutUser, refreshSession, registerUser } from "./services/authService.js";
import { createRdpConnection, deleteRdpConnection, launchRdpConnection, listRdpConnections, updateRdpConnection } from "./services/rdpService.js";
import { autoFixProfileCompatibility, checkProfileCompatibility } from "./services/profileCompatibilityService.js";
import { acquireProfileLock, listActiveSessions, releaseProfileLock } from "./services/profileLockService.js";
import { broadcast, websocketHealth } from "./realtime.js";
import { cacheHealth } from "./cache.js";
import { logError } from "./logger.js";
import { logActivity } from "./services/activityService.js";
import { permissionChecks, requireAuth, requireDesktopClient, requireOrganizationAccess, requirePermission, requireProfileAccess, requireRole } from "./services/permissionService.js";
import { deleteUser, listUsers, updateUser } from "./services/userService.js";
import { acceptInvitation, createInvitation, listInvitations, resendInvitation, revokeInvitation } from "./services/invitationService.js";

export function createRoutes(db:AppDatabase){const router=Router();
router.get('/health',(_q,r)=>r.json({data:{ok:true}})); router.get('/health/db',async(_q,r)=>{try{await db.one('SELECT 1'); return r.json({data:{ok:true}})}catch{return r.status(503).json({data:{ok:false}})}}); router.get('/health/ws',async(_q,r)=>r.json({data:{...websocketHealth(),cache:await cacheHealth()}}));
router.post('/auth/register',async(q,r,next)=>{try{return r.status(201).json({data:await registerUser(db,q.body)})}catch(error){return next(error)}});
router.post('/auth/login',async(q,r,next)=>{try{return r.json({data:await loginUser(db,q.body)})}catch(error){return next(error)}}); router.post('/auth/refresh',async(q,r,next)=>{try{return r.json({data:await refreshSession(db,q.body.refreshToken)})}catch(error){return next(error)}});
router.get('/auth/me',async(q,r)=>{const u=await getUserByToken(db,bearer(q.headers.authorization)); return u?r.json({data:u}):r.status(401).json({error:'Unauthorized'})});
router.post('/auth/logout',async(q,r,next)=>{try{const u=await getUserByToken(db,bearer(q.headers.authorization)); await logoutUser(db,q.body.refreshToken,u?.id); return r.json({data:{loggedOut:true}})}catch(error){return next(error)}});
router.post('/invitations/:token/accept',async(q,r)=>{const x=await acceptInvitation(db,q.params.token,q.body); return x?r.json({data:x}):r.status(404).json({error:'Invitation not found'})});
router.use(requireAuth(db),requireOrganizationAccess());
router.get('/users',requirePermission(db,'users.list',permissionChecks.manageUsers),async(_q,r)=>r.json({data:await listUsers(db,r.locals.authUser.organizationId)}));
router.patch('/users/:id',requirePermission(db,'users.update',permissionChecks.manageUsers),async(q,r)=>{const x=await updateUser(db,r.locals.authUser.organizationId,q.params.id,q.body,r.locals.authUser); return x?r.json({data:x}):r.status(404).json({error:'User not found'})});
router.delete('/users/:id',requirePermission(db,'users.delete',permissionChecks.manageUsers),async(q,r)=>r.json({data:{deleted:await deleteUser(db,r.locals.authUser.organizationId,q.params.id,r.locals.authUser)}}));
router.get('/invitations',requirePermission(db,'invitations.list',permissionChecks.manageUsers),async(_q,r)=>r.json({data:await listInvitations(db,r.locals.authUser.organizationId)}));
router.post('/invitations',requirePermission(db,'invitations.create',permissionChecks.manageUsers),async(q,r)=>r.status(201).json({data:await createInvitation(db,q.body,r.locals.authUser)}));
router.delete('/invitations/:id',requirePermission(db,'invitations.delete',permissionChecks.manageUsers),async(q,r)=>r.json({data:{deleted:await revokeInvitation(db,r.locals.authUser.organizationId,q.params.id,r.locals.authUser.id)}})); router.post('/invitations/:id/resend',requirePermission(db,'invitations.resend',permissionChecks.manageUsers),async(q,r)=>{const x=await resendInvitation(db,r.locals.authUser.organizationId,q.params.id,r.locals.authUser); return x?r.json({data:x}):r.status(404).json({error:'Invitation not found'})});
router.get('/dashboard',async(_q,r)=>{const [profiles,proxies,sessions]=await Promise.all([listProfilesForUser(db,r.locals.authUser),listProxies(db,r.locals.authUser.organizationId),listActiveSessions(db)]); const healthy=proxies.filter(p=>p.status==='healthy').length; const recentLaunches=profiles.filter(p=>p.lastLaunchedAt).sort((a,b)=>String(b.lastLaunchedAt).localeCompare(String(a.lastLaunchedAt))).slice(0,5).map(p=>({profileId:p.id,name:p.name,launchedAt:p.lastLaunchedAt!})); const rows=await db.query<any>(`SELECT to_char(created_at,'YYYY-MM-DD') AS day,COUNT(*)::int AS launches FROM browser_launch_logs WHERE created_at >= now()-interval '6 days' GROUP BY 1`); const map=new Map(rows.map(x=>[x.day,x.launches])); const usage=Array.from({length:7},(_,i)=>{const d=new Date(); d.setDate(d.getDate()-(6-i)); const day=d.toISOString().slice(0,10); return{day:d.toLocaleDateString('en-US',{weekday:'short'}),launches:map.get(day)??0}}); return r.json({data:{profiles:profiles.length,onlineProfiles:sessions.length,proxyHealth:proxies.length?Math.round(healthy/proxies.length*100):100,recentLaunches,usage}})});
router.get('/profiles',async(_q,r)=>r.json({data:await listProfilesForUser(db,r.locals.authUser)}));
router.post('/profiles',requirePermission(db,'profiles.create',permissionChecks.createProfile),async(q,r)=>r.status(201).json({data:await createProfile(db,q.body,r.locals.authUser.id,r.locals.authUser.organizationId)}));
router.use('/profiles/:id', requireProfileAccess(db));
router.get('/profiles/:id',async(q,r)=>{const p=await getProfile(db,q.params.id,r.locals.authUser.organizationId); return p?r.json({data:p}):r.status(404).json({error:'Profile not found'})});
router.get('/profiles/:id/state',async(q,r)=>{const s=await getProfileBrowserState(db,q.params.id); return s?r.json({data:s}):r.status(404).json({error:'Profile not found'})});
router.patch('/profiles/:id',requirePermission(db,'profiles.update',permissionChecks.editProfile),async(q,r)=>{const p=await updateProfile(db,q.params.id,q.body,r.locals.authUser.id); if(!p)return r.status(404).json({error:'Profile not found'}); broadcast('profile.updated',p); return r.json({data:p})});
router.post('/profiles/:id/clone',requirePermission(db,'profiles.clone',permissionChecks.createProfile),async(q,r)=>{const p=await cloneProfile(db,q.params.id,r.locals.authUser.id); return p?r.status(201).json({data:p}):r.status(404).json({error:'Profile not found'})});
router.post('/profiles/:id/archive',requirePermission(db,'profiles.archive',permissionChecks.editProfile),async(q,r)=>r.json({data:await updateProfile(db,q.params.id,{status:'archived'},r.locals.authUser.id)}));
router.post('/profiles/:id/assign',requirePermission(db,'profiles.assign',permissionChecks.editProfile),async(q,r)=>{const x=await assignProfileToUser(db,q.params.id,String(q.body.userId??''),r.locals.authUser.organizationId); return x?r.json({data:x}):r.status(404).json({error:'Profile or user not found'})});
router.delete('/profiles/:id/assign/:userId',requirePermission(db,'profiles.unassign',permissionChecks.editProfile),async(q,r)=>r.json({data:{deleted:await unassignProfileFromUser(db,q.params.id,q.params.userId,r.locals.authUser.organizationId)}}));
router.post('/profiles/:id/sync',async(q,r)=>{try{const x=await syncProfileState(db,q.params.id,q.body,r.locals.authUser.id); if(!x)return r.status(404).json({error:'Profile not found'}); broadcast('profile.synced',x); return r.json({data:x})}catch(error){logError('sync-failed','profile sync failed',error,{profileId:q.params.id,userId:r.locals.authUser.id}); throw error}});
router.post('/profiles/:id/lock',async(q,r)=>{const x=await acquireProfileLock(db,q.params.id,r.locals.authUser,meta(q)); if(!x.acquired)return r.status(409).json({error:'Profile already in use',data:x}); broadcast('profile.locked',{profileId:q.params.id,userId:r.locals.authUser.id}); return r.json({data:x})});
router.post('/profiles/:id/unlock',async(q,r)=>{const x=await releaseProfileLock(db,q.params.id,r.locals.authUser,Boolean(q.body.force&&['owner','admin'].includes(r.locals.authUser.role))); broadcast('profile.unlocked',{profileId:q.params.id}); return r.json({data:x})});
router.post('/profiles/:id/launch',requireDesktopClient(),requirePermission(db,'profiles.launch',permissionChecks.launchProfile),async(q,r)=>{const x=await acquireProfileLock(db,q.params.id,r.locals.authUser,meta(q)); if(!x.acquired)return r.status(409).json({error:'Profile already in use',data:x}); const p=await updateProfile(db,q.params.id,{status:'running',lastLaunchedAt:new Date().toISOString()},r.locals.authUser.id); await logActivity(db,'profile.launched',q.params.id,r.locals.authUser.id); broadcast('profile.locked',{profileId:q.params.id,userId:r.locals.authUser.id}); return r.json({data:{profileId:q.params.id,lock:x,profile:p}})});
router.post('/profiles/:id/stop',requirePermission(db,'profiles.stop',permissionChecks.launchProfile),async(q,r)=>{await releaseProfileLock(db,q.params.id,r.locals.authUser); const p=await updateProfile(db,q.params.id,{status:'ready'},r.locals.authUser.id); await logActivity(db,'profile.stopped',q.params.id,r.locals.authUser.id); broadcast('profile.unlocked',{profileId:q.params.id}); return r.json({data:{profileId:q.params.id,profile:p}})});
router.post('/profiles/:id/compatibility-check',async(q,r)=>{const x=await checkProfileCompatibility(db,q.params.id); return x?r.json({data:x}):r.status(404).json({error:'Profile not found'})}); router.post('/profiles/:id/compatibility-fix',async(q,r)=>{const x=await autoFixProfileCompatibility(db,q.params.id); return x?r.json({data:x}):r.status(404).json({error:'Profile not found'})}); router.delete('/profiles/:id',requirePermission(db,'profiles.delete',permissionChecks.deleteProfile),async(q,r)=>r.json({data:{deleted:await deleteProfile(db,q.params.id,r.locals.authUser.id)}}));
router.get('/rdp',requirePermission(db,'rdp.read',permissionChecks.manageRdp),async(_q,r)=>r.json({data:await listRdpConnections(db)})); router.post('/rdp',requirePermission(db,'rdp.create',permissionChecks.manageRdp),async(q,r)=>r.status(201).json({data:await createRdpConnection(db,q.body)})); router.patch('/rdp/:id',requirePermission(db,'rdp.update',permissionChecks.manageRdp),async(q,r)=>{const x=await updateRdpConnection(db,q.params.id,q.body); return x?r.json({data:x}):r.status(404).json({error:'RDP connection not found'})}); router.delete('/rdp/:id',requirePermission(db,'rdp.delete',permissionChecks.manageRdp),async(q,r)=>r.json({data:{deleted:await deleteRdpConnection(db,q.params.id)}})); router.post('/rdp/:id/launch',requireDesktopClient(),requirePermission(db,'rdp.launch',permissionChecks.manageRdp),async(q,r)=>{const x=await launchRdpConnection(db,q.params.id); return x?r.json({data:x}):r.status(404).json({error:'RDP connection not found'})});
router.get('/proxies', async (_q, r) =>
  r.json({ data: await listProxies(db, r.locals.authUser.organizationId) })
);

router.post('/proxies', requirePermission(db,'proxies.create',permissionChecks.manageProxy), async (q, r) =>
  r.status(201).json({ data: await createProxy(db, q.body, r.locals.authUser.organizationId) })
);

router.delete('/proxies/bulk', requirePermission(db,'proxies.bulk-delete',permissionChecks.manageProxy), async (q, r) => {
  const ids = Array.isArray(q.body.ids) ? q.body.ids : [];

  for (const id of ids) {
    await deleteProxy(db, id);
  }

  r.json({
    data: {
      deleted: ids.length
    }
  });
});

router.delete('/proxies/:id', requirePermission(db,'proxies.delete',permissionChecks.manageProxy), async (q, r) =>
  r.json({ data: { deleted: await deleteProxy(db, q.params.id) } })
);

router.post('/proxies/import', requirePermission(db,'proxies.import',permissionChecks.manageProxy), async (q, r) =>
  r.status(201).json({
    data: await importProxyLines(db, String(q.body.text ?? ''), r.locals.authUser.organizationId)
  })
);

router.post('/proxies/import/proxyline', requirePermission(db,'proxies.import-proxyline',permissionChecks.manageProxy), async (q, r) => {
  const result = await importProxylineProxies(
    db,
    r.locals.authUser.organizationId
  );

  r.json({ data: result });
}); 
router.post('/proxies/bulk', requirePermission(db,'proxies.bulk-create',permissionChecks.manageProxy), async (q, r) => {
  const items = Array.isArray(q.body.items) ? q.body.items : [];

  const created = [];
  for (const item of items) {
    created.push(await createProxy(db, item, r.locals.authUser.organizationId));
  }

  r.status(201).json({
    data: {
      created,
      createdCount: created.length
    }
  });
});
router.post('/proxies/check-all',requirePermission(db,'proxies.check-all',permissionChecks.manageProxy),async(_q,r)=>{const proxies=await listProxies(db,r.locals.authUser.organizationId); const checked=await Promise.all(proxies.map(p=>checkProxy(db,p.id,{detectCountry:false}))); await Promise.all(checked.filter(p=>p&&!p.country).map(p=>detectProxyCountry(db,p!.id).catch(()=>undefined))); const fresh=await listProxies(db,r.locals.authUser.organizationId); return r.json({data:{checked:fresh,checkedCount:fresh.length}})}); router.post('/proxies/:id/check',requirePermission(db,'proxies.check',permissionChecks.manageProxy),async(q,r)=>r.json({data:await checkProxy(db,q.params.id)})); router.post('/proxies/:id/detect-country',requirePermission(db,'proxies.detect-country',permissionChecks.manageProxy),async(q,r)=>{const x=await detectProxyCountry(db,q.params.id); return x?r.json({data:x}):r.status(404).json({error:'Proxy not found'})});
router.post('/fingerprints/random',requirePermission(db,'fingerprints.manage',permissionChecks.manageFingerprints),(_q,r)=>r.json({data:realisticFingerprintPreset(Math.floor(Math.random()*100000))}));
router.get('/team',requirePermission(db,'team.read',permissionChecks.manageGroups),async(_q,r)=>r.json({data:await getTeamWorkspace(db)})); router.post('/team/members',requirePermission(db,'team.members.create',permissionChecks.manageUsers),async(q,r)=>{const m=await createTeamMember(db,q.body); const team=await getTeamWorkspace(db); const inv=team.invitations.find(i=>i.memberId===m.id&&i.status==='pending'); const emailResult=inv?await sendInvitationEmail(db,inv,m.name).catch(e=>({sent:false,error:e instanceof Error?e.message:'Could not send invite email'})):undefined; return r.status(201).json({data:{...m,emailResult}})}); router.patch('/team/members/:id',requirePermission(db,'team.members.update',permissionChecks.manageUsers),async(q,r)=>{const x=await updateTeamMember(db,q.params.id,q.body); return x?r.json({data:x}):r.status(404).json({error:'Member not found'})}); router.delete('/team/members/:id',requirePermission(db,'team.members.delete',permissionChecks.manageUsers),async(q,r)=>r.json({data:{deleted:await deleteTeamMember(db,q.params.id)}})); router.post('/team/members/:id/resend-invite',requirePermission(db,'team.members.resend',permissionChecks.manageUsers),async(q,r)=>{const x=await resendTeamInvitation(db,q.params.id); return x?r.json({data:x}):r.status(404).json({error:'Member not found'})}); router.post('/team/invitations/:token/accept',async(q,r)=>{const x=await acceptTeamInvitation(db,q.params.token); return x?r.json({data:x}):r.status(404).json({error:'Invitation not found'})}); router.get('/profile-groups',requirePermission(db,'groups.read',permissionChecks.manageGroups),async(_q,r)=>r.json({data:(await getTeamWorkspace(db)).groups})); router.post('/profile-groups',requirePermission(db,'groups.create',permissionChecks.manageGroups),async(q,r)=>r.status(201).json({data:await createTeamGroup(db,q.body)})); router.post('/team/groups',requirePermission(db,'groups.create',permissionChecks.manageGroups),async(q,r)=>r.status(201).json({data:await createTeamGroup(db,q.body)})); router.patch('/team/groups/:id',requirePermission(db,'groups.update',permissionChecks.manageGroups),async(q,r)=>{const x=await updateTeamGroup(db,q.params.id,q.body); return x?r.json({data:x}):r.status(404).json({error:'Group not found'})}); router.delete('/team/groups/:id',requirePermission(db,'groups.delete',permissionChecks.manageGroups),async(q,r)=>r.json({data:{deleted:await deleteTeamGroup(db,q.params.id)}})); router.post('/team/groups/:id/profiles/:profileId',requirePermission(db,'groups.assign-profile',permissionChecks.manageGroups),async(q,r)=>{const x=await assignProfileGroup(db,q.params.profileId,q.params.id); return x?r.json({data:x}):r.status(404).json({error:'Group or profile not found'})}); router.delete('/team/groups/:id/profiles/:profileId',requirePermission(db,'groups.remove-profile',permissionChecks.manageGroups),async(q,r)=>{const x=await removeProfileFromGroup(db,q.params.profileId,q.params.id); return x?r.json({data:x}):r.status(404).json({error:'Group or profile not found'})}); router.delete('/team/groups/:id/members/:memberId',requirePermission(db,'groups.remove-member',permissionChecks.manageGroups),async(q,r)=>{const x=await removeMemberFromGroup(db,q.params.memberId,q.params.id); return x?r.json({data:x}):r.status(404).json({error:'Group or member not found'})});
router.get('/logs',requireRole('owner','admin','manager'),async(q,r)=>{const where:string[]=[],params:any[]=[]; if(q.query.user){params.push(String(q.query.user)); where.push(`(a.actor_id=$${params.length} OR u.email ILIKE '%' || $${params.length} || '%')`)} if(q.query.action){params.push(String(q.query.action)); where.push(`a.action=$${params.length}`)} if(q.query.role){params.push(String(q.query.role)); where.push(`om.role=$${params.length}`)} if(q.query.date){params.push(String(q.query.date)); where.push(`a.created_at::date=$${params.length}::date`)} const sql=`SELECT a.*,u.name AS actor_name,u.email AS actor_email,om.role AS actor_role FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id LEFT JOIN organization_members om ON om.user_id=u.id AND om.organization_id=$${params.length+1} ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY a.created_at DESC LIMIT 200`; params.push(r.locals.authUser.organizationId); return r.json({data:await db.query(sql,params)})}); router.delete('/logs',requireRole('owner','admin'),async(_q,r)=>{await db.exec('DELETE FROM audit_logs'); return r.json({data:{cleared:true}})});
router.get('/settings/smtp',requirePermission(db,'settings.read',permissionChecks.settings),async(_q,r)=>r.json({data:await getSmtpSettings(db)})); router.patch('/settings/smtp',requirePermission(db,'settings.update',permissionChecks.settings),async(q,r)=>r.json({data:await updateSmtpSettings(db,q.body)})); router.get('/settings/proxyline',requirePermission(db,'settings.read',permissionChecks.settings),async(_q,r)=>r.json({data:await getProxylineAccountSummary(db)})); router.patch('/settings/proxyline',requirePermission(db,'settings.update',permissionChecks.settings),async(q,r)=>r.json({data:await updateProxylineSettings(db,q.body)})); router.delete('/settings/proxyline',requirePermission(db,'settings.update',permissionChecks.settings),async(_q,r)=>r.json({data:await deleteProxylineSettings(db)})); router.post('/settings/smtp/test',requirePermission(db,'settings.update',permissionChecks.settings),async(q,r)=>{const settings={...(await getSmtpSettings(db,{includePassword:true})),...q.body}; return r.json({data:await testSmtpSettings(settings)})});
router.get('/worker/python/status',requirePermission(db,'automation.read',permissionChecks.automation),async(_q,r)=>r.json({data:await getPythonWorkerStatus()})); router.post('/worker/python/proxy-check',requirePermission(db,'automation.use',permissionChecks.automation),async(q,r)=>r.json({data:await runPythonProxyCheck(String(q.body.host),Number(q.body.port))})); router.post('/worker/python/page-check',requirePermission(db,'automation.use',permissionChecks.automation),async(q,r)=>r.json({data:await runPythonPageCheck(q.body)})); router.get('/browser/status', async (_q, r) => {
  return r.json({
    data: {
      running: false,
      profiles: 0
    }
  });
});

return router}
function bearer(h?:string){return h?.startsWith('Bearer ')?h.slice(7).trim():undefined} function meta(q:any){return{deviceId:String(q.headers['x-device-id']??'' )||undefined,ipAddress:q.ip,userAgent:q.headers['user-agent']}}
