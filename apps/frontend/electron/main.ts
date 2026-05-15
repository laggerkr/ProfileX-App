import { app, BrowserWindow, Menu, shell } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

let mainWindow: BrowserWindow | undefined;
let apiProcess: ChildProcess | undefined;

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function startApi() {
  if (isDev) return;
  const apiEntry = path.join(app.getAppPath(), "apps", "backend", "dist", "index.js");
  apiProcess = spawn(process.execPath, [apiEntry], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: "ignore",
    windowsHide: true
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: "ProfileX",
    backgroundColor: "#f7f8fa",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    await mainWindow.loadFile(path.join(app.getAppPath(), "apps", "frontend", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  startApi();
  void createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  apiProcess?.kill();
});
