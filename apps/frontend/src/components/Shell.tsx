import { clsx } from "clsx";
import { Activity, Bot, Fingerprint, FolderKanban, Gauge, KeyRound, ListChecks, MonitorCog, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { useWorkspaceStore } from "../store/useWorkspaceStore";
import logoUrl from "../assets/logo-mark.png";

const items = [
  ["Dashboard", Gauge],
  ["Profiles", MonitorCog],
  ["Proxy Manager", ShieldCheck],
  ["Fingerprints", Fingerprint],
  ["Groups", FolderKanban],
  ["Members", UserPlus],
  ["Logs", Activity],
  ["Automation API", Bot],
  ["Settings", Settings],
  ["Login Page", KeyRound],
  ["Recovery", ListChecks]
] as const;

function ProfileXLogo() {
  return (
    <div className="h-10 w-10 overflow-hidden rounded-2xl bg-white shadow-soft">
      <img src={logoUrl} alt="ProfileX" className="h-full w-full object-contain" />
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const activePage = useWorkspaceStore((state) => state.activePage);
  const setActivePage = useWorkspaceStore((state) => state.setActivePage);
  const [isCollapsed, setCollapsed] = useState(() => window.localStorage.getItem("profilex.sidebarCollapsed") === "true");

  const toggleSidebar = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("profilex.sidebarCollapsed", String(next));
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-panel text-ink dark:bg-[#111315] dark:text-white">
      <aside className={clsx("flex border-r border-line bg-white/80 px-3 py-4 backdrop-blur-xl transition-all dark:border-white/10 dark:bg-[#17191c]", isCollapsed ? "w-16" : "w-52")}>
        <div className="flex min-h-full w-full flex-col">
          <div className={clsx("mb-7 flex items-center", isCollapsed ? "justify-center" : "gap-3 px-2")}>
            <ProfileXLogo />
            {!isCollapsed && <div className="text-sm text-gray-500 dark:text-gray-400">Browser profiles</div>}
          </div>
          <nav className="space-y-1">
            {items.map(([label, Icon]) => (
              <button
                key={label}
                onClick={() => setActivePage(label)}
                title={label}
                className={clsx(
                  "flex h-10 w-full items-center rounded-lg text-sm transition",
                  isCollapsed ? "justify-center px-0" : "gap-3 px-3 text-left",
                  activePage === label
                    ? "bg-ink text-white shadow-soft dark:bg-white dark:text-ink"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                )}
              >
                <Icon size={17} />
                {!isCollapsed && label}
              </button>
            ))}
          </nav>
          <button
            onClick={toggleSidebar}
            className={clsx("mt-auto flex h-10 items-center rounded-lg text-gray-500 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10", isCollapsed ? "justify-center" : "gap-3 px-3")}
            title={isCollapsed ? "Expand menu" : "Collapse menu"}
          >
            {isCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            {!isCollapsed && "Collapse menu"}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">
        <div className="flex h-14 items-center justify-between border-b border-line bg-white/70 px-6 backdrop-blur-xl dark:border-white/10 dark:bg-[#17191c]/95">
          <div>
            <div className="text-sm font-semibold">{activePage}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Company internal workspace</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Local API connected
          </div>
        </div>
        <div className="h-[calc(100vh-56px)] overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}
