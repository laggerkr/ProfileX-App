import type { BrowserProfile, DashboardStats, ProxySettings } from "@profilex/shared";
import { create } from "zustand";
import { api, apiUrl, getAuthToken } from "../api/client";

let realtimeSocket: WebSocket | undefined;
function ensureRealtime(onChange: () => void) {
  if (realtimeSocket || !getAuthToken()) return;
  const wsUrl = `${apiUrl.replace(/^http/, "ws")}/ws?token=${encodeURIComponent(getAuthToken()!)}`;
  realtimeSocket = new WebSocket(wsUrl);
  realtimeSocket.onmessage = () => onChange();
  realtimeSocket.onclose = () => { realtimeSocket = undefined; };
}

interface WorkspaceState {
  activePage: string;
  loading: boolean;
  lastError?: string;
  dashboard?: DashboardStats;
  profiles: BrowserProfile[];
  proxies: ProxySettings[];
  setActivePage: (page: string) => void;
  initProfileCloseListener: () => () => void;
  refresh: () => Promise<void>;
  createProfile: (profile?: Partial<BrowserProfile>) => Promise<void>;
  updateProfile: (id: string, profile: Partial<BrowserProfile>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  launchProfile: (id: string) => Promise<void>;
  stopProfile: (id: string) => Promise<void>;
  cloneProfile: (id: string) => Promise<void>;
  archiveProfile: (id: string) => Promise<void>;
  createProxy: (proxy: Omit<ProxySettings, "id" | "status">) => Promise<void>;
  checkProxy: (id: string) => Promise<void>;
  updateProxy: (id: string, proxy: Partial<ProxySettings>) => Promise<void>;
  deleteProxy: (id: string) => Promise<void>;
  importProxies: (text: string) => Promise<void>;
}

let closeListenerCleanup: (() => void) | undefined;

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  activePage: "Dashboard",
  loading: false,
  profiles: [],
  proxies: [],
  setActivePage: (activePage) => set({ activePage }),
  initProfileCloseListener: () => {
    if (closeListenerCleanup) return closeListenerCleanup;
    closeListenerCleanup = window.profilex?.onProfileClosed?.(async (profileId) => {
      set((state) => ({ profiles: state.profiles.map((profile) => profile.id === profileId ? { ...profile, status: "ready" } : profile) }));
      try {
        await api.unlockProfile(profileId).catch(() => undefined);
        await api.updateProfile(profileId, { status: "ready" });
      } finally {
        await get().refresh();
      }
    }) ?? (() => undefined);
    return () => {
      closeListenerCleanup?.();
      closeListenerCleanup = undefined;
    };
  },
  refresh: async () => {
    set({ loading: true });
    const [dashboard, profiles, proxies] = await Promise.all([api.dashboard(), api.profiles(), api.proxies()]);
    set({ dashboard, profiles, proxies, loading: false });
    ensureRealtime(() => void get().refresh());
  },
  createProfile: async (profile) => {
    await api.createProfile(profile ?? { name: `Workspace ${get().profiles.length + 1}` });
    await get().refresh();
  },
  updateProfile: async (id, profile) => {
    await api.updateProfile(id, profile);
    await get().refresh();
  },
  deleteProfile: async (id) => {
    await api.deleteProfile(id);
    await get().refresh();
  },
  launchProfile: async (id) => {
    try {
      const profile = get().profiles.find((item) => item.id === id);
      if (!profile) throw new Error("Profile not found");
      if (!window.profilex?.launchProfile) throw new Error("Browser launch is available only in the ProfileX desktop app.");
      await api.lockProfile(id);
      const browserState = await api.profileState(id);
      const proxy = get().proxies.find((item) => item.id === profile.proxyId);
      await window.profilex.launchProfile({ profile, proxy, request: { profileId: id }, browserState });
      await api.updateProfile(id, { status: "running", lastLaunchedAt: new Date().toISOString() });
      set({ lastError: undefined });
      await get().refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not launch profile";
      set({ lastError: message });
      throw error;
    }
  },
  stopProfile: async (id) => {
    const result = await window.profilex?.stopProfile?.(id);
    const profile = get().profiles.find((item) => item.id === id);
    if (result?.state) await api.syncProfile(id, { ...result.state, expectedVersion: profile?.version });
    await api.unlockProfile(id);
    await api.updateProfile(id, { status: "ready" });
    await get().refresh();
  },
  cloneProfile: async (id) => {
    await api.cloneProfile(id);
    await get().refresh();
  },
  archiveProfile: async (id) => {
    await api.archiveProfile(id);
    await get().refresh();
  },
  createProxy: async (proxy) => {
    await api.createProxy(proxy);
  },
  checkProxy: async (id) => {
    await api.checkProxy(id);
    await get().refresh();
  },
  updateProxy: async (id, proxy) => {
    await api.updateProxy(id, proxy);
    await get().refresh();
  },
  deleteProxy: async (id) => {
    await api.deleteProxy(id);
    await get().refresh();
  },
  importProxies: async (text) => {
    await api.importProxies(text);
    await get().refresh();
  }
}));
