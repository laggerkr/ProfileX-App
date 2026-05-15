import type { BrowserProfile, FingerprintSettings, ProxylineSettings, ProxySettings, Role, SmtpSettings, TeamWorkspaceData } from "@profilex/shared";
import { Activity, Archive, Copy, Database, FolderKanban, Globe2, Moon, Pencil, Play, Plus, RefreshCcw, Shield, Square, Sun, Trash2, Upload, UserPlus, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./components/Button";
import { Shell } from "./components/Shell";
import { StatCard } from "./components/StatCard";
import { api, type EmailResult } from "./api/client";
import { useWorkspaceStore } from "./store/useWorkspaceStore";

export function App() {
  const { activePage, refresh } = useWorkspaceStore();
  useTheme();

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return (
    <Shell>
      <div className="screen-enter">
        {activePage === "Dashboard" && <Dashboard />}
        {activePage === "Profiles" && <Profiles />}
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
  useEffect(() => { void api.browserStatus().then(setBrowserStatus); }, []);
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <Button icon={<RefreshCcw size={16} />} onClick={() => void refresh()}>Refresh</Button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Profiles" value={dashboard?.profiles ?? 0} icon={<Database size={18} />} />
        <StatCard label="Online profiles" value={dashboard?.onlineProfiles ?? 0} icon={<Activity size={18} />} />
        <StatCard label="Proxy health" value={`${dashboard?.proxyHealth ?? 100}%`} icon={<Shield size={18} />} />
        <StatCard label="Team members" value="1" icon={<Users size={18} />} />
      </div>
      <div className="grid grid-cols-[1.2fr_0.8fr] gap-4">
        <Panel title="Usage statistics">
          <div className="flex h-56 items-end gap-3">
            {(dashboard?.usage ?? []).map((item) => (
              <div key={item.day} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t-lg bg-brand/80" style={{ height: `${30 + item.launches * 12}px` }} />
                <span className="text-xs text-gray-500">{item.day}</span>
              </div>
            ))}
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
      <Panel title="Runtime status">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Field label="Browser engine" value={browserStatus?.ok ? "Chromium ready" : "Chromium setup required"} />
          <Field label="Running contexts" value={String(browserStatus?.runningProfiles ?? 0)} />
          <Field label="Engine path" value={browserStatus?.executablePath ?? browserStatus?.error ?? "Checking..."} />
        </div>
      </Panel>
    </section>
  );
}

function Profiles() {
  const { profiles, proxies, createProfile, updateProfile, deleteProfile, launchProfile, stopProfile, cloneProfile, archiveProfile } = useWorkspaceStore();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<BrowserProfile>();
  const [editingNotesProfile, setEditingNotesProfile] = useState<BrowserProfile>();
  const [editingTagsProfile, setEditingTagsProfile] = useState<BrowserProfile>();
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
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>New profile</Button>
      </div>
      {isCreateOpen && (
        <ProfileEditorDialog
          mode="create"
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
              <th className="px-4 py-3">Proxy</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id} className="border-t border-line dark:border-white/10">
                <td className="px-4 py-3">
                  <div className="font-medium">{profile.name}</div>
                  <div className="text-xs text-gray-500">{profile.operatingSystem ?? "windows"}</div>
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
                  <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs dark:bg-white/10">
                    {(profile.browserEngine ?? "chromium") === "firefox" ? "Stealthfox" : "Mimic"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {profile.proxyId && proxyById.get(profile.proxyId) ? (
                    <div>
                      <div>{proxyById.get(profile.proxyId)!.name}</div>
                      <div className="text-xs text-gray-500">
                        {proxyById.get(profile.proxyId)!.country ?? "Country unknown"}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400">Direct</span>
                  )}
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
                    <Button icon={<Copy size={15} />} onClick={() => void cloneProfile(profile.id)} />
                    <Button icon={<Pencil size={15} />} onClick={() => setEditingProfile(profile)} />
                    <Button icon={<Archive size={15} />} onClick={() => void archiveProfile(profile.id)} />
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
  onClose,
  onSave
}: {
  mode: "create" | "edit";
  profile?: BrowserProfile;
  proxies: ProxySettings[];
  groupOptions: Array<{ value: string; label: string }>;
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
    storageMode: profile?.storageMode ?? "device",
    startupUrls: profile?.startupUrls.join("\n") ?? "https://example.com",
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
    protocol: "http" as ProxySettings["protocol"],
    host: "",
    port: "",
    username: "",
    password: "",
    group: "Profile proxies"
  });
  const [selectedProxyCredentials, setSelectedProxyCredentials] = useState({ username: "", password: "" });

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
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
        const port = Number(newProxy.port);
        if (!newProxy.host.trim() || !Number.isFinite(port)) {
          setError("Proxy host and port are required.");
          setSaving(false);
          return;
        }
        const createdProxy = await api.createProxy({
          name: `${newProxy.protocol.toUpperCase()} ${newProxy.host.trim()}:${port}`,
          protocol: newProxy.protocol,
          host: newProxy.host.trim(),
          port,
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
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Type</span>
                  <select
                    className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-white/10 dark:bg-[#202328]"
                    value={newProxy.protocol}
                    onChange={(event) => updateNewProxy("protocol", event.target.value)}
                  >
                    <option value="http">HTTP</option>
                    <option value="socks5">SOCKS5</option>
                  </select>
                </label>
                <div className="col-span-2">
                  <TextInput label="Host / IP" value={newProxy.host} onChange={(value) => updateNewProxy("host", value)} />
                </div>
                <TextInput label="Port" value={newProxy.port} onChange={(value) => updateNewProxy("port", value)} />
                <TextInput label="Login" value={newProxy.username} onChange={(value) => updateNewProxy("username", value)} />
                <TextInput label="Password" value={newProxy.password} onChange={(value) => updateNewProxy("password", value)} />
              </div>
            </div>
          )}
          <div className="col-span-2 mt-2 text-sm font-semibold">Browser</div>
          <SelectInput label="Tab behavior" value={form.tabBehavior} onChange={(value) => update("tabBehavior", value)} options={[{ value: "restore", label: "Restore last session" }, { value: "custom", label: "Open startup URLs" }]} />
          <SelectInput label="Operating system" value={form.operatingSystem} onChange={(value) => update("operatingSystem", value)} options={[{ value: "macos", label: "macOS" }, { value: "windows", label: "Windows" }, { value: "linux", label: "Linux" }, { value: "android", label: "Android" }]} />
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

function splitList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
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
    protocol: "http" as ProxySettings["protocol"],
    host: "",
    port: "",
    username: "",
    password: ""
  });
  const updateProxyForm = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const resetProxyForm = () => {
    setEditingProxy(undefined);
    setForm({ name: "", protocol: "http", host: "", port: "", username: "", password: "" });
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
    const port = Number(form.port);
    if (!form.host.trim() || !Number.isFinite(port)) return;
    await createProxy({
      name: form.name.trim() || "New proxy",
      protocol: form.protocol,
      host: form.host.trim(),
      port,
      username: form.username.trim() || undefined,
      password: form.password.trim() || undefined
    });
    resetProxyForm();
  };
  const openProxyCreate = () => {
    setEditingProxy(undefined);
    setForm({ name: "", protocol: "http", host: "", port: "", username: "", password: "" });
    setProxyDialogOpen(true);
  };
  const startProxyEdit = (proxy: ProxySettings) => {
    setEditingProxy(proxy);
    setForm({
      name: proxy.name,
      protocol: proxy.protocol,
      host: proxy.host,
      port: String(proxy.port),
      username: proxy.username ?? "",
      password: proxy.password ?? ""
    });
    setProxyDialogOpen(true);
  };
  const saveProxyEdit = async () => {
    if (!editingProxy) return;
    const port = Number(form.port);
    if (!form.host.trim() || !Number.isFinite(port)) return;
    await updateProxy(editingProxy.id, {
      name: form.name.trim() || editingProxy.name,
      protocol: form.protocol,
      host: form.host.trim(),
      port,
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
  protocol: ProxySettings["protocol"];
  host: string;
  port: string;
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
          <label className="col-span-6 block text-sm md:col-span-3">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Type</span>
            <select
              className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-white/10 dark:bg-[#202328]"
              value={form.protocol}
              onChange={(event) => onChange("protocol", event.target.value)}
            >
              <option value="http">HTTP</option>
              <option value="socks5">SOCKS5</option>
            </select>
          </label>
          <div className="col-span-12 md:col-span-4">
            <TextInput label="Host / IP" value={form.host} onChange={(value) => onChange("host", value)} />
          </div>
          <div className="col-span-6 md:col-span-3">
            <TextInput label="Port" value={form.port} onChange={(value) => onChange("port", value)} />
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
      <div className="grid grid-cols-2 gap-4">
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
              <ChipLine empty="No members" values={groupMembers.map((member) => member?.name).filter(Boolean) as string[]} />
              <ChipLine empty="No profiles" values={groupProfiles.map((profile) => profile.name)} />
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
  const [proxylineStatus, setProxylineStatus] = useState<string>();

  useEffect(() => {
    void api.smtpSettings().then(setSmtp);
    void api.proxylineSettings().then(setProxyline);
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
    const saved = await api.updateProxylineSettings(proxylineApiKey ? { apiKey: proxylineApiKey } : {});
    setProxyline(saved);
    setProxylineApiKey("");
    setProxylineStatus("Proxyline API key saved.");
  };
  return (
    <div className="grid grid-cols-2 gap-4">
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
        <div className="grid grid-cols-2 gap-3">
          <CheckboxInput label="Enable email invites" checked={smtp.enabled} onChange={(value) => updateSmtpForm("enabled", value)} />
          <CheckboxInput label="Secure TLS" checked={smtp.secure} onChange={(value) => updateSmtpForm("secure", value)} />
          <TextInput label="SMTP host" value={smtp.host} onChange={(value) => updateSmtpForm("host", value)} />
          <TextInput label="Port" value={String(smtp.port)} onChange={(value) => updateSmtpForm("port", Number(value))} />
          <TextInput label="Username" value={smtp.username ?? ""} onChange={(value) => updateSmtpForm("username", value)} />
          <TextInput
            label={smtp.hasPassword ? "Password (saved)" : "Password"}
            value={smtpPassword}
            onChange={setSmtpPassword}
            type="password"
          />
          <TextInput label="From email" value={smtp.fromEmail} onChange={(value) => updateSmtpForm("fromEmail", value)} />
          <TextInput label="From name" value={smtp.fromName} onChange={(value) => updateSmtpForm("fromName", value)} />
          <div className="col-span-2">
            <TextInput label="Invite base URL" value={smtp.inviteBaseUrl} onChange={(value) => updateSmtpForm("inviteBaseUrl", value)} />
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <Button onClick={() => void testSmtp()}>Test SMTP</Button>
            <Button variant="primary" onClick={() => void saveSmtp()}>Save SMTP</Button>
          </div>
        </div>
        {smtpStatus && <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-[#202328] dark:text-gray-300">{smtpStatus}</div>}
      </Panel>
      <Panel title="Proxyline integration">
        <div className="space-y-3">
          <TextInput
            label={proxyline.hasApiKey ? "API key (saved)" : "API key"}
            value={proxylineApiKey}
            onChange={(value) => {
              setProxylineApiKey(value);
              setProxylineStatus(undefined);
            }}
            type="password"
          />
          <div className="text-sm text-gray-500 dark:text-gray-400">Used to import active HTTP and SOCKS5 proxies directly from Proxyline.</div>
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => void saveProxyline()}>Save Proxyline key</Button>
          </div>
        </div>
        {proxylineStatus && <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-[#202328] dark:text-gray-300">{proxylineStatus}</div>}
      </Panel>
      <Panel title="Security">
        <Field label="Encrypted local storage" value="AES-256-GCM enabled" />
        <Field label="Credential vault" value="Local OS-backed key recommended" />
        <Field label="PIN lock" value="Optional" />
        <Field label="Biometric auth" value="Optional" />
      </Panel>
      <Panel title="Operations">
        <Field label="Auto updates" value="Installer ready" />
        <Field label="Telemetry" value="Off by default" />
        <Field label="Hotkeys" value="Configurable" />
        <Field label="Cloud sync" value="Encrypted sync adapter placeholder" />
      </Panel>
    </div>
  );
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

function LoginPage() {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-lg border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-[#17191c]">
      <h1 className="text-xl font-semibold">Company Sign In</h1>
      <div className="mt-4 space-y-3">
        <input className="h-10 w-full rounded-lg border border-line bg-transparent px-3 outline-none dark:border-white/10" placeholder="Email" />
        <input className="h-10 w-full rounded-lg border border-line bg-transparent px-3 outline-none dark:border-white/10" placeholder="Password or SSO token" type="password" />
        <Button className="w-full" variant="primary" icon={<Globe2 size={16} />}>Continue</Button>
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
