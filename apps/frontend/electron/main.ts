import { app, BrowserWindow, Menu, ipcMain, safeStorage, shell } from "electron";
import fs from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { exportProfileState, launchProfile, stopProfile } from "@profilex/browser-engine";
let mainWindow: BrowserWindow | undefined, apiProcess: ChildProcess | undefined;
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL), __dirname = path.dirname(fileURLToPath(import.meta.url));
function startApi() {
    if (isDev)
        return;
    const apiEntry = path.join(app.getAppPath(), "apps", "backend", "dist", "index.js");
    apiProcess = spawn(process.execPath, [apiEntry], {
        env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: "1"
        },
        stdio: "ignore",
        windowsHide: true
    });
}
async function createWindow() {
	const preloadPath = path.join(__dirname, "preload.cjs");
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 1024,
        minHeight: 680,
        title: "ProfileX",
        backgroundColor: "#f7f8fa",
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webSecurity: true,
            allowRunningInsecureContent: false
        }
    });
    mainWindow.webContents.setWindowOpenHandler(({
            url
        }) => {
        shell.openExternal(url);
        return {
            action: "deny"
        }
    });
    if (isDev) {
        await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
        mainWindow.webContents.openDevTools({
            mode: "detach"
        });
    } else
        await mainWindow.loadFile(path.join(app.getAppPath(), "apps", "frontend", "dist", "index.html"));
}
function tokenPath() {
    return path.join(app.getPath("userData"), "auth.dat")
}
function readTokens() {
    try {
        const raw = fs.readFileSync(tokenPath());
        const text = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString("utf8");
        return JSON.parse(text)
    } catch {
        return {}
    }
}
function writeTokens(tokens: any) {
    const text = JSON.stringify(tokens);
    fs.mkdirSync(path.dirname(tokenPath()), {
        recursive: true
    });
    fs.writeFileSync(tokenPath(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.from(text))
}
ipcMain.on("profilex:get-token", (event, key) => {
    event.returnValue = readTokens()[key]
});
ipcMain.on("profilex:set-token", (_event, key, value) => {
    const tokens = readTokens();
    if (value)
        tokens[key] = value;
    else
        delete tokens[key];
    writeTokens(tokens)
});
function assertId(value: unknown): asserts value is string {
    if (typeof value !== "string" || value.length > 128)
        throw new Error("Invalid profile id")
}
function assertLaunchArgs(value: any) {
    if (!value || typeof value !== "object" || typeof value.profile?.id !== "string" || value.request?.profileId !== value.profile.id)
        throw new Error("Invalid launch payload")
}
ipcMain.handle("profilex:launch-profile", async(_e, args) => {
    try {

        assertLaunchArgs(args);

        const result = await launchProfile({
		  ...args,
		  dataRoot: path.join(app.getPath("userData"), "runtime"),
		  onClose: (profileId: string) => {
			mainWindow?.webContents.send("profilex:profile-closed", profileId);
		  }
		});
        return result;
    } catch (error) {
        console.error("[ELECTRON] launch-profile failed:", error);
        throw error;
    }
});
ipcMain.handle("profilex:stop-profile", (_e, id) => {
    assertId(id);
    return stopProfile(id)
});
ipcMain.handle("profilex:export-profile-state", (_e, id) => {
    assertId(id);
    return exportProfileState(id)
});
app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    startApi();
    void createWindow();
});
app.on("browser-window-created", (_event, window) => {
    window.webContents.on("before-input-event", (event, input) => {
        if (isDev && input.control && input.shift && input.key.toLowerCase() === "i") {
            window.webContents.toggleDevTools();
            event.preventDefault();
        }
    })
});
app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0)
        void createWindow()
});
app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        app.quit()
});
app.on("before-quit", () => apiProcess?.kill());
