import { app, BrowserWindow, Menu, ipcMain, shell } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { exportProfileState, launchProfile, stopProfile } from "@profilex/browser-engine";
let mainWindow:BrowserWindow|undefined, apiProcess:ChildProcess|undefined; const isDev=Boolean(process.env.VITE_DEV_SERVER_URL), __dirname=path.dirname(fileURLToPath(import.meta.url));
function startApi(){if(isDev)return; const apiEntry=path.join(app.getAppPath(),"apps","backend","dist","index.js"); apiProcess=spawn(process.execPath,[apiEntry],{env:{...process.env,ELECTRON_RUN_AS_NODE:"1"},stdio:"ignore",windowsHide:true});}
async function createWindow(){mainWindow=new BrowserWindow({width:1280,height:820,minWidth:1024,minHeight:680,title:"ProfileX",backgroundColor:"#f7f8fa",webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false}}); mainWindow.webContents.setWindowOpenHandler(({url})=>{shell.openExternal(url); return{action:"deny"}}); if(isDev) await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!); else await mainWindow.loadFile(path.join(app.getAppPath(),"apps","frontend","dist","index.html"));}
ipcMain.handle("profilex:launch-profile",(_e,args)=>launchProfile({...args,dataRoot:path.join(app.getPath("userData"),"runtime")})); ipcMain.handle("profilex:stop-profile",(_e,id:string)=>stopProfile(id)); ipcMain.handle("profilex:export-profile-state",(_e,id:string)=>exportProfileState(id));
app.whenReady().then(()=>{Menu.setApplicationMenu(null); startApi(); void createWindow();}); app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)void createWindow()}); app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit()}); app.on("before-quit",()=>apiProcess?.kill());
