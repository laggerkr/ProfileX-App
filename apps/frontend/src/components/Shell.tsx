import { clsx } from "clsx";
import { Activity, Bot, CreditCard, Download, Fingerprint, FolderKanban, Gauge, ListChecks, MonitorCog, Moon, ChevronLeft, ChevronRight, Settings, ShieldCheck, Sun, UserRound, UserPlus, MonitorPlay } from "lucide-react";
import { useState } from "react";
import { canAccessPage, type AuthUser, type WorkspacePage } from "@profilex/shared";
import { useWorkspaceStore } from "../store/useWorkspaceStore";

const primaryItems = [
  ["Dashboard", Gauge], ["Profiles", MonitorCog], ["RDP", MonitorPlay], ["Proxy Manager", ShieldCheck],
  ["Fingerprints", Fingerprint], ["Groups", FolderKanban], ["Team / Users", UserPlus], ["Logs", Activity],
  ["Automation API", Bot], ["Billing", CreditCard], ["Recovery", ListChecks]
] as const;
const THEME_STORAGE_KEY = "profilex.theme";
const desktopDownloadUrl = import.meta.env.VITE_DESKTOP_DOWNLOAD_URL || '/downloads/ProfileX-Setup.exe';
function ProfileXLogo(){return <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-sm font-bold text-white shadow-soft dark:bg-white dark:text-ink">PX</div>}
function getTheme(){const saved=window.localStorage.getItem(THEME_STORAGE_KEY); return saved==='light'||saved==='dark'?saved:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}
function setDocumentTheme(theme:'light'|'dark'){document.documentElement.classList.toggle('dark',theme==='dark'); window.localStorage.setItem(THEME_STORAGE_KEY,theme)}
export function Shell({children,currentUser,onLogout}:{children:React.ReactNode;currentUser:AuthUser;onLogout:()=>void}){
 const activePage=useWorkspaceStore(s=>s.activePage), setActivePage=useWorkspaceStore(s=>s.setActivePage);
 const [isCollapsed,setCollapsed]=useState(()=>window.localStorage.getItem('profilex.sidebarCollapsed')==='true');
 const [theme,setTheme]=useState<'light'|'dark'>(()=>getTheme());
 const toggle=()=>setCollapsed(v=>{const n=!v; window.localStorage.setItem('profilex.sidebarCollapsed',String(n)); return n});
 const toggleTheme=()=>setTheme(v=>{const n=v==='dark'?'light':'dark'; setDocumentTheme(n); return n});
 return <div className="flex min-h-screen bg-panel text-ink dark:bg-[#111315] dark:text-white">
  <aside className={clsx('relative flex border-r border-line bg-white/80 px-3 py-4 backdrop-blur-xl transition-all dark:border-white/10 dark:bg-[#17191c]',isCollapsed?'w-16':'w-56')}>
   <button onClick={toggle} title={isCollapsed?'Expand menu':'Collapse menu'} className="absolute -right-3 top-[54px] z-20 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white shadow-soft transition hover:bg-gray-100 dark:border-white/10 dark:bg-[#202328] dark:hover:bg-[#2a2e35]">{isCollapsed?<ChevronRight size={15}/>:<ChevronLeft size={15}/>}</button>
   <div className="flex min-h-full w-full flex-col">
    <div className={clsx('mb-7 flex items-center',isCollapsed?'justify-center':'gap-3 px-2')}><ProfileXLogo/>{!isCollapsed&&<div><div className="text-sm font-semibold">ProfileX</div><div className="text-xs text-gray-500">Browser profiles</div></div>}</div>
    <nav className="space-y-1">{primaryItems.filter(([l])=>canAccessPage(currentUser.role,l as WorkspacePage)).map(([label,Icon])=><button key={label} title={label} onClick={()=>setActivePage(label)} className={clsx('flex h-10 w-full items-center rounded-lg text-sm transition',isCollapsed?'justify-center':'gap-3 px-3 text-left',activePage===label?'bg-ink text-white shadow-soft dark:bg-white dark:text-ink':'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10')}><Icon size={17}/>{!isCollapsed&&label}</button>)}</nav>
    <div className="mt-auto space-y-1 border-t border-line pt-3 dark:border-white/10">
      {canAccessPage(currentUser.role,'Settings')&&<button title="Profile settings" onClick={()=>setActivePage('Settings')} className={clsx('flex h-10 w-full items-center rounded-lg text-sm',isCollapsed?'justify-center':'gap-3 px-3',activePage==='Settings'?'bg-ink text-white dark:bg-white dark:text-ink':'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10')}><Settings size={17}/>{!isCollapsed&&'Profile settings'}</button>}
      <button title={theme==='dark'?'Light mode':'Dark mode'} onClick={toggleTheme} className={clsx('flex h-10 w-full items-center rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10',isCollapsed?'justify-center':'gap-3 px-3')}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>} {!isCollapsed&&(theme==='dark'?'Light mode':'Dark mode')}</button>
      <div className={clsx('flex h-10 items-center rounded-lg text-sm text-gray-500',isCollapsed?'justify-center':'gap-3 px-3')} title={currentUser.email}><UserRound size={17}/>{!isCollapsed&&<span className="truncate">{currentUser.name}</span>}</div>
    </div>
   </div>
  </aside>
  <main className="flex-1 overflow-hidden"><div className="flex h-14 items-center justify-between border-b border-line bg-white/70 px-6 backdrop-blur-xl dark:border-white/10 dark:bg-[#17191c]/95"><div><div className="text-sm font-semibold">{activePage}</div><div className="text-xs text-gray-500">Company internal workspace</div></div><div className="flex items-center gap-3 text-xs text-gray-500">{!window.profilex && <a href={desktopDownloadUrl} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 hover:bg-gray-100 dark:border-white/10 dark:hover:bg-white/10" download><Download size={14}/>Download PC app</a>}<span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500"/>Local API connected</span><span className="hidden sm:inline">{currentUser.email}</span><button className="rounded-lg border border-line px-2 py-1 hover:bg-gray-100 dark:border-white/10 dark:hover:bg-white/10" onClick={onLogout}>Log out</button></div></div><div className="h-[calc(100vh-56px)] overflow-auto p-6">{children}</div></main>
 </div>
}
