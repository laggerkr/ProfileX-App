import type { BrowserProfile, DashboardStats, ProxySettings } from "@profilex/shared";
import { create } from "zustand";
import { api } from "../api/client";

interface WorkspaceState {
  activePage: string;
  loading: boolean;
  lastError?: string;
  dashboard?: DashboardStats;
  profiles: BrowserProfile[];
  proxies: ProxySettings[];
  setActivePage: (page: string) => void;
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

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  activePage: "Dashboard",
  loading: false,
  profiles: [],
  proxies: [],
  setActivePage: (activePage) => set({ activePage }),
  refresh: async () => {
    set({ loading: true });
    const [dashboard, profiles, proxies] = await Promise.all([api.dashboard(), api.profiles(), api.proxies()]);
    set({ dashboard, profiles, proxies, loading: false });
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
      await api.launchProfile(id);
      set({ lastError: undefined });
      await get().refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not launch profile";
      set({ lastError: message });
      throw error;
    }
  },
  stopProfile: async (id) => {
    await api.stopProfile(id);
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
    await get().refresh();
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
