import { contextBridge, ipcRenderer } from "electron";

const channels = {
  launch: "profilex:launch-profile",
  stop: "profilex:stop-profile",
  export: "profilex:export-profile-state",
  closed: "profilex:profile-closed"
} as const;

contextBridge.exposeInMainWorld("profilex", {
  platform: process.platform,
  apiBaseUrl: "http://127.0.0.1:4387/api",
  launchProfile: (args: unknown) => ipcRenderer.invoke(channels.launch, args),
  stopProfile: (id: string) => ipcRenderer.invoke(channels.stop, id),
  exportProfileState: (id: string) => ipcRenderer.invoke(channels.export, id),
  onProfileClosed: (callback: (profileId: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, profileId: string) => callback(profileId);
    ipcRenderer.on(channels.closed, listener);
    return () => ipcRenderer.removeListener(channels.closed, listener);
  },
  getSecureToken: (key: string) => ipcRenderer.sendSync("profilex:get-token", key),
  setSecureToken: (key: string, value?: string) => ipcRenderer.send("profilex:set-token", key, value)
});
