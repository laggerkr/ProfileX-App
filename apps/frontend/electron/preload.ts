import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("profilex", {
  platform: process.platform,
  apiBaseUrl: "http://127.0.0.1:4387/api"
});
