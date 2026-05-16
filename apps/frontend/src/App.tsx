import type { AuthUser, BrowserProfile, FingerprintSettings, ProfileCompatibilityCheck, ProxylineSettings, ProxySettings, RdpConnection, Role, SmtpSettings, TeamWorkspaceData } from "@profilex/shared";
import { Activity, Apple, Chrome, Copy, Database, Fingerprint, FolderKanban, Globe2, KeyRound, Monitor, Moon, Pencil, Play, Plus, RefreshCcw, Shield, Smartphone, Square, Sun, Terminal, Trash2, Upload, UserPlus, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./components/Button";
import { Shell } from "./components/Shell";
import { StatCard } from "./components/StatCard";
import { api, setAuthToken, type EmailResult } from "./api/client";
import { useWorkspaceStore } from "./store/useWorkspaceStore";

export function App() {
  const { activePage, refresh } = useWorkspaceStore();
  const [isLocked, setLocked] = useState(() => getAppLockSettings().enabled);
  const authUser = getLocalWorkspaceUser();
  useTheme();

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  if (isLocked) return <AppLockGate onUnlock={() => setLocked(false)} />;

  return (
    <Shell currentUser={authUser} onLogout={() => undefined}>
      <div className="screen-enter">
        {activePage === "Dashboard" && <Dashboard />}
        {activePage === "Profiles" && <Profiles />}
        {activePage === "RDP" && <RdpPage />}
        {activePage === "Proxy Manager" && <ProxyManager />}
        {activePage === "Fingerprints" && <Fingerprints />}
        {activePage === "Groups" && <GroupsPage />}
        {activePage === "Members" && <MembersPage />}
        {activePage === "Logs" && <Logs />}
        {activePage === "Automation API" && <AutomationApi />}
        {activePage === "Settings" && <Settings />}
        {activePage === "Login Page" && <LoginPage />}
        {activePage === "Recovery" && <Recovery />}
      </div>
    </Shell>
  );
}

function Dashboard() {
  const { dashboard, refresh } = useWorkspaceStore();
  const [browserStatus, setBrowserStatus] = useState<any>();
  const usage = dashboard?.usage ?? [];
  const maxLaunches = Math.max(1, ...usage.map((item) => item.launches));
  const refreshDashboard = async () => {
    await Promise.all([refresh(), api.browserStatus().then(setBrowserStatus)]);
  };
  useEffect(() => { void api.browserStatus().then(setBrowserStatus); }, []);
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <Button icon={<RefreshCcw size={16} />} onClick={() => void refreshDashboard()}>Refresh</Button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Profiles" value={dashboard?.profiles ?? 0} icon={<Database size={18} />} />
        <StatCard label="Online profiles" value={dashboard?.onlineProfiles ?? 0} icon={<Activity size={18} />} />
        <StatCard label="Proxy health" value={`${dashboard?.proxyHealth ?? 100}%`} icon={<Shield size={18} />} />
        <StatCard label="Team members" value="1" icon={<Users size={18} />} />
      </div>
      <div className="grid grid-cols-[1.2fr_0.8fr] gap-4">
        <Panel title="Launches over last 7 days">
          <div className="grid h-60 grid-cols-[32px_1fr] gap-3">
            <div className="flex flex-col justify-between pb-7 text-right text-xs text-gray-500">
              <span>{maxLaunches}</span>
              <span>{Math.ceil(maxLaunches / 2)}</span>
              <span>0</span>
            </div>
            <div className="relative flex items-end gap-3 border-b border-line pb-7 dark:border-white/10">
              <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line dark:border-white/10" />
              <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-line dark:border-white/10" />
              {usage.map((item) => (
                <div key={item.day} className="relative flex h-full flex-1 flex-col justify-end">
                  <span className="mb-2 text-center text-xs font-medium">{item.launches}</span>
                  <div className="rounded-t-lg bg-brand/80" style={{ height: `${Math.max(8, (item.launches / maxLaunches) * 100)}%` }} />
                  <span className="absolute -bottom-6 w-full text-center text-xs text-gray-500">{item.day}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
        <Panel title="Recent launches">
          <div className="space-y-3">
            {(dashboard?.recentLaunches.length ? dashboard.recentLaunches : [{ profileId: "empty", name: "No launches yet", launchedAt: "" }]).map((item) => (
              <div key={item.profileId} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm dark:bg-[#202328]">
                <span>{item.name}</span>
                <span className="text-xs text-gray-500">{item.launchedAt ? new Date(item.launchedAt).toLocaleString() : "Ready"}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Installed browser runtimes">
        <div className="grid grid-cols-3 gap-3 text-sm">
          {(browserStatus?.engines ?? []).map((engine: any) => (
            <div key={engine.id} className="rounded-lg bg-gray-50 p-3 dark:bg-[#202328]">
              <div className="text-xs text-gray-500">{engine.id === "firefox" ? "Stealthfox" : "Mimic"}</div>
              <div className={engine.ok ? "font-medium text-emerald-600" : "font-medium text-rose-500"}>{engine.ok ? "Ready" : "Missing"}</div>
            </div>
          ))}
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-[#202328]">
            <div className="text-xs text-gray-500">Running browser sessions</div>
            <div className="font-medium">{browserStatus?.runningProfiles ?? 0}</div>
          </div>
        </div>
      </Panel>
    </section>
  );
}

function Profiles() {
  const { profiles, proxies, createProfile, updateProfile, deleteProfile, launchProfile, stopProfile, cloneProfile } = useWorkspaceStore();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [createStorageMode, setCreateStorageMode] = useState<BrowserProfile["storageMode"]>("device");
  const [editingProfile, setEditingProfile] = useState<BrowserProfile>();
  const [cloningProfile, setCloningProfile] = useState<BrowserProfile>();
  const [editingNotesProfile, setEditingNotesProfile] = useState<BrowserProfile>();
  const [editingTagsProfile, setEditingTagsProfile] = useState<BrowserProfile>();
  const [compatibilityProfile, setCompatibilityProfile] = useState<BrowserProfile>();
  const [compatibilityResult, setCompatibilityResult] = useState<ProfileCompatibilityCheck>();
  const [compatibilityLoading, setCompatibilityLoading] = useState(false);
  const [teamGroups, setTeamGroups] = useState<Array<{ value: string; label: string }>>([{ value: "Default", label: "Default" }]);
  const proxyById = useMemo(() => new Map(proxies.map((proxy) => [proxy.id, proxy])), [proxies]);
  useEffect(() => {
    void api.team().then((team) => setTeamGroups(team.groups.map((group) => ({ value: group.name, label: group.name }))));
  }, []);
  useEffect(() => {
    if (editingProfile && !profiles.some((profile) => profile.id === editingProfile.id)) {
      setEditingProfile(undefined);
    }
  }, [editingProfile, profiles]);
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Profiles</h1>
        <div className="flex gap-2">
          <Button icon={<Plus size={16} />} onClick={() => { setCreateStorageMode("device"); setCreateOpen(true); }}>New local profile</Button>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => { setCreateStorageMode("cloud"); setCreateOpen(true); }}>New cloud profile</Button>
        </div>
      </div>
      {isCreateOpen && (
        <ProfileEditorDialog
          mode="create"
          initialStorageMode={createStorageMode}
          proxies={proxies}
          groupOptions={teamGroups}
          onClose={() => setCreateOpen(false)}
          onSave={async (profile) => {
            await createProfile(profile);
            setCreateOpen(false);
          }}
        />
      )}
      {editingProfile && (
        <ProfileEditorDialog
          mode="edit"
          profile={editingProfile}
          proxies={proxies}
          groupOptions={teamGroups}
          onClose={() => setEditingProfile(undefined)}
          onSave={async (profile) => {
            await updateProfile(editingProfile.id, profile);
            setEditingProfile(undefined);
          }}
        />
      )}
      {editingNotesProfile && (
        <InlineProfileNotesDialog
          profile={editingNotesProfile}
          onClose={() => setEditingNotesProfile(undefined)}
          onSave={async (notes) => {
            await updateProfile(editingNotesProfile.id, { notes });
            setEditingNotesProfile(undefined);
          }}
        />
      )}
      {cloningProfile && (
        <CloneProfileToGroupDialog
          profile={cloningProfile}
          groupOptions={teamGroups}
          onClose={() => setCloningProfile(undefined)}
          onSave={async (group) => {
            await createProfile({ ...cloningProfile, name: `${cloningProfile.name} Copy`, group });
            setCloningProfile(undefined);
          }}
        />
      )}
      {compatibilityProfile && (
        <ProfileCompatibilityDialog
          profile={compatibilityProfile}
          result={compatibilityResult}
          loading={compatibilityLoading}
          onClose={() => { setCompatibilityProfile(undefined); setCompatibilityResult(undefined); }}
        />
      )}
      {editingTagsProfile && (
        <InlineProfileTagsDialog
          profile={editingTagsProfile}
          onClose={() => setEditingTagsProfile(undefined)}
          onSave={async (tags) => {
            await updateProfile(editingTagsProfile.id, { tags });
            setEditingTagsProfile(undefined);
          }}
        />
      )}
      <div className="overflow-hidden rounded-lg border border-line bg-white dark:border-white/10 dark:bg-[#17191c]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-[#202328]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Group</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3">Tags</th>
              <th className="px-4 py-3">Browser</th>
              <th className="px-4 py-3">OS</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id} className="border-t border-line dark:border-white/10">
                <td className="px-4 py-3">
                  <div className="font-medium">{profile.name}</div>
                </td>
                <td className="px-4 py-3">{profile.group}</td>
                <td className="px-4 py-3">
                  <button className="group flex max-w-[180px] items-center gap-2 text-left" onClick={() => setEditingNotesProfile(profile)}>
                    <span className="truncate text-gray-500">{profile.notes || "-"}</span>
                    <Pencil size={13} className="shrink-0 text-gray-400 opacity-0 transition group-hover:opacity-100" />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button className="group flex items-center gap-2 text-left" onClick={() => setEditingTagsProfile(profile)}>
                    <span className="flex flex-wrap gap-1">
                      {profile.tags.length ? profile.tags.map((tag) => (
                        <span key={tag} className="rounded-lg bg-brand/10 px-2 py-1 text-xs text-brand">{tag}</span>
                      )) : <span className="text-gray-400">-</span>}
                    </span>
                    <Pencil size={13} className="shrink-0 text-gray-400 opacity-0 transition group-hover:opacity-100" />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-lg bg-gray-100 p-2 dark:bg-white/10" title={(profile.browserEngine ?? "chromium") === "firefox" ? "Stealthfox" : "Mimic"}>
                    {(profile.browserEngine ?? "chromium") === "firefox" ? <Globe2 size={16} /> : <Chrome size={16} />}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-lg bg-gray-100 p-2 dark:bg-white/10" title={profile.operatingSystem ?? "windows"}>
                    <ProfileOsIcon operatingSystem={profile.operatingSystem} />
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs dark:bg-white/10">{profile.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {profile.status === "running" ? (
                      <Button icon={<Square size={15} />} onClick={() => void stopProfile(profile.id)} />
                    ) : (
                      <Button
                        icon={<Play size={15} />}
                        onClick={() =>
                          void launchProfile(profile.id).catch((error) => {
                            alert(error instanceof Error ? error.message : "Could not launch profile");
                          })
                        }
                      />
                    )}
                    <Button
                      icon={<Shield size={15} />}
                      title="Check compatibility"
                      onClick={() => {
                        setCompatibilityProfile(profile);
                        setCompatibilityResult(undefined);
                        setCompatibilityLoading(true);
                        void api.checkProfileCompatibility(profile.id)
                          .then(setCompatibilityResult)
                          .catch((error) => alert(normalizeApiError(error)))
                          .finally(() => setCompatibilityLoading(false));
                      }}
                    />
                    <Button icon={<Copy size={15} />} onClick={() => void cloneProfile(profile.id)} />
                    <Button icon={<FolderKanban size={15} />} title="Clone to group" onClick={() => setCloningProfile(profile)} />
                    <Button icon={<Pencil size={15} />} onClick={() => setEditingProfile(profile)} />
                    <Button
                      icon={<Trash2 size={15} />}
                      onClick={() => {
                        if (confirm(`Delete profile "${profile.name}"? This cannot be undone.`)) {
                          void deleteProfile(profile.id);
                        }
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}


function ProfileCompatibilityDialog({ profile, result, loading, onClose }: { profile: BrowserProfile; result?: ProfileCompatibilityCheck; loading: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-line bg-white shadow-soft dark:border-white/10 dark:bg-[#17191c]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4 dark:border-white/10">
          <div>
            <div className="text-lg font-semibold">Compatibility check</div>
            <div className="text-sm text-gray-500">{profile.name}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                void api.autoFixProfileCompatibility(profile.id)
                  .then(setCompatibilityResult)
                  .catch((error) => alert(normalizeApiError(error)));
              }}
            >
              Auto-fix
            </Button>
            <button onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div className="p-5">
          {loading && <div className="text-sm text-gray-500">Checking profile...</div>}
          {result && (
            <>
              <div className="mb-4 flex items-center justify-between rounded-xl bg-gray-50 p-4 dark:bg-[#202328]">
                <div>
                  <div className="text-sm text-gray-500">Profile score</div>
                  <div className="text-2xl font-semibold">{result.score}/100</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${result.status === "good" ? "bg-emerald-100 text-emerald-700" : result.status === "warning" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{result.status}</span>
              </div>
              <div className="space-y-2">
                {result.checks.map((check) => (
                  <div key={check.key} className="flex items-start justify-between gap-3 rounded-lg border border-line p-3 text-sm dark:border-white/10">
                    <div>
                      <div className="font-medium">{check.label}</div>
                      <div className="text-gray-500">{check.detail}</div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs ${check.status === "pass" ? "bg-emerald-100 text-emerald-700" : check.status === "warning" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{check.status}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-gray-500">This is a preflight check of local profile settings and proxy health. It cannot guarantee how a specific site will score the session.</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileOsIcon({ operatingSystem }: { operatingSystem?: BrowserProfile["operatingSystem"] }) {
  if (operatingSystem === "macos") return <Apple size={16} />;
  if (operatingSystem === "linux") return <Terminal size={16} />;
  if (operatingSystem === "android") return <Smartphone size={16} />;
  return <Monitor size={16} />;
}

function CloneProfileToGroupDialog({
  profile,
  groupOptions,
  onClose,
  onSave
}: {
  profile: BrowserProfile;
  groupOptions: Array<{ value: string; label: string }>;
  onClose: () => void;
  onSave: (group: string) => Promise<void>;
}) {
  const [group, setGroup] = useState(profile.group);
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-[#17191c]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Clone to group</h2>
            <p className="text-sm text-gray-500">Create a copy of {profile.name} in another group.</p>
          </div>
          <Button variant="ghost" icon={<X size={17} />} onClick={onClose} />
        </div>
        <SelectInput label="Target group" value={group} onChange={setGroup} options={groupOptions} />
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={saving} onClick={() => { setSaving(true); void onSave(group).finally(() => setSaving(false)); }}>{saving ? "Cloning..." : "Clone"}</Button>
        </div>
      </div>
    </div>
  );
}

function InlineProfileNotesDialog({
  profile,
  onClose,
  onSave
}: {
  profile: BrowserProfile;
  onClose: () => void;
  onSave: (notes?: string) => Promise<void>;
}) {
  const [value, setValue] = useState(profile.notes ?? "");
  return (
    <InlineProfileEditDialog title={`Notes ? ${profile.name}`} onClose={onClose} onSave={() => onSave(value.trim() || undefined)}>
      <TextArea label="Notes" value={value} onChange={setValue} placeholder="Add notes" />
    </InlineProfileEditDialog>
  );
}

function InlineProfileTagsDialog({
  profile,
  onClose,
  onSave
}: {
  profile: BrowserProfile;
  onClose: () => void;
  onSave: (tags: string[]) => Promise<void>;
}) {
  const [value, setValue] = useState(profile.tags.join(", "));
  return (
    <InlineProfileEditDialog title={`Tags ? ${profile.name}`} onClose={onClose} onSave={() => onSave(splitList(value))}>
      <TextInput label="Tags" value={value} onChange={setValue} placeholder="LV, WT-Admin, support" autoFocus />
    </InlineProfileEditDialog>
  );
}

function InlineProfileEditDialog({
  title,
  children,
  onClose,
  onSave
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-[#17191c]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button variant="ghost" icon={<X size={17} />} onClick={onClose} />
        </div>
        {children}
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={saving}
            onClick={() => {
              setSaving(true);
              void onSave().finally(() => setSaving(false));
            }}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProfileEditorDialog({
  mode,
  profile,
  proxies,
  groupOptions,
  initialStorageMode,
  onClose,
  onSave
}: {
  mode: "create" | "edit";
  profile?: BrowserProfile;
  proxies: ProxySettings[];
  groupOptions: Array<{ value: string; label: string }>;
  initialStorageMode?: BrowserProfile["storageMode"];
  onClose: () => void;
  onSave: (profile: Partial<BrowserProfile>) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [detectedProxyCountries, setDetectedProxyCountries] = useState<Record<string, Pick<ProxySettings, "country" | "countryCode">>>({});
  const [form, setForm] = useState({
    name: profile?.name ?? "",
    group: profile?.group ?? "QA",
    tags: profile?.tags.join(", ") ?? "qa, internal",
    notes: profile?.notes ?? "",
    proxyId: profile?.proxyId ?? "",
    proxyProtocol: profile?.proxyProtocol ?? "http",
    tabBehavior: profile?.tabBehavior ?? "custom",
    operatingSystem: profile?.operatingSystem ?? "windows",
    browserEngine: profile?.browserEngine ?? "chromium",
    storageMode: profile?.storageMode ?? initialStorageMode ?? "device",
    startupUrls: profile?.startupUrls.join("\n") ?? "https://browserleaks.com/ip",
    userAgent: profile?.fingerprint.userAgent ?? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    timezoneMode: profile?.fingerprint.timezoneMode ?? "mask",
    timezone: profile?.fingerprint.timezone ?? "Europe/Kyiv",
    geolocationAccess: profile?.fingerprint.geolocationAccess ?? "ask",
    geolocationMode: profile?.fingerprint.geolocationMode ?? "mask",
    latitude: String(profile?.fingerprint.geolocation?.latitude ?? ""),
    longitude: String(profile?.fingerprint.geolocation?.longitude ?? ""),
    languageMode: profile?.fingerprint.languageMode ?? "mask",
    language: profile?.fingerprint.language ?? "en-US",
    screenMode: profile?.fingerprint.screenMode ?? "mask",
    webRtcPolicy: profile?.fingerprint.webRtcPolicy ?? "company-network-only",
    navigatorMode: profile?.fingerprint.navigatorMode ?? "mask",
    platform: profile?.fingerprint.platform ?? "Win32",
    hardwareConcurrency: String(profile?.fingerprint.hardwareConcurrency ?? 8),
    osCpu: profile?.fingerprint.osCpu ?? "",
    webGlMode: profile?.fingerprint.webGlMode ?? "mask",
    webGlVendor: profile?.fingerprint.webGlVendor ?? "Google Inc. (Intel)",
    webGlRenderer: profile?.fingerprint.webGlRenderer ?? "ANGLE (Intel, Intel(R) UHD Graphics)",
    webGpuVendorId: profile?.fingerprint.webGpuVendorId ?? "",
    webGpuDeviceId: profile?.fingerprint.webGpuDeviceId ?? "",
    width: String(profile?.fingerprint.screen.width ?? 1440),
    height: String(profile?.fingerprint.screen.height ?? 900)
  });
  const [newProxy, setNewProxy] = useState({
    host: "",
    httpPort: "",
    socks5Port: "",
    username: "",
    password: "",
    group: "Profile proxies"
  });
  const [selectedProxyCredentials, setSelectedProxyCredentials] = useState({ username: "", password: "" });

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const updateOperatingSystem = (value: string) => {
    const preset = getOperatingSystemPreset(value as BrowserProfile["operatingSystem"]);
    setForm((current) => ({
      ...current,
      operatingSystem: value,
      userAgent: preset.userAgent,
      platform: preset.platform,
      osCpu: preset.osCpu
    }));
  };
  const updateNewProxy = (key: keyof typeof newProxy, value: string) => setNewProxy((current) => ({ ...current, [key]: value }));
  const updateSelectedProxyCredentials = (key: keyof typeof selectedProxyCredentials, value: string) =>
    setSelectedProxyCredentials((current) => ({ ...current, [key]: value }));
  const selectedProxy = form.proxyId && form.proxyId !== "__new__" ? proxies.find((proxy) => proxy.id === form.proxyId) : undefined;
  const selectedProxyCountry = selectedProxy
    ? detectedProxyCountries[selectedProxy.id]?.country ?? selectedProxy.country ?? "Unknown"
    : "Direct connection";

  useEffect(() => {
    setSelectedProxyCredentials({
      username: selectedProxy?.username ?? "",
      password: selectedProxy?.password ?? ""
    });
  }, [selectedProxy?.id, selectedProxy?.username, selectedProxy?.password]);

  useEffect(() => {
    if (!selectedProxy) return;
    const currentTypeAvailable = form.proxyProtocol === "http" ? selectedProxy.httpPort : selectedProxy.socks5Port;
    if (currentTypeAvailable) return;
    update("proxyProtocol", selectedProxy.httpPort ? "http" : "socks5");
  }, [selectedProxy?.id, selectedProxy?.httpPort, selectedProxy?.socks5Port]);

  useEffect(() => {
    if (!selectedProxy || selectedProxy.country) return;
    void api.detectProxyCountry(selectedProxy.id)
      .then((proxy) => setDetectedProxyCountries((current) => ({ ...current, [proxy.id]: { country: proxy.country, countryCode: proxy.countryCode } })))
      .catch(() => undefined);
  }, [selectedProxy?.id, selectedProxy?.country]);

  const submit = async () => {
    const name = form.name.trim();
    if (!name) {
      setError("Profile name is required.");
      return;
    }

    const width = Number(form.width);
    const height = Number(form.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 320 || height < 240) {
      setError("Screen resolution must be valid.");
      return;
    }

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    const hardwareConcurrency = Number(form.hardwareConcurrency);
    const fingerprint: FingerprintSettings = {
      userAgent: form.userAgent.trim(),
      timezoneMode: form.timezoneMode as FingerprintSettings["timezoneMode"],
      timezone: form.timezone.trim() || "UTC",
      languageMode: form.languageMode as FingerprintSettings["languageMode"],
      language: form.language.trim() || "en-US",
      screenMode: form.screenMode as FingerprintSettings["screenMode"],
      screen: { width, height },
      webRtcPolicy: form.webRtcPolicy as FingerprintSettings["webRtcPolicy"],
      geolocationAccess: form.geolocationAccess as FingerprintSettings["geolocationAccess"],
      geolocationMode: form.geolocationMode as FingerprintSettings["geolocationMode"],
      geolocation: Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : undefined,
      navigatorMode: form.navigatorMode as FingerprintSettings["navigatorMode"],
      platform: form.platform.trim() || undefined,
      hardwareConcurrency: Number.isFinite(hardwareConcurrency) ? hardwareConcurrency : undefined,
      osCpu: form.osCpu.trim() || undefined,
      canvasMode: "default",
      webGlMode: form.webGlMode as FingerprintSettings["webGlMode"],
      webGlVendor: form.webGlVendor.trim() || "Google Inc.",
      webGlRenderer: form.webGlRenderer.trim() || undefined,
      webGpuVendorId: form.webGpuVendorId.trim() || undefined,
      webGpuDeviceId: form.webGpuDeviceId.trim() || undefined,
      fonts: ["Arial", "Inter", "Segoe UI", "Roboto"],
      mediaDevices: { audioInputs: 1, videoInputs: 1, audioOutputs: 1 }
    };

    setSaving(true);
    setError(undefined);
    try {
      let proxyId = form.proxyId || undefined;
      if (form.proxyId === "__new__") {
        const httpPort = Number(newProxy.httpPort);
        const socks5Port = Number(newProxy.socks5Port);
        const hasHttpPort = Number.isFinite(httpPort);
        const hasSocks5Port = Number.isFinite(socks5Port);
        if (!newProxy.host.trim() || (!hasHttpPort && !hasSocks5Port)) {
          setError("Proxy host and at least one port are required.");
          setSaving(false);
          return;
        }
        const createdProxy = await api.createProxy({
          name: `${newProxy.host.trim()}`,
          protocol: hasHttpPort ? "http" : "socks5",
          host: newProxy.host.trim(),
          port: hasHttpPort ? httpPort : socks5Port,
          httpPort: hasHttpPort ? httpPort : undefined,
          socks5Port: hasSocks5Port ? socks5Port : undefined,
          username: newProxy.username.trim() || undefined,
          password: newProxy.password.trim() || undefined,
          group: newProxy.group.trim() || undefined
        });
        proxyId = createdProxy.id;
      } else if (selectedProxy) {
        const username = selectedProxyCredentials.username.trim() || undefined;
        const password = selectedProxyCredentials.password;
        if (username !== selectedProxy.username || password !== (selectedProxy.password ?? "")) {
          await api.updateProxy(selectedProxy.id, { username, password });
        }
      }

      await onSave({
        name,
        group: form.group.trim() || "Default",
        tags: splitList(form.tags),
        notes: form.notes.trim() || undefined,
        proxyId,
        proxyProtocol: form.proxyProtocol as ProxySettings["protocol"],
        tabBehavior: form.tabBehavior as BrowserProfile["tabBehavior"],
        operatingSystem: form.operatingSystem as BrowserProfile["operatingSystem"],
        browserEngine: form.browserEngine as BrowserProfile["browserEngine"],
        storageMode: form.storageMode as BrowserProfile["storageMode"],
        startupUrls: splitList(form.startupUrls),
        fingerprint
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg border border-line bg-white shadow-soft dark:border-white/10 dark:bg-[#17191c]">
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-white/95 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-[#17191c]/95">
          <div>
            <h2 className="text-lg font-semibold">{mode === "create" ? "Create profile" : "Edit profile"}</h2>
            <p className="text-sm text-gray-500">{mode === "create" ? "Configure an isolated browser workspace." : "Update this browser workspace."}</p>
          </div>
          <Button variant="ghost" icon={<X size={17} />} onClick={onClose} />
        </div>
        <div className="grid grid-cols-2 gap-4 p-5">
          <TextInput label="Name" value={form.name} onChange={(value) => update("name", value)} placeholder="Corporate account QA" autoFocus />
          <SelectInput label="Group" value={form.group} onChange={(value) => update("group", value)} options={groupOptions} />
          <TextInput label="Tags" value={form.tags} onChange={(value) => update("tags", value)} placeholder="qa, staging, support" />
          <ProxySelect value={form.proxyId} proxies={proxies} onChange={(value) => update("proxyId", value)} />
          <SelectInput
            label="Proxy type"
            value={form.proxyProtocol}
            onChange={(value) => update("proxyProtocol", value)}
            options={[
              { value: "http", label: "HTTP" },
              { value: "socks5", label: "SOCKS5" }
            ].filter((option) => !selectedProxy || (option.value === "http" ? selectedProxy.httpPort : selectedProxy.socks5Port))}
          />
          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500 dark:bg-[#202328] dark:text-gray-400">
            Proxy country: <span className="font-medium text-ink dark:text-white">{selectedProxyCountry}</span>
          </div>
          {selectedProxy && (
            <div className="col-span-2 rounded-lg border border-line bg-gray-50 p-4 dark:border-white/10 dark:bg-[#202328]">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">Selected proxy credentials</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{selectedProxy.host} � HTTP {selectedProxy.httpPort ?? "-"} � SOCKS5 {selectedProxy.socks5Port ?? "-"}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="Login" value={selectedProxyCredentials.username} onChange={(value) => updateSelectedProxyCredentials("username", value)} />
                <TextInput label="Password" value={selectedProxyCredentials.password} onChange={(value) => updateSelectedProxyCredentials("password", value)} />
              </div>
            </div>
          )}
          {form.proxyId === "__new__" && (
            <div className="col-span-2 rounded-lg border border-line bg-gray-50 p-4 dark:border-white/10 dark:bg-[#202328]">
              <div className="mb-3 text-sm font-semibold">New proxy</div>
              <div className="grid grid-cols-6 gap-3">
                <div className="col-span-2">
                  <TextInput label="Host / IP" value={newProxy.host} onChange={(value) => updateNewProxy("host", value)} />
                </div>
                <TextInput label="HTTP port" value={newProxy.httpPort} onChange={(value) => updateNewProxy("httpPort", value)} />
                <TextInput label="SOCKS5 port" value={newProxy.socks5Port} onChange={(value) => updateNewProxy("socks5Port", value)} />
                <TextInput label="Login" value={newProxy.username} onChange={(value) => updateNewProxy("username", value)} />
                <TextInput label="Password" value={newProxy.password} onChange={(value) => updateNewProxy("password", value)} />
              </div>
            </div>
          )}
          <div className="col-span-2 mt-2 text-sm font-semibold">Browser</div>
          <SelectInput label="Tab behavior" value={form.tabBehavior} onChange={(value) => update("tabBehavior", value)} options={[{ value: "restore", label: "Restore last session" }, { value: "custom", label: "Open startup URLs" }]} />
          <SelectInput label="Operating system" value={form.operatingSystem} onChange={updateOperatingSystem} options={[{ value: "macos", label: "macOS" }, { value: "windows", label: "Windows" }, { value: "linux", label: "Linux" }, { value: "android", label: "Android" }]} />
          <SelectInput label="Browser" value={form.browserEngine} onChange={(value) => update("browserEngine", value)} options={[{ value: "chromium", label: "Mimic (Chromium)" }, { value: "firefox", label: "Stealthfox (Firefox / SOCKS5)" }]} />
          <SelectInput label="Storage" value={form.storageMode} onChange={(value) => update("storageMode", value)} options={[{ value: "cloud", label: "Cloud" }, { value: "device", label: "Device" }]} />
          <TextInput label="Startup URLs" value={form.startupUrls} onChange={(value) => update("startupUrls", value)} placeholder="https://app.company.com" />
          <div className="col-span-2">
            <TextArea label="Notes" value={form.notes} onChange={(value) => update("notes", value)} placeholder="Purpose, owner, account notes" />
          </div>
          <div className="col-span-2 mt-2 text-sm font-semibold">Fingerprint</div>
          <SelectInput label="WebRTC" value={form.webRtcPolicy} onChange={(value) => update("webRtcPolicy", value)} options={[{ value: "company-network-only", label: "Mask" }, { value: "default", label: "Real" }, { value: "disabled", label: "Disabled" }]} />
          <SelectInput label="Timezone mode" value={form.timezoneMode} onChange={(value) => update("timezoneMode", value)} options={[{ value: "mask", label: "Mask" }, { value: "custom", label: "Custom" }, { value: "real", label: "Real" }]} />
          <TextInput label="Timezone" value={form.timezone} onChange={(value) => update("timezone", value)} />
          <SelectInput label="Geolocation access" value={form.geolocationAccess} onChange={(value) => update("geolocationAccess", value)} options={[{ value: "ask", label: "Ask" }, { value: "allow", label: "Allow" }, { value: "block", label: "Block" }]} />
          <SelectInput label="Geolocation data" value={form.geolocationMode} onChange={(value) => update("geolocationMode", value)} options={[{ value: "mask", label: "Mask" }, { value: "custom", label: "Custom" }]} />
          <TextInput label="Latitude" value={form.latitude} onChange={(value) => update("latitude", value)} />
          <TextInput label="Longitude" value={form.longitude} onChange={(value) => update("longitude", value)} />
          <SelectInput label="Browser languages" value={form.languageMode} onChange={(value) => update("languageMode", value)} options={[{ value: "mask", label: "Mask" }, { value: "custom", label: "Custom" }, { value: "real", label: "Real" }]} />
          <TextInput label="Language" value={form.language} onChange={(value) => update("language", value)} />
          <SelectInput label="Screen mode" value={form.screenMode} onChange={(value) => update("screenMode", value)} options={[{ value: "mask", label: "Mask" }, { value: "custom", label: "Custom" }, { value: "real", label: "Real" }]} />
          <TextInput label="Screen width" value={form.width} onChange={(value) => update("width", value)} />
          <TextInput label="Screen height" value={form.height} onChange={(value) => update("height", value)} />
          <SelectInput label="Navigator" value={form.navigatorMode} onChange={(value) => update("navigatorMode", value)} options={[{ value: "mask", label: "Mask" }, { value: "custom", label: "Custom" }, { value: "real", label: "Real" }]} />
          <div className="col-span-2"><TextInput label="User agent" value={form.userAgent} onChange={(value) => update("userAgent", value)} /></div>
          <TextInput label="Platform" value={form.platform} onChange={(value) => update("platform", value)} />
          <TextInput label="CPU cores" value={form.hardwareConcurrency} onChange={(value) => update("hardwareConcurrency", value)} />
          <div className="col-span-2"><TextInput label="OSCpu (optional)" value={form.osCpu} onChange={(value) => update("osCpu", value)} /></div>
          <SelectInput label="WebGL + WebGPU" value={form.webGlMode} onChange={(value) => update("webGlMode", value)} options={[{ value: "mask", label: "Mask" }, { value: "custom", label: "Custom" }, { value: "real", label: "Real" }]} />
          <TextInput label="WebGL vendor" value={form.webGlVendor} onChange={(value) => update("webGlVendor", value)} />
          <TextInput label="WebGL renderer" value={form.webGlRenderer} onChange={(value) => update("webGlRenderer", value)} />
          <TextInput label="WebGPU vendor ID" value={form.webGpuVendorId} onChange={(value) => update("webGpuVendorId", value)} />
          <TextInput label="WebGPU device ID" value={form.webGpuDeviceId} onChange={(value) => update("webGpuDeviceId", value)} />
          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500 dark:bg-[#202328] dark:text-gray-400">
            DNS leak-safe mode is applied automatically when a profile uses a proxy.
          </div>
        </div>
        {error && <div className="mx-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">{error}</div>}
        <div className="flex justify-end gap-2 border-t border-line p-5 dark:border-white/10">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={<Plus size={16} />} disabled={saving} onClick={() => void submit()}>
            {saving ? "Saving..." : mode === "create" ? "Create profile" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function getOperatingSystemPreset(operatingSystem?: BrowserProfile["operatingSystem"]) {
  if (operatingSystem === "macos") {
    return {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      platform: "MacIntel",
      osCpu: "Intel Mac OS X 14.0"
    };
  }
  if (operatingSystem === "linux") {
    return {
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      platform: "Linux x86_64",
      osCpu: "Linux x86_64"
    };
  }
  if (operatingSystem === "android") {
    return {
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      platform: "Linux armv8l",
      osCpu: "Linux armv8l"
    };
  }
  return {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    platform: "Win32",
    osCpu: "Windows NT 10.0; Win64; x64"
  };
}

function splitList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}


function RdpPage() {
  const [connections, setConnections] = useState<RdpConnection[]>([]);
  const [editing, setEditing] = useState<RdpConnection>();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [status, setStatus] = useState<string>();

  const refreshRdp = async () => setConnections(await api.rdpConnections());
  useEffect(() => { void refreshRdp(); }, []);

  const launch = async (connection: RdpConnection) => {
    try {
      await api.launchRdpConnection(connection.id);
      setStatus(`Opening ${connection.name}...`);
      await refreshRdp();
    } catch (error) {
      setStatus(normalizeApiError(error));
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">RDP</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage and launch remote desktop connections.</p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => { setEditing(undefined); setDialogOpen(true); }}>Add RDP</Button>
      </div>
      {status && <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-[#202328] dark:text-gray-300">{status}</div>}
      <Panel title="Remote desktops">
        <div className="overflow-hidden rounded-xl border border-line dark:border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-[#202328]">
              <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">IP / host</th><th className="px-3 py-2">Login</th><th className="px-3 py-2">Domain</th><th className="px-3 py-2">Last launch</th><th className="px-3 py-2 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {connections.map((connection) => (
                <tr key={connection.id} className="border-t border-line dark:border-white/10">
                  <td className="px-3 py-2 font-medium">{connection.name}</td>
                  <td className="px-3 py-2">{connection.host}</td>
                  <td className="px-3 py-2">{connection.username}</td>
                  <td className="px-3 py-2">{connection.domain ?? "-"}</td>
                  <td className="px-3 py-2">{connection.lastLaunchedAt ? new Date(connection.lastLaunchedAt).toLocaleString() : "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Button onClick={() => void launch(connection)} icon={<Play size={15} />}>Open</Button>
                      <Button onClick={() => { setEditing(connection); setDialogOpen(true); }} icon={<Pencil size={15} />} />
                      <Button onClick={() => void api.deleteRdpConnection(connection.id).then(refreshRdp)} icon={<Trash2 size={15} />} />
                    </div>
                  </td>
                </tr>
              ))}
              {!connections.length && <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={6}>No RDP connections yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
      {isDialogOpen && (
        <RdpEditorDialog
          connection={editing}
          onClose={() => setDialogOpen(false)}
          onSaved={async (message) => {
            setStatus(message);
            setDialogOpen(false);
            await refreshRdp();
          }}
        />
      )}
    </section>
  );
}

function RdpEditorDialog({ connection, onClose, onSaved }: { connection?: RdpConnection; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [form, setForm] = useState({
    name: connection?.name ?? "",
    host: connection?.host ?? "",
    username: connection?.username ?? "",
    password: "",
    domain: connection?.domain ?? ""
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      if (connection) {
        await api.updateRdpConnection(connection.id, {
          name: form.name,
          host: form.host,
          username: form.username,
          domain: form.domain || undefined,
          ...(form.password ? { password: form.password } : {})
        });
        await onSaved("RDP connection updated.");
      } else {
        await api.createRdpConnection({
          name: form.name,
          host: form.host,
          username: form.username,
          password: form.password,
          domain: form.domain || undefined
        });
        await onSaved("RDP connection added.");
      }
    } catch (saveError) {
      setError(normalizeApiError(saveError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-line bg-white shadow-soft dark:border-white/10 dark:bg-[#17191c]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4 dark:border-white/10">
          <div>
            <div className="text-lg font-semibold">{connection ? "Edit RDP" : "Add RDP"}</div>
            <div className="text-sm text-gray-500">Configure remote desktop connection details.</div>
          </div>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <TextInput label="Name" value={form.name} autoFocus onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
          <TextInput label="IP / host" value={form.host} onChange={(value) => setForm((current) => ({ ...current, host: value }))} />
          <TextInput label="Login" value={form.username} onChange={(value) => setForm((current) => ({ ...current, username: value }))} />
          <TextInput label={connection?.hasPassword ? "Password (saved)" : "Password"} value={form.password} type="password" onChange={(value) => setForm((current) => ({ ...current, password: value }))} />
          <TextInput label="Domain" value={form.domain} onChange={(value) => setForm((current) => ({ ...current, domain: value }))} />
        </div>
        {error && <div className="mx-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
        <div className="flex justify-end gap-2 border-t border-line px-5 py-4 dark:border-white/10">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={() => void save()}>{busy ? "Saving..." : connection ? "Save RDP" : "Add RDP"}</Button>
        </div>
      </div>
    </div>
  );
}

function ProxyManager() {
  const { proxies, createProxy, checkProxy, updateProxy, deleteProxy, refresh } = useWorkspaceStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingProxy, setEditingProxy] = useState<ProxySettings>();
  const [isProxyDialogOpen, setProxyDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportCandidate[]>([]);
  const [selectedProxyIds, setSelectedProxyIds] = useState<string[]>([]);
  const [proxylineImporting, setProxylineImporting] = useState(false);
  const [proxylineImportStatus, setProxylineImportStatus] = useState<string>();
  const [checkingAllProxies, setCheckingAllProxies] = useState(false);
  const [form, setForm] = useState({
    name: "",
    host: "",
    httpPort: "",
    socks5Port: "",
    username: "",
    password: ""
  });
  const updateProxyForm = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const resetProxyForm = () => {
    setEditingProxy(undefined);
    setForm({ name: "", host: "", httpPort: "", socks5Port: "", username: "", password: "" });
    setProxyDialogOpen(false);
  };
  const filteredProxies = proxies;
  const visibleProxyIds = useMemo(() => filteredProxies.map((proxy) => proxy.id), [filteredProxies]);
  const selectedVisibleCount = selectedProxyIds.filter((id) => visibleProxyIds.includes(id)).length;
  const toggleProxySelection = (id: string) =>
    setSelectedProxyIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const toggleVisibleProxySelection = (selected: boolean) => {
    const visibleIds = new Set(visibleProxyIds);
    setSelectedProxyIds((current) => selected ? [...new Set([...current, ...visibleIds])] : current.filter((id) => !visibleIds.has(id)));
  };
  const deleteSelectedProxies = async () => {
    if (!selectedProxyIds.length) return;
    if (!confirm(`Delete ${selectedProxyIds.length} selected proxies? Profiles using them will switch to Direct connection.`)) return;
    for (const id of selectedProxyIds) {
      await deleteProxy(id);
    }
    setSelectedProxyIds([]);
  };
  useEffect(() => {
    if (editingProxy && !proxies.some((proxy) => proxy.id === editingProxy.id)) {
      resetProxyForm();
    }
  }, [editingProxy, proxies]);
  useEffect(() => {
    const existingIds = new Set(proxies.map((proxy) => proxy.id));
    setSelectedProxyIds((current) => current.filter((id) => existingIds.has(id)));
  }, [proxies]);
  const addProxy = async () => {
    const httpPort = Number(form.httpPort);
    const socks5Port = Number(form.socks5Port);
    const hasHttpPort = Number.isFinite(httpPort);
    const hasSocks5Port = Number.isFinite(socks5Port);
    if (!form.host.trim() || (!hasHttpPort && !hasSocks5Port)) return;
    await createProxy({
      name: form.name.trim() || "New proxy",
      protocol: hasHttpPort ? "http" : "socks5",
      host: form.host.trim(),
      port: hasHttpPort ? httpPort : socks5Port,
      httpPort: hasHttpPort ? httpPort : undefined,
      socks5Port: hasSocks5Port ? socks5Port : undefined,
      username: form.username.trim() || undefined,
      password: form.password.trim() || undefined
    });
    resetProxyForm();
  };
  const openProxyCreate = () => {
    setEditingProxy(undefined);
    setForm({ name: "", host: "", httpPort: "", socks5Port: "", username: "", password: "" });
    setProxyDialogOpen(true);
  };
  const startProxyEdit = (proxy: ProxySettings) => {
    setEditingProxy(proxy);
    setForm({
      name: proxy.name,
      host: proxy.host,
      httpPort: proxy.httpPort ? String(proxy.httpPort) : "",
      socks5Port: proxy.socks5Port ? String(proxy.socks5Port) : "",
      username: proxy.username ?? "",
      password: proxy.password ?? ""
    });
    setProxyDialogOpen(true);
  };
  const saveProxyEdit = async () => {
    if (!editingProxy) return;
    const httpPort = Number(form.httpPort);
    const socks5Port = Number(form.socks5Port);
    const hasHttpPort = Number.isFinite(httpPort);
    const hasSocks5Port = Number.isFinite(socks5Port);
    if (!form.host.trim() || (!hasHttpPort && !hasSocks5Port)) return;
    await updateProxy(editingProxy.id, {
      name: form.name.trim() || editingProxy.name,
      protocol: hasHttpPort ? "http" : "socks5",
      host: form.host.trim(),
      port: hasHttpPort ? httpPort : socks5Port,
      httpPort: hasHttpPort ? httpPort : undefined,
      socks5Port: hasSocks5Port ? socks5Port : undefined,
      username: form.username.trim() || undefined,
      password: form.password,
      status: "unknown"
    });
    resetProxyForm();
  };

  const openImportFile = () => fileInputRef.current?.click();

  const importFromProxyline = async () => {
    setProxylineImporting(true);
    setProxylineImportStatus(undefined);
    try {
      const result = await api.importProxylineProxies();
      await refresh();
      setProxylineImportStatus(`Imported ${result.importedCount} new proxies and updated ${result.updatedCount} existing proxies from Proxyline.`);
    } catch (error) {
      setProxylineImportStatus(error instanceof Error ? error.message : "Proxyline import failed.");
    } finally {
      setProxylineImporting(false);
    }
  };

  const checkAllProxies = async () => {
    setCheckingAllProxies(true);
    try {
      await api.checkAllProxies();
      await refresh();
    } finally {
      setCheckingAllProxies(false);
    }
  };

  const loadImportFile = async (file?: File) => {
    if (!file) return;
    const fileText = await file.text();
    const candidates = parseProxyImportText(fileText);
    setImportPreview(candidates);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const importSelectedPreview = async () => {
    const selected = importPreview.filter((candidate) => candidate.selected);
    for (const candidate of selected) {
      await createProxy({
        name: candidate.name,
        protocol: candidate.protocol,
        host: candidate.host,
        port: candidate.port,
        username: candidate.username,
        password: candidate.password,
        country: candidate.country,
        countryCode: candidate.countryCode
      });
    }
    setImportPreview([]);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Proxy Manager</h1>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            onChange={(event) => void loadImportFile(event.target.files?.[0])}
          />
          <Button variant="primary" icon={<Plus size={16} />} onClick={openProxyCreate}>Add proxy</Button>
          <Button icon={<RefreshCcw size={16} />} disabled={checkingAllProxies} onClick={() => void checkAllProxies()}>
            {checkingAllProxies ? "Checking..." : "Check all"}
          </Button>
          <Button icon={<RefreshCcw size={16} />} disabled={proxylineImporting} onClick={() => void importFromProxyline()}>
            {proxylineImporting ? "Importing..." : "Import from Proxyline"}
          </Button>
          <Button variant="primary" icon={<Upload size={16} />} onClick={openImportFile}>Import TXT/CSV</Button>
        </div>
      </div>
      {isProxyDialogOpen && (
        <ProxyEditorDialog
          mode={editingProxy ? "edit" : "create"}
          form={form}
          onChange={updateProxyForm}
          onClose={resetProxyForm}
          onSave={() => void (editingProxy ? saveProxyEdit() : addProxy())}
        />
      )}
      {proxylineImportStatus && <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-[#202328] dark:text-gray-300">{proxylineImportStatus}</div>}
      {importPreview.length > 0 && (
        <ProxyImportDialog
          items={importPreview}
          onChange={setImportPreview}
          onClose={() => setImportPreview([])}
          onImport={() => void importSelectedPreview()}
        />
      )}
      <div className="overflow-hidden rounded-lg border border-line bg-white dark:border-white/10 dark:bg-[#17191c]">
        <div className="flex items-center justify-between border-b border-line px-3 py-2 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold">Proxy list</div>
            {selectedProxyIds.length > 0 && (
              <Button className="h-8 px-2" icon={<Trash2 size={15} />} onClick={() => void deleteSelectedProxies()}>
                Delete selected ({selectedProxyIds.length})
              </Button>
            )}
          </div>
        </div>
        <table className="w-full table-fixed text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-[#202328]">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={filteredProxies.length > 0 && selectedVisibleCount === filteredProxies.length}
                  onChange={(event) => toggleVisibleProxySelection(event.target.checked)}
                />
              </th>
              <th className="w-[22%] px-3 py-2">Name</th>
              <th className="w-[10%] px-3 py-2">HTTP</th>
              <th className="w-[10%] px-3 py-2">SOCKS5</th>
              <th className="w-[16%] px-3 py-2">Host</th>
              <th className="w-[13%] px-3 py-2">Password</th>
              <th className="w-[11%] px-3 py-2">Country</th>
              <th className="w-[14%] px-3 py-2">Status</th>
              <th className="w-[14%] px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProxies.map((proxy) => (
              <tr key={proxy.id} className="border-t border-line dark:border-white/10">
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selectedProxyIds.includes(proxy.id)} onChange={() => toggleProxySelection(proxy.id)} />
                </td>
                <td className="px-3 py-2">
                  <div className="truncate font-medium">{proxy.name}</div>
                  {proxy.socks5Port && (proxy.username || proxy.hasPassword) && (
                    <div className="text-xs text-amber-600 dark:text-amber-300">Authenticated SOCKS5 is not supported by Chromium</div>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{proxy.httpPort ?? "-"}</td>
                <td className="px-3 py-2 font-mono text-xs">{proxy.socks5Port ?? "-"}</td>
                <td className="truncate px-3 py-2 font-mono text-xs">{proxy.host}</td>
                <td className="truncate px-3 py-2 font-mono text-xs">{proxy.password ?? (proxy.hasPassword ? "Saved" : "-")}</td>
                <td className="truncate px-3 py-2">{proxy.country ?? "Unknown"}</td>
                <td className="px-3 py-2">
                  <div className="space-y-1 whitespace-nowrap">
                    <span className="inline-flex rounded-lg bg-gray-100 px-2 py-1 text-xs dark:bg-white/10">{proxy.status}</span>
                    <div className="text-xs text-gray-400">{proxy.latencyMs ?? "-"} ms</div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <Button className="h-9 w-10 px-0" title="Edit" icon={<Pencil size={18} />} onClick={() => startProxyEdit(proxy)} />
                    <Button
                      className="h-9 w-10 px-0"
                      title="Delete"
                      icon={<Trash2 size={18} />}
                      onClick={() => {
                        if (confirm(`Delete proxy "${proxy.name}"? Profiles using it will switch to Direct connection.`)) {
                          void deleteProxy(proxy.id);
                        }
                      }}
                    />
                    <Button className="h-9 w-10 px-0" title="Check" icon={<RefreshCcw size={18} />} onClick={() => void checkProxy(proxy.id)} />
                  </div>
                </td>
              </tr>
            ))}
            {!filteredProxies.length && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No proxies for this type.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type ProxyEditorForm = {
  name: string;
  host: string;
  httpPort: string;
  socks5Port: string;
  username: string;
  password: string;
};

function ProxyEditorDialog({
  mode,
  form,
  onChange,
  onClose,
  onSave
}: {
  mode: "create" | "edit";
  form: ProxyEditorForm;
  onChange: (key: keyof ProxyEditorForm, value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-line bg-white shadow-soft dark:border-white/10 dark:bg-[#17191c]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="text-lg font-semibold">{mode === "edit" ? "Edit proxy" : "Add proxy"}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Configure proxy connection details.</p>
          </div>
          <Button variant="ghost" icon={<X size={17} />} onClick={onClose} />
        </div>
        <div className="grid grid-cols-12 gap-3 p-5">
          <div className="col-span-12 md:col-span-5">
            <TextInput label="Name" value={form.name} onChange={(value) => onChange("name", value)} autoFocus />
          </div>
          <div className="col-span-12 md:col-span-7">
            <TextInput label="Host / IP" value={form.host} onChange={(value) => onChange("host", value)} />
          </div>
          <div className="col-span-6 md:col-span-3">
            <TextInput label="HTTP port" value={form.httpPort} onChange={(value) => onChange("httpPort", value)} />
          </div>
          <div className="col-span-6 md:col-span-3">
            <TextInput label="SOCKS5 port" value={form.socks5Port} onChange={(value) => onChange("socks5Port", value)} />
          </div>
          <div className="col-span-6 md:col-span-4">
            <TextInput label="Login" value={form.username} onChange={(value) => onChange("username", value)} />
          </div>
          <div className="col-span-12 md:col-span-5">
            <TextInput label="Password" value={form.password} onChange={(value) => onChange("password", value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line p-5 dark:border-white/10">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={mode === "edit" ? <Pencil size={16} /> : <Plus size={16} />} onClick={onSave}>
            {mode === "edit" ? "Save" : "Add proxy"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type ImportCandidate = Omit<ProxySettings, "id" | "status"> & {
  importId: string;
  selected: boolean;
};

function ProxyImportDialog({
  items,
  onChange,
  onClose,
  onImport
}: {
  items: ImportCandidate[];
  onChange: (items: ImportCandidate[]) => void;
  onClose: () => void;
  onImport: () => void;
}) {
  const [typeFilter, setTypeFilter] = useState<"all" | ProxySettings["protocol"]>("all");
  const selectedCount = items.filter((item) => item.selected).length;
  const visibleItems = useMemo(
    () => (typeFilter === "all" ? items : items.filter((item) => item.protocol === typeFilter)),
    [items, typeFilter]
  );
  const setVisible = (selected: boolean) => {
    const visibleIds = new Set(visibleItems.map((item) => item.importId));
    onChange(items.map((item) => (visibleIds.has(item.importId) ? { ...item, selected } : item)));
  };
  const toggle = (importId: string) => onChange(items.map((item) => (item.importId === importId ? { ...item, selected: !item.selected } : item)));
  const visibleSelectedCount = visibleItems.filter((item) => item.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-5xl overflow-hidden rounded-lg border border-line bg-white shadow-soft dark:border-white/10 dark:bg-[#17191c]">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 dark:border-white/10">
          <div>
            <h2 className="text-lg font-semibold">Import proxies</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{selectedCount} of {items.length} selected</p>
          </div>
          <Button variant="ghost" icon={<X size={17} />} onClick={onClose} />
        </div>
        <div className="flex items-center justify-between border-b border-line px-4 py-2 dark:border-white/10">
          <div className="text-sm text-gray-500 dark:text-gray-400">Use checkboxes to choose proxies to import.</div>
          <div className="flex rounded-lg border border-line bg-gray-50 p-1 dark:border-white/10 dark:bg-[#202328]">
            {[
              { value: "all", label: `All ${items.length}` },
              { value: "http", label: `HTTP ${items.filter((item) => item.protocol === "http").length}` },
              { value: "socks5", label: `SOCKS5 ${items.filter((item) => item.protocol === "socks5").length}` }
            ].map((item) => (
              <button
                key={item.value}
                className={`h-8 rounded-md px-3 text-sm transition ${
                  typeFilter === item.value
                    ? "bg-white text-ink shadow-sm dark:bg-white dark:text-ink"
                    : "text-gray-500 hover:text-ink dark:text-gray-400 dark:hover:text-white"
                }`}
                onClick={() => setTypeFilter(item.value as typeof typeFilter)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[58vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-[#202328] dark:text-gray-400">
              <tr>
                <th className="w-12 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={visibleItems.length > 0 && visibleSelectedCount === visibleItems.length}
                    onChange={(event) => setVisible(event.target.checked)}
                  />
                </th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Host</th>
                <th className="px-3 py-2">Port</th>
                <th className="px-3 py-2">Login</th>
                <th className="px-3 py-2">Password</th>
                <th className="px-3 py-2">Country</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.importId} className="border-t border-line dark:border-white/10">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={item.selected} onChange={() => toggle(item.importId)} />
                  </td>
                  <td className="px-3 py-2 font-medium">{item.name}</td>
                  <td className="px-3 py-2 uppercase">{item.protocol}</td>
                  <td className="px-3 py-2 font-mono text-xs">{item.host}</td>
                  <td className="px-3 py-2">{item.port}</td>
                  <td className="px-3 py-2">{item.username ?? "-"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{item.password ?? "-"}</td>
                  <td className="px-3 py-2">{item.country ?? item.countryCode ?? "Unknown"}</td>
                </tr>
              ))}
              {!visibleItems.length && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No proxies for this type.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 border-t border-line p-4 dark:border-white/10">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={<Plus size={16} />} disabled={!selectedCount} onClick={onImport}>Add selected</Button>
        </div>
      </div>
    </div>
  );
}

function parseProxyImportText(text: string): ImportCandidate[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = parseCsvRow(lines[0], separator).map((header) => header.trim().toLowerCase());
  const hasKnownHeaders = ["ip", "host", "port_http", "port_socks5", "username", "password"].some((header) => headers.includes(header));
  if (!hasKnownHeaders) return parsePlainProxyText(trimmed);

  const headerIndex = (name: string) => headers.indexOf(name);
  const pick = (values: string[], ...names: string[]) => {
    for (const name of names) {
      const index = headerIndex(name);
      if (index >= 0 && values[index]) return values[index].trim();
    }
    return "";
  };

  return lines.slice(1).flatMap((line, lineIndex) => {
    const values = parseCsvRow(line, separator);
    const host = pick(values, "ip", "host");
    const username = pick(values, "username", "login");
    const password = pick(values, "password", "pass");
    const countryCode = pick(values, "country", "country_code").toUpperCase() || undefined;
    const country = countryCode ? countryName(countryCode) : undefined;
    const result: ImportCandidate[] = [];
    const add = (protocol: ProxySettings["protocol"], rawPort: string) => {
      const port = Number(rawPort);
      if (!host || !Number.isFinite(port)) return;
      result.push({
        importId: `${lineIndex}-${protocol}-${port}`,
        selected: true,
        name: `${countryCode ?? protocol.toUpperCase()} ${host}:${port}`,
        protocol,
        host,
        port,
        username: username || undefined,
        password: password || undefined,
        country,
        countryCode
      });
    };
    add("http", pick(values, "port_http", "http_port"));
    add("socks5", pick(values, "port_socks5", "socks5_port", "socks_port"));
    if (!result.length) add("http", pick(values, "port"));
    return result;
  });
}

function parsePlainProxyText(text: string): ImportCandidate[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const result: ImportCandidate[] = [];
  for (const [blockIndex, block] of blocks.entries()) {
    const structured = parseStructuredProxyImportBlock(block, blockIndex);
    if (structured.length) {
      result.push(...structured);
      continue;
    }
    for (const [lineIndex, line] of block.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).entries()) {
      const parsed = parsePlainProxyLine(line, `${blockIndex}-${lineIndex}`);
      if (parsed) result.push(parsed);
    }
  }
  return result;
}

function parseStructuredProxyImportBlock(block: string, blockIndex: number): ImportCandidate[] {
  const host = block.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)?.[0];
  const username = block.match(/(?:логин|login)\s*:\s*([^\s]+)/i)?.[1];
  const password = block.match(/(?:пароль|password)\s*:\s*([^\s]+)/i)?.[1];
  const ports = block.match(/(?:порт|port)\s*:\s*(\d+)(?:\s*\/\s*(\d+))?/i);
  if (!host || !ports) return [];
  return [
    makeImportCandidate(`${blockIndex}-http`, "http", host, Number(ports[1]), username, password),
    ports[2] ? makeImportCandidate(`${blockIndex}-socks5`, "socks5", host, Number(ports[2]), username, password) : undefined
  ].filter(Boolean) as ImportCandidate[];
}

function parsePlainProxyLine(line: string, importId: string): ImportCandidate | undefined {
  const protocol: ProxySettings["protocol"] = /^socks5:\/\//i.test(line) ? "socks5" : "http";
  const withoutProtocol = line.replace(/^(?:https?|socks5):\/\//i, "");

  if (withoutProtocol.includes("@")) {
    const [credentials, endpoint] = withoutProtocol.split("@");
    const [username, password] = credentials.split(":");
    const [host, port] = endpoint.split(":");
    return makeImportCandidate(importId, protocol, host, Number(port), username, password);
  }

  const parts = withoutProtocol.split(":");
  if (parts.length >= 4) {
    const [host, port, username, password] = parts;
    return makeImportCandidate(importId, protocol, host, Number(port), username, password);
  }
  if (parts.length >= 2) {
    const [host, port] = parts;
    return makeImportCandidate(importId, protocol, host, Number(port));
  }
  return undefined;
}

function makeImportCandidate(
  importId: string,
  protocol: ProxySettings["protocol"],
  host: string,
  port: number,
  username?: string,
  password?: string
): ImportCandidate | undefined {
  if (!host || !Number.isFinite(port)) return undefined;
  return {
    importId,
    selected: true,
    name: `${protocol.toUpperCase()} ${host}:${port}`,
    protocol,
    host,
    port,
    username: username || undefined,
    password: password || undefined
  };
}

function parseCsvRow(line: string, separator: string) {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === separator && !quoted) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function countryName(code: string) {
  const countries: Record<string, string> = {
    CZ: "Czechia",
    LV: "Latvia",
    PL: "Poland",
    UA: "Ukraine"
  };
  return countries[code] ?? code;
}

function Fingerprints() {
  const { profiles, updateProfile } = useWorkspaceStore();
  const [preset, setPreset] = useState<FingerprintSettings>();
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [applyMessage, setApplyMessage] = useState<string>();
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId);

  useEffect(() => {
    if (!selectedProfileId && profiles[0]) {
      setSelectedProfileId(profiles[0].id);
    }
  }, [profiles, selectedProfileId]);

  const generatePreset = async () => {
    const nextPreset = await api.randomFingerprint();
    setPreset(nextPreset);
    setApplyMessage(undefined);
  };

  const applyPreset = async () => {
    if (!selectedProfile || !preset) return;
    await updateProfile(selectedProfile.id, { fingerprint: preset });
    setApplyMessage(`Preset applied to ${selectedProfile.name}.`);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Fingerprints</h1>
        <Button variant="primary" icon={<RefreshCcw size={16} />} onClick={() => void generatePreset()}>Generate preset</Button>
      </div>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4">
        <Panel title="Settings">
          <Field label="User agent" value={preset?.userAgent ?? "Chrome desktop preset"} />
          <Field label="Timezone" value={preset?.timezone ?? "Europe/Kyiv"} />
          <Field label="Language" value={preset?.language ?? "en-US"} />
          <Field label="Resolution" value={preset ? `${preset.screen.width} x ${preset.screen.height}` : "1440 x 900"} />
        </Panel>
        <Panel title="Runtime controls">
          <Field label="WebRTC policy" value={preset?.webRtcPolicy ?? "company-network-only"} />
          <Field label="Canvas mode" value={preset?.canvasMode ?? "default"} />
          <Field label="WebGL vendor" value={preset?.webGlVendor ?? "Google Inc."} />
          <Field label="Fonts" value={(preset?.fonts ?? ["Arial", "Inter", "Segoe UI"]).join(", ")} />
        </Panel>
      </div>
      <Panel title="Apply preset">
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <SelectInput
            label="Target profile"
            value={selectedProfileId}
            onChange={(value) => {
              setSelectedProfileId(value);
              setApplyMessage(undefined);
            }}
            options={profiles.length ? profiles.map((profile) => ({ value: profile.id, label: profile.name })) : [{ value: "", label: "No profiles available" }]}
          />
          <Button variant="primary" icon={<Plus size={16} />} disabled={!preset || !selectedProfile} onClick={() => void applyPreset()}>
            Apply to profile
          </Button>
        </div>
        {applyMessage && <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">{applyMessage}</div>}
        {!preset && <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Generate a preset first, then apply it to a workspace profile.</div>}
      </Panel>
    </section>
  );
}

function GroupsPage() {
  const { profiles, refresh } = useWorkspaceStore();
  const [team, setTeam] = useState<TeamWorkspaceData>({ members: [], groups: [], invitations: [] });
  const [groupForm, setGroupForm] = useState({ name: "", description: "" });
  const [profileAssignments, setProfileAssignments] = useState<Record<string, string>>({});
  const [memberAssignments, setMemberAssignments] = useState<Record<string, string>>({});
  const loadTeam = async () => setTeam(await api.team());

  useEffect(() => { void loadTeam(); }, []);

  const createGroup = async () => {
    if (!groupForm.name.trim()) return;
    await api.createTeamGroup({ name: groupForm.name.trim(), description: groupForm.description.trim() || undefined });
    setGroupForm({ name: "", description: "" });
    await loadTeam();
  };

  const assignProfile = async (groupId: string) => {
    const profileId = profileAssignments[groupId];
    if (!profileId) return;
    await api.assignProfileGroup(groupId, profileId);
    setProfileAssignments((current) => ({ ...current, [groupId]: "" }));
    await Promise.all([loadTeam(), refresh()]);
  };

  const assignMember = async (groupId: string) => {
    const memberId = memberAssignments[groupId];
    const member = team.members.find((item) => item.id === memberId);
    if (!member) return;
    const currentGroupIds = team.groups.filter((group) => group.memberIds.includes(memberId)).map((group) => group.id);
    await api.updateTeamMember(member.id, { groupIds: [...new Set([...currentGroupIds, groupId])] });
    setMemberAssignments((current) => ({ ...current, [groupId]: "" }));
    await loadTeam();
  };

  const removeMember = async (groupId: string, memberId: string) => {
    await api.removeMemberFromGroup(groupId, memberId);
    await loadTeam();
  };

  const removeProfile = async (groupId: string, profileId: string) => {
    await api.removeProfileFromGroup(groupId, profileId);
    await Promise.all([loadTeam(), refresh()]);
  };

  const memberById = useMemo(() => new Map(team.members.map((member) => [member.id, member])), [team.members]);
  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);

  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-line bg-white p-3 shadow-soft dark:border-white/10 dark:bg-[#17191c]">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <TextInput label="Group name" value={groupForm.name} onChange={(value) => setGroupForm((current) => ({ ...current, name: value }))} />
          <TextInput label="Description" value={groupForm.description} onChange={(value) => setGroupForm((current) => ({ ...current, description: value }))} />
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => void createGroup()}>Add group</Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-white shadow-soft dark:border-white/10 dark:bg-[#17191c]">
        <div className="grid grid-cols-[1.1fr_1fr_1fr_1.55fr_auto] gap-3 border-b border-line bg-gray-50 px-3 py-2 text-xs font-semibold uppercase text-gray-500 dark:border-white/10 dark:bg-[#202328] dark:text-gray-400">
          <div>Folder</div>
          <div>Members</div>
          <div>Profiles</div>
          <div>Assign</div>
          <div className="text-right">Actions</div>
        </div>
        {team.groups.map((group) => {
          const groupProfiles = group.profileIds.map((id) => profileById.get(id)).filter(Boolean) as BrowserProfile[];
          const groupMembers = group.memberIds.map((id) => memberById.get(id)).filter(Boolean);
          const availableProfiles = profiles.filter((profile) => profile.group !== group.name);
          return (
            <div key={group.id} className="grid grid-cols-[1.1fr_1fr_1fr_1.55fr_auto] gap-3 border-b border-line px-3 py-3 text-sm last:border-b-0 dark:border-white/10">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2 font-semibold">
                  <FolderKanban size={16} className="shrink-0 text-gray-500 dark:text-gray-400" />
                  <span className="truncate">{group.name}</span>
                </div>
                <div className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{group.description ?? "No description"}</div>
              </div>
              <RemovableChipLine empty="No members" items={groupMembers.map((member) => ({ id: member!.id, label: member!.name }))} onRemove={(memberId) => void removeMember(group.id, memberId)} />
              <RemovableChipLine empty="No profiles" items={groupProfiles.map((profile) => ({ id: profile.id, label: profile.name }))} onRemove={(profileId) => void removeProfile(group.id, profileId)} />
              <div className="grid gap-2">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <select
                    className="h-9 min-w-0 rounded-lg border border-line bg-white px-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-white/10 dark:bg-[#202328]"
                    value={memberAssignments[group.id] ?? ""}
                    onChange={(event) => setMemberAssignments((current) => ({ ...current, [group.id]: event.target.value }))}
                  >
                    <option value="">Select member</option>
                    {team.members
                      .filter((member) => !group.memberIds.includes(member.id))
                      .map((member) => <option key={member.id} value={member.id}>{member.name} ({member.role})</option>)}
                  </select>
                  <Button className="h-9 px-2" icon={<UserPlus size={15} />} onClick={() => void assignMember(group.id)}>Add</Button>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <select
                    className="h-9 min-w-0 rounded-lg border border-line bg-white px-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-white/10 dark:bg-[#202328]"
                    value={profileAssignments[group.id] ?? ""}
                    onChange={(event) => setProfileAssignments((current) => ({ ...current, [group.id]: event.target.value }))}
                  >
                    <option value="">Select profile</option>
                    {availableProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                  </select>
                  <Button className="h-9 px-2" icon={<Plus size={15} />} onClick={() => void assignProfile(group.id)}>Add</Button>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  className="h-9 px-2"
                  icon={<Trash2 size={15} />}
                  disabled={group.name === "Default"}
                  onClick={() => {
                    if (confirm(`Delete group "${group.name}"? Profiles will move to Default.`)) {
                      void api.deleteTeamGroup(group.id).then(loadTeam).then(refresh);
                    }
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RemovableChipLine({ empty, items, onRemove }: { empty: string; items: Array<{ id: string; label: string }>; onRemove: (id: string) => void }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap gap-1.5">
        {items.length ? items.map((item) => (
          <span key={item.id} className="inline-flex max-w-36 items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs dark:bg-white/10">
            <span className="truncate">{item.label}</span>
            <button className="text-gray-400 hover:text-rose-500" onClick={() => onRemove(item.id)}><X size={11} /></button>
          </span>
        )) : <span className="text-xs text-gray-500 dark:text-gray-400">{empty}</span>}
      </div>
    </div>
  );
}

function ChipLine({ values, empty }: { values: string[]; empty: string }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap gap-1.5">
        {values.length ? values.slice(0, 4).map((value) => (
          <span key={value} className="max-w-32 truncate rounded-md bg-gray-100 px-2 py-1 text-xs dark:bg-white/10">{value}</span>
        )) : <span className="text-xs text-gray-500 dark:text-gray-400">{empty}</span>}
        {values.length > 4 && <span className="rounded-md bg-gray-100 px-2 py-1 text-xs dark:bg-white/10">+{values.length - 4}</span>}
      </div>
    </div>
  );
}

function InviteStatus({ invite }: { invite: { url: string; email: string; result?: EmailResult } }) {
  const sent = invite.result?.sent;
  const failed = invite.result?.error;
  const skipped = invite.result?.skipped || invite.result?.reason;
  const tone = sent ? "emerald" : failed ? "red" : "amber";
  const message = sent
    ? `Email sent to ${invite.email}.`
    : failed
      ? `Invite created, but SMTP failed: ${invite.result?.error}`
      : `Invite created, but email was not sent: ${invite.result?.reason ?? "SMTP is not configured"}`;
  const className = tone === "emerald"
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"
    : tone === "red"
      ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200"
      : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100";

  return (
    <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${className}`}>
      <div className="font-medium">{message}</div>
      <div className="mt-1 break-all text-xs opacity-90">Invite link: <code>{invite.url}</code></div>
      {skipped && !sent && !failed && (
        <div className="mt-1 text-xs opacity-90">Enable SMTP in Settings, save credentials, then use Resend.</div>
      )}
    </div>
  );
}

function MembersPage() {
  const [team, setTeam] = useState<TeamWorkspaceData>({ members: [], groups: [], invitations: [] });
  const [memberForm, setMemberForm] = useState({ name: "", email: "", role: "employee" as Role, groupIds: [] as string[] });
  const [editingMemberId, setEditingMemberId] = useState<string>();
  const [lastInvite, setLastInvite] = useState<{ url: string; email: string; result?: EmailResult }>();
  const loadTeam = async () => setTeam(await api.team());

  useEffect(() => { void loadTeam(); }, []);

  const inviteMember = async () => {
    if (!memberForm.name.trim() || !memberForm.email.trim()) return;
    if (editingMemberId) {
      await api.updateTeamMember(editingMemberId, {
        name: memberForm.name.trim(),
        email: memberForm.email.trim(),
        role: memberForm.role,
        groupIds: memberForm.groupIds
      });
      setEditingMemberId(undefined);
      setMemberForm({ name: "", email: "", role: "employee", groupIds: [] });
      await loadTeam();
      return;
    }
    const member = await api.createTeamMember({
      name: memberForm.name.trim(),
      email: memberForm.email.trim(),
      role: memberForm.role,
      groupIds: memberForm.groupIds
    });
    setLastInvite({ url: member.inviteUrl, email: member.email, result: member.emailResult });
    setMemberForm({ name: "", email: "", role: "employee", groupIds: [] });
    await loadTeam();
  };

  const startMemberEdit = (memberId: string) => {
    const member = team.members.find((item) => item.id === memberId);
    if (!member) return;
    setEditingMemberId(member.id);
    setMemberForm({
      name: member.name,
      email: member.email,
      role: member.role,
      groupIds: team.groups.filter((group) => group.memberIds.includes(member.id)).map((group) => group.id)
    });
    setLastInvite(undefined);
  };

  const cancelMemberEdit = () => {
    setEditingMemberId(undefined);
    setMemberForm({ name: "", email: "", role: "employee", groupIds: [] });
  };

  const toggleMemberGroup = (groupId: string) => {
    setMemberForm((current) => ({
      ...current,
      groupIds: current.groupIds.includes(groupId) ? current.groupIds.filter((id) => id !== groupId) : [...current.groupIds, groupId]
    }));
  };

  const groupNamesForMember = (memberId: string) =>
    team.groups.filter((group) => group.memberIds.includes(memberId)).map((group) => group.name).join(", ") || "No groups";

  const invitationByMemberId = useMemo(
    () => new Map(team.invitations.filter((invite) => invite.status === "pending").map((invite) => [invite.memberId, invite])),
    [team.invitations]
  );

  return (
    <section className="space-y-4">
      <Panel title={editingMemberId ? "Edit member" : "Invite member"}>
        <div className="grid grid-cols-[1fr_1fr_150px_auto] items-end gap-3">
          <TextInput label="Name" value={memberForm.name} onChange={(value) => setMemberForm((current) => ({ ...current, name: value }))} />
          <TextInput label="Email" value={memberForm.email} onChange={(value) => setMemberForm((current) => ({ ...current, email: value }))} />
          <SelectInput
            label="Role"
            value={memberForm.role}
            onChange={(value) => setMemberForm((current) => ({ ...current, role: value as Role }))}
            options={[
              { value: "admin", label: "Admin" },
              { value: "manager", label: "Manager" },
              { value: "employee", label: "Employee" }
            ]}
          />
          <div className="flex gap-2">
            {editingMemberId && <Button onClick={cancelMemberEdit}>Cancel</Button>}
            <Button variant="primary" icon={<UserPlus size={16} />} onClick={() => void inviteMember()}>{editingMemberId ? "Save" : "Send invite"}</Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {team.groups.map((group) => (
            <button
              key={group.id}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                memberForm.groupIds.includes(group.id)
                  ? "border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink"
                  : "border-line bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-[#202328] dark:text-gray-300"
              }`}
              onClick={() => toggleMemberGroup(group.id)}
            >
              {group.name}
            </button>
          ))}
        </div>
        {lastInvite && <InviteStatus invite={lastInvite} />}
      </Panel>
      <Panel title="Members">
        <div className="space-y-3">
          {team.members.map((member) => {
            const invite = invitationByMemberId.get(member.id);
            return (
              <div key={member.id} className="grid grid-cols-[1fr_140px_1fr_auto_auto_auto] items-center gap-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-[#202328]">
                <div>
                  <div className="font-medium">{member.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
                </div>
                <span className="rounded-lg bg-gray-100 px-2 py-1 text-center text-xs dark:bg-white/10">{member.role}</span>
                <div className="text-xs text-gray-500 dark:text-gray-400">{groupNamesForMember(member.id)}</div>
                <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs dark:bg-white/10">{member.active ? "active" : "invited"}</span>
                <Button
                  disabled={member.active}
                  onClick={() => void api.resendTeamInvite(member.id).then((nextInvite) => {
                    setLastInvite({ url: nextInvite.inviteUrl, email: nextInvite.email, result: nextInvite.emailResult });
                    return loadTeam();
                  })}
                >
                  {invite ? "Resend" : "Invite"}
                </Button>
                <div className="flex justify-end gap-2">
                  <Button icon={<Pencil size={15} />} onClick={() => startMemberEdit(member.id)}>Edit</Button>
                  <Button
                    icon={<Trash2 size={15} />}
                    onClick={() => {
                      if (confirm(`Delete member "${member.name}"?`)) {
                        void api.deleteTeamMember(member.id).then(loadTeam);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </section>
  );
}

function Logs() {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => { void api.logs().then(setLogs); }, []);
  return (
    <Panel title="Activity Logs">
      <div className="mb-4 flex justify-end">
        <Button onClick={() => {
          if (confirm("Clear all activity logs?")) void api.clearLogs().then(() => setLogs([]));
        }}>Clear logs</Button>
      </div>
      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="grid grid-cols-[160px_1fr_1fr] rounded-lg bg-gray-50 p-3 text-sm dark:bg-[#202328]">
            <span className="text-gray-500">{new Date(log.created_at).toLocaleString()}</span>
            <span>{log.action}</span>
            <span>{log.target}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AutomationApi() {
  const [worker, setWorker] = useState<any>();
  useEffect(() => { void api.pythonWorkerStatus().then(setWorker); }, []);
  const endpoints = useMemo(() => [
    "GET /api/profiles",
    "POST /api/profiles/:id/launch",
    "POST /api/profiles/:id/stop",
    "POST /api/cookies/import",
    "POST /api/cookies/export",
    "GET /api/worker/python/status",
    "POST /api/worker/python/page-check"
  ], []);
  return (
    <Panel title="Automation API">
      <div className="grid grid-cols-2 gap-3">
        {endpoints.map((endpoint) => (
          <code key={endpoint} className="rounded-lg bg-gray-950 p-3 text-sm text-white">{endpoint}</code>
        ))}
      </div>
      <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm dark:bg-[#202328]">
        <div className="font-medium">Python worker: {worker?.ok ? "connected" : "optional service offline"}</div>
        <div className="mt-1 text-gray-500">{worker?.url ?? "http://127.0.0.1:4391"}</div>
        {worker?.error && <div className="mt-1 text-gray-500">{worker.error}</div>}
      </div>
      <div className="mt-4 text-sm text-gray-500">Compatible with Playwright, Puppeteer adapters, Selenium bridge services, and Python QA workers.</div>
    </Panel>
  );
}

function Settings() {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [smtp, setSmtp] = useState<SmtpSettings>({
    enabled: false,
    host: "",
    port: 587,
    secure: false,
    startTls: true,
    fromEmail: "workspace@company.local",
    fromName: "Workspace Profile Manager",
    inviteBaseUrl: "profilex://invite"
  });
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpStatus, setSmtpStatus] = useState<string>();
  const [proxyline, setProxyline] = useState<ProxylineSettings>({});
  const [proxylineApiKey, setProxylineApiKey] = useState("");
  const [proxylineAccountName, setProxylineAccountName] = useState("");
  const [proxylineStatus, setProxylineStatus] = useState<string>();
  const [biometricAvailable, setBiometricAvailable] = useState<boolean>();
  const [appLock, setAppLock] = useState<AppLockSettings>(() => getAppLockSettings());
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [securityStatus, setSecurityStatus] = useState<string>();
  const [operations, setOperations] = useState<OperationsSettings>(() => getOperationsSettings());

  useEffect(() => {
    void api.smtpSettings().then(setSmtp);
    void api.proxylineSettings().then((settings) => {
      setProxyline(settings);
      setProxylineAccountName(settings.accountName ?? "");
    });
    if (!window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
      setBiometricAvailable(false);
      return;
    }
    void window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(setBiometricAvailable).catch(() => setBiometricAvailable(false));
  }, []);

  const changeTheme = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  const updateSmtpForm = (key: keyof SmtpSettings, value: string | boolean | number) => {
    setSmtp((current) => ({ ...current, [key]: value }));
    setSmtpStatus(undefined);
  };

  const saveSmtp = async () => {
    const saved = await api.updateSmtpSettings({ ...smtp, ...(smtpPassword ? { password: smtpPassword } : {}) });
    setSmtp(saved);
    setSmtpPassword("");
    setSmtpStatus("SMTP settings saved.");
  };

  const testSmtp = async () => {
    try {
      await api.testSmtpSettings({ ...smtp, ...(smtpPassword ? { password: smtpPassword } : {}) });
      setSmtpStatus("SMTP connection test passed.");
    } catch (error) {
      setSmtpStatus(error instanceof Error ? error.message : "SMTP test failed.");
    }
  };

  const saveProxyline = async () => {
    const saved = await api.updateProxylineSettings({ ...(proxylineApiKey ? { apiKey: proxylineApiKey } : {}), accountName: proxylineAccountName });
    setProxyline(saved);
    setProxylineApiKey("");
    setProxylineStatus("Proxyline API key saved.");
  };

  const deleteProxyline = async () => {
    const saved = await api.deleteProxylineSettings();
    setProxyline(saved);
    setProxylineApiKey("");
    setProxylineStatus("Proxyline integration removed.");
  };

  const saveAppLock = (next: AppLockSettings) => {
    setAppLock(next);
    storeAppLockSettings(next);
  };

  const savePin = async () => {
    if (!/^\d{4,8}$/.test(newPin)) {
      setSecurityStatus("PIN must contain 4 to 8 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setSecurityStatus("PIN confirmation does not match.");
      return;
    }
    const salt = createRandomToken();
    const pinHash = await hashPin(newPin, salt);
    saveAppLock({ ...appLock, enabled: true, defaultMethod: appLock.defaultMethod ?? "pin", pinEnabled: true, pinSalt: salt, pinHash });
    setNewPin("");
    setConfirmPin("");
    setSecurityStatus("PIN lock enabled.");
  };

  const setupBiometric = async () => {
    try {
      const credentialId = await registerBiometricCredential();
      saveAppLock({ ...appLock, enabled: true, biometricEnabled: true, biometricCredentialId: credentialId });
      setSecurityStatus("Fingerprint unlock enabled.");
    } catch (error) {
      setSecurityStatus(error instanceof Error ? error.message : "Could not enable fingerprint unlock.");
    }
  };

  const disableAppLock = () => {
    saveAppLock({ enabled: false, defaultMethod: "pin" });
    setSecurityStatus("App lock disabled.");
  };

  const updateOperations = (key: keyof OperationsSettings, value: boolean) => {
    setOperations((current) => {
      const next = { ...current, [key]: value };
      window.localStorage.setItem(OPERATIONS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <Panel title="Appearance">
        <div className="grid grid-cols-2 gap-3">
          <Button className="justify-center" variant={theme === "light" ? "primary" : "secondary"} icon={<Sun size={16} />} onClick={() => changeTheme("light")}>
            Light
          </Button>
          <Button className="justify-center" variant={theme === "dark" ? "primary" : "secondary"} icon={<Moon size={16} />} onClick={() => changeTheme("dark")}>
            Dark
          </Button>
        </div>
        <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Theme preference is saved locally for this app.</div>
      </Panel>
      <Panel title="SMTP invites">
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <CheckboxInput label="Enable email invites" checked={smtp.enabled} onChange={(value) => updateSmtpForm("enabled", value)} />
            <CheckboxInput label="Secure TLS" checked={smtp.secure} onChange={(value) => updateSmtpForm("secure", value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <TextInput label="SMTP host" value={smtp.host} onChange={(value) => updateSmtpForm("host", value)} />
            <TextInput label="Port" value={String(smtp.port)} onChange={(value) => updateSmtpForm("port", Number(value))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Username" value={smtp.username ?? ""} onChange={(value) => updateSmtpForm("username", value)} />
          <TextInput
            label={smtp.hasPassword ? "Password (saved)" : "Password"}
            value={smtpPassword}
            onChange={setSmtpPassword}
            type="password"
          />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="From email" value={smtp.fromEmail} onChange={(value) => updateSmtpForm("fromEmail", value)} />
            <TextInput label="From name" value={smtp.fromName} onChange={(value) => updateSmtpForm("fromName", value)} />
          </div>
          <TextInput label="Invite base URL" value={smtp.inviteBaseUrl} onChange={(value) => updateSmtpForm("inviteBaseUrl", value)} />
          <div className="flex justify-end gap-2">
            <Button onClick={() => void testSmtp()}>Test SMTP</Button>
            <Button variant="primary" onClick={() => void saveSmtp()}>Save SMTP</Button>
          </div>
        </div>
        {smtpStatus && <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-[#202328] dark:text-gray-300">{smtpStatus}</div>}
      </Panel>
      <Panel title="Proxyline integration">
        <div className="space-y-3">
          <div className="rounded-xl bg-gray-50 p-4 dark:bg-[#202328]">
            <div className="text-xs text-gray-500">Connected accounts</div>
            {proxyline.hasApiKey ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-white p-3 dark:bg-[#17191c]">
                <div>
                  <div className="font-medium">{proxyline.accountName || `API key ending in ${proxyline.keySuffix ?? ""}`}</div>
                  {proxyline.balance !== undefined && <div className="mt-1 text-sm text-gray-500">Balance: {proxyline.balance}</div>}
                </div>
                <Button onClick={() => void deleteProxyline()}>Remove</Button>
              </div>
            ) : <div className="mt-1 font-medium">Not connected</div>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Account name" value={proxylineAccountName} onChange={setProxylineAccountName} placeholder="Main Proxyline account" />
            <TextInput
              label={proxyline.hasApiKey ? "API key (saved)" : "API key"}
              value={proxylineApiKey}
              onChange={(value) => {
                setProxylineApiKey(value);
                setProxylineStatus(undefined);
              }}
              type="password"
            />
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Used to import active HTTP and SOCKS5 proxies directly from Proxyline.</div>
          <div className="flex justify-end gap-2">
            <Button variant="primary" onClick={() => void saveProxyline()}>Save Proxyline key</Button>
          </div>
        </div>
        {proxylineStatus && <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-[#202328] dark:text-gray-300">{proxylineStatus}</div>}
      </Panel>
      <Panel title="App lock">
        <div className="space-y-3">
          <SecurityMethodCard
            icon={<Fingerprint size={18} />}
            title="Fingerprint recognition (Windows Hello)"
            description="Sign in with Windows Hello on this device"
            enabled={Boolean(appLock.biometricEnabled)}
            expanded={Boolean(appLock.biometricEnabled)}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-500">{appLock.biometricCredentialId ? "Configured on this device" : "Not configured"}</span>
              <div className="flex gap-2">
                <Button disabled={!biometricAvailable} onClick={() => void setupBiometric()}>{appLock.biometricCredentialId ? "Add fingerprint" : "Set up"}</Button>
                {appLock.biometricEnabled && <Button onClick={() => saveAppLock({ ...appLock, biometricEnabled: false, enabled: Boolean(appLock.pinEnabled) })}>Remove</Button>}
              </div>
            </div>
          </SecurityMethodCard>
          <SecurityMethodCard
            icon={<KeyRound size={18} />}
            title="PIN code (Windows Hello)"
            description="Windows Hello can offer system PIN during unlock"
            enabled={Boolean(appLock.pinEnabled)}
            expanded={Boolean(appLock.pinEnabled)}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-500">{appLock.pinHash ? "Local fallback PIN configured" : "Optional local fallback"}</span>
              <div className="flex gap-2">
                <Button onClick={() => saveAppLock({ ...appLock, pinEnabled: true, enabled: true })}>{appLock.pinHash ? "Change PIN" : "Enable PIN"}</Button>
                {appLock.pinEnabled && <Button onClick={() => saveAppLock({ ...appLock, pinEnabled: false, enabled: Boolean(appLock.biometricEnabled), pinHash: undefined, pinSalt: undefined })}>Remove</Button>}
              </div>
            </div>
            {appLock.pinEnabled && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <TextInput label="New PIN" value={newPin} onChange={setNewPin} type="password" />
                <TextInput label="Repeat PIN" value={confirmPin} onChange={setConfirmPin} type="password" />
                <div className="col-span-2 flex justify-end"><Button variant="primary" onClick={() => void savePin()}>Save PIN</Button></div>
              </div>
            )}
          </SecurityMethodCard>
          <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4 dark:bg-[#202328]">
            <div>
              <div className="font-medium">App protection</div>
              <div className="text-sm text-gray-500">{appLock.enabled ? "Enabled" : "Disabled"}</div>
            </div>
            {appLock.enabled ? <Button onClick={disableAppLock}>Disable</Button> : <Button variant="primary" disabled={!appLock.biometricCredentialId && !appLock.pinHash} onClick={() => saveAppLock({ ...appLock, enabled: true })}>Enable</Button>}
          </div>
        </div>
        {securityStatus && <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-[#202328] dark:text-gray-300">{securityStatus}</div>}
      </Panel>
      <Panel title="Operations">
        <div className="grid gap-3 sm:grid-cols-2">
          <CheckboxInput label="Check updates automatically" checked={operations.autoUpdates} onChange={(value) => updateOperations("autoUpdates", value)} />
          <CheckboxInput label="Launch with Windows" checked={operations.launchOnStartup} onChange={(value) => updateOperations("launchOnStartup", value)} />
          <CheckboxInput label="Anonymous diagnostics" checked={operations.telemetry} onChange={(value) => updateOperations("telemetry", value)} />
          <CheckboxInput label="Enable cloud sync" checked={operations.cloudSync} onChange={(value) => updateOperations("cloudSync", value)} />
          <CheckboxInput label="Global profile hotkeys" checked={operations.hotkeys} onChange={(value) => updateOperations("hotkeys", value)} />
        </div>
        <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-[#202328] dark:text-gray-300">
          Preferences are stored locally on this device.
        </div>
      </Panel>
    </div>
  );
}


function getLocalWorkspaceUser(): AuthUser {
  return { id: "local-user", name: "Local user", email: "local@profilex.local", createdAt: new Date(0).toISOString() };
}

function normalizeApiError(error: unknown) {
  if (!(error instanceof Error)) return "Request failed.";
  try {
    return JSON.parse(error.message).error ?? error.message;
  } catch {
    return error.message;
  }
}

type OperationsSettings = {
  autoUpdates: boolean;
  launchOnStartup: boolean;
  telemetry: boolean;
  cloudSync: boolean;
  hotkeys: boolean;
};

const OPERATIONS_STORAGE_KEY = "profilex.operations";

function getOperationsSettings(): OperationsSettings {
  try {
    const saved = window.localStorage.getItem(OPERATIONS_STORAGE_KEY);
    if (!saved) throw new Error("missing");
    return { autoUpdates: true, launchOnStartup: false, telemetry: false, cloudSync: false, hotkeys: true, ...JSON.parse(saved) };
  } catch {
    return { autoUpdates: true, launchOnStartup: false, telemetry: false, cloudSync: false, hotkeys: true };
  }
}

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "profilex.theme";

function getInitialTheme(): ThemeMode {
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function useTheme() {
  useEffect(() => {
    applyTheme(getInitialTheme());
  }, []);
}

type AppUnlockMethod = "pin" | "biometric";
type AppLockSettings = {
  enabled: boolean;
  defaultMethod: AppUnlockMethod;
  pinEnabled?: boolean;
  biometricEnabled?: boolean;
  pinSalt?: string;
  pinHash?: string;
  biometricCredentialId?: string;
};

const APP_LOCK_STORAGE_KEY = "profilex.appLock";

function getAppLockSettings(): AppLockSettings {
  try {
    const saved = window.localStorage.getItem(APP_LOCK_STORAGE_KEY);
    if (!saved) return { enabled: false, defaultMethod: "pin" };
    const parsed = JSON.parse(saved);
    return {
      enabled: false,
      defaultMethod: parsed.defaultMethod ?? parsed.method ?? "pin",
      pinEnabled: parsed.pinEnabled ?? Boolean(parsed.pinHash),
      biometricEnabled: parsed.biometricEnabled ?? Boolean(parsed.biometricCredentialId),
      ...parsed
    };
  } catch {
    return { enabled: false, defaultMethod: "pin" };
  }
}

function storeAppLockSettings(settings: AppLockSettings) {
  window.localStorage.setItem(APP_LOCK_STORAGE_KEY, JSON.stringify(settings));
}

function createRandomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return bytesToBase64(bytes);
}

async function hashPin(pin: string, salt: string) {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToBase64(new Uint8Array(digest));
}

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function registerBiometricCredential() {
  if (!window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) throw new Error("Fingerprint unlock is not supported on this device.");
  const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  if (!available) throw new Error("Fingerprint unlock is not available on this device.");
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "ProfileX" },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: "local-profilex-user",
        displayName: "ProfileX local user"
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60000
    }
  }) as PublicKeyCredential | null;
  if (!credential) throw new Error("Fingerprint setup was cancelled.");
  return bytesToBase64(new Uint8Array(credential.rawId));
}

async function verifyBiometricCredential(credentialId: string) {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ id: base64ToBytes(credentialId), type: "public-key" }],
      userVerification: "required",
      timeout: 60000
    }
  });
  return Boolean(credential);
}

function AppLockGate({ onUnlock }: { onUnlock: () => void }) {
  const settings = getAppLockSettings();
  const [status, setStatus] = useState("Waiting for Windows Hello...");
  const [pin, setPin] = useState("");

  const unlockWithSystem = async () => {
    try {
      if (!settings.biometricCredentialId) throw new Error("Windows Hello is not configured for this app.");
      if (await verifyBiometricCredential(settings.biometricCredentialId)) onUnlock();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Windows Hello unlock failed.");
    }
  };

  const unlockWithPin = async () => {
    if (!settings.pinSalt || !settings.pinHash) return;
    const pinHash = await hashPin(pin, settings.pinSalt);
    if (pinHash !== settings.pinHash) {
      setStatus("Incorrect PIN.");
      return;
    }
    onUnlock();
  };

  useEffect(() => {
    if (settings.biometricCredentialId) void unlockWithSystem();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-panel p-6 text-ink dark:bg-[#111315] dark:text-white">
      <div className="w-full max-w-sm rounded-lg border border-line bg-white p-6 text-center shadow-soft dark:border-white/10 dark:bg-[#17191c]">
        <h1 className="text-xl font-semibold">ProfileX is locked</h1>
        <p className="mt-2 text-sm text-gray-500">{status}</p>
        <div className="mt-5 space-y-3">
          {settings.biometricCredentialId && <Button className="w-full justify-center" variant="primary" onClick={() => void unlockWithSystem()}>Open Windows Hello</Button>}
          {!settings.biometricCredentialId && settings.pinHash && (
            <>
              <TextInput label="PIN code" value={pin} onChange={setPin} type="password" autoFocus />
              <Button className="w-full justify-center" variant="primary" onClick={() => void unlockWithPin()}>Unlock</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SecurityMethodCard({ icon, title, description, enabled, expanded, children }: { icon: React.ReactNode; title: string; description: string; enabled: boolean; expanded: boolean; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl bg-gray-50 dark:bg-[#202328]">
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white p-2 dark:bg-[#17191c]">{icon}</div>
          <div>
            <div className="font-medium">{title}</div>
            <div className="text-sm text-gray-500">{description}</div>
          </div>
        </div>
        <span className={`rounded-lg px-2 py-1 text-xs ${enabled ? "bg-emerald-500/10 text-emerald-600" : "bg-gray-200 text-gray-500 dark:bg-white/10"}`}>{enabled ? "Enabled" : "Off"}</span>
      </div>
      {expanded && <div className="border-t border-line p-4 dark:border-white/10">{children}</div>}
    </div>
  );
}


function GoogleIcon() {
  return <span className="text-lg font-semibold text-blue-500">G</span>;
}

function TelegramIcon() {
  return <span className="text-lg text-sky-500">?</span>;
}

function LoginPage({ onAuthenticated }: { onAuthenticated?: (session: { token: string; user: AuthUser }) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const session = mode === "login"
        ? await api.login({ email, password })
        : await api.register({ name, email, password });
      setAuthToken(session.token);
      onAuthenticated?.(session);
    } catch (submitError) {
      setError(normalizeApiError(submitError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-panel p-6 dark:bg-[#111315]">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-[#17191c]">
        <div className="grid grid-cols-2 rounded-xl bg-gray-50 p-1 dark:bg-[#202328]">
          <button className={`rounded-lg px-3 py-2 text-sm ${mode === "login" ? "bg-white font-medium shadow-sm dark:bg-[#17191c]" : "text-gray-500"}`} onClick={() => setMode("login")}>Sign in</button>
          <button className={`rounded-lg px-3 py-2 text-sm ${mode === "register" ? "bg-white font-medium shadow-sm dark:bg-[#17191c]" : "text-gray-500"}`} onClick={() => setMode("register")}>Register</button>
        </div>
        <h1 className="mt-5 text-xl font-semibold">{mode === "login" ? "Welcome back" : "Create ProfileX account"}</h1>
        <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          {mode === "register" && <input className="h-10 w-full rounded-lg border border-line bg-transparent px-3 outline-none dark:border-white/10" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />}
          <input className="h-10 w-full rounded-lg border border-line bg-transparent px-3 outline-none dark:border-white/10" placeholder="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input className="h-10 w-full rounded-lg border border-line bg-transparent px-3 outline-none dark:border-white/10" placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
          <Button className="w-full justify-center" variant="primary" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</Button>
        </form>
      </div>
    </div>
  );
}

function Recovery() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Panel title="Crash recovery"><Field label="Profile windows" value="Restore last known session" /></Panel>
      <Panel title="Profile backup"><Field label="Schedule" value="Daily encrypted archive" /></Panel>
      <Panel title="Cloud sync"><Field label="Mode" value="Optional company tenant" /></Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-[#17191c]">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-[#202328]">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 break-words font-medium">{value}</div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <input
        autoFocus={autoFocus}
        type={type}
        className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-white/10 dark:bg-[#202328]"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function CheckboxInput({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm dark:border-white/10 dark:bg-[#202328]">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <select
        className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-white/10 dark:bg-[#202328]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ProxySelect({
  value,
  proxies,
  onChange
}: {
  value: string;
  proxies: ProxySettings[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Proxy</span>
      <select
        className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-white/10 dark:bg-[#202328]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Direct connection</option>
        <option value="__new__">Add new proxy...</option>
        {proxies.map((proxy) => (
          <option key={proxy.id} value={proxy.id}>
            {proxy.name}{proxy.country ? ` - ${proxy.country}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <textarea
        className="h-20 w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-white/10 dark:bg-[#202328]"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
